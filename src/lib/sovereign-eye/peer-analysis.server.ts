// @domain sovereign-eye
// @tables country_kpis,country_sources,countries,peer_kpi_normalized,peer_benchmarks,peer_gap_explanations,peer_analysis_runs
// @ui src/routes/api/public/hooks/peer-analysis.ts
//
// Regional peer-analysis job: scrub -> deterministic stats -> AI gap explanations.
// Bounded per run, single-flight lease, idempotent (keyed on input hash),
// circuit breaker on 402/403/429.

import { computeBenchmarks, scrubKpis, type PeerBenchmark, type RawKpi } from "./peer-stats";

const RUN = "regional";
const MODEL = "openai/gpt-6-astra";
const EXPLAIN_BATCH = 12;
const LEASE_MIN = 15;
const NO_CITED = "No cited explanation could be drawn from the available country sources.";

type Admin = (typeof import("@/integrations/supabase/client.server"))["supabaseAdmin"];

class GatewayStop extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export async function runPeerAnalysis(opts: { force?: boolean } = {}) {
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  const now = new Date();

  const { data: run } = await db.from("peer_analysis_runs").select("*").eq("name", RUN).maybeSingle();
  if (run?.status === "paused" && !opts.force) {
    return { ok: false, skipped: "paused", reason: run.pause_reason };
  }
  // Acquire lease atomically.
  const leaseUntil = new Date(now.getTime() + LEASE_MIN * 60_000).toISOString();
  const { data: got } = await db
    .from("peer_analysis_runs")
    .update({ status: "running", lease_until: leaseUntil, last_started_at: now.toISOString(), pause_reason: null, updated_at: now.toISOString() })
    .eq("name", RUN)
    .or(`lease_until.is.null,lease_until.lt.${now.toISOString()}`)
    .select("name");
  if (!got?.length) return { ok: false, skipped: "already running" };

  const summary: Record<string, number | string> = {};
  try {
    // 1. Scrub (public rows only — peers never see private data).
    const { data: kpis, error } = await db
      .from("country_kpis")
      .select("id,country_code,kpi_code,label,unit,direction,latest_value,latest_period")
      .eq("visibility", "public");
    if (error) throw error;
    const raw = (kpis ?? []) as RawKpi[];
    const norm = scrubKpis(raw, now);
    await upsertChunks(db, "peer_kpi_normalized", norm.map((n) => ({ ...n, updated_at: now.toISOString() })), "country_code,kpi_code");
    summary.scrubbed = norm.length;
    summary.excluded = norm.filter((n) => n.excluded_reason).length;
    summary.outliers = norm.filter((n) => n.outlier_flag).length;

    // 2. Deterministic benchmarks.
    const meta = new Map<string, { label: string; unit: string; direction: string | null }>();
    for (const r of raw) if (!meta.has(r.kpi_code)) meta.set(r.kpi_code, { label: r.label, unit: r.unit, direction: r.direction });
    const bench = computeBenchmarks(norm, meta);
    await upsertChunks(db, "peer_benchmarks", bench.map((b) => ({ ...b, computed_at: now.toISOString() })), "country_code,kpi_code");
    summary.benchmarks = bench.length;
    summary.meaningful = bench.filter((b) => b.meaningful).length;

    // 3. AI explanations for meaningful gaps whose inputs changed.
    const { data: existing } = await db.from("peer_gap_explanations").select("country_code,kpi_code,input_hash");
    const done = new Set((existing ?? []).map((e) => `${e.country_code}|${e.kpi_code}|${e.input_hash}`));
    const todo = bench.filter((b) => b.meaningful && !done.has(`${b.country_code}|${b.kpi_code}|${b.input_hash}`));
    summary.pending = todo.length;
    let explained = 0;
    const { data: countries } = await db.from("countries").select("code,name");
    const names = new Map((countries ?? []).map((c) => [c.code, c.name]));
    for (const b of todo.slice(0, EXPLAIN_BATCH)) {
      const { data: sources } = await db
        .from("country_sources")
        .select("title,url,org")
        .eq("country_code", b.country_code)
        .eq("visibility", "public")
        .not("url", "is", null)
        .limit(25);
      const result = await explainGap(b, names, (sources ?? []).filter((s) => s.url?.startsWith("https://")) as Array<{ title: string | null; url: string; org: string | null }>);
      // A null result (no cited drivers) is recorded too, so it is not retried until inputs change.
      await db.from("peer_gap_explanations").upsert(
        { country_code: b.country_code, kpi_code: b.kpi_code, input_hash: b.input_hash, drivers: result?.drivers ?? [], unknowns: result?.unknowns ?? NO_CITED, citations: result?.citations ?? [], model: MODEL, created_at: new Date().toISOString() },
        { onConflict: "country_code,kpi_code" },
      );
      explained++;
    }
    summary.explained = explained;
    summary.remaining = Math.max(0, todo.length - explained);

    await db.from("peer_analysis_runs").update({ status: "idle", lease_until: null, last_finished_at: new Date().toISOString(), last_summary: summary as never, updated_at: new Date().toISOString() }).eq("name", RUN);
    return { ok: true, summary };
  } catch (e) {
    const paused = e instanceof GatewayStop && (e.status === 402 || e.status === 403);
    const msg = e instanceof Error ? e.message : String(e);
    await db.from("peer_analysis_runs").update({
      status: paused ? "paused" : "idle",
      pause_reason: paused ? msg : null,
      lease_until: null,
      last_finished_at: new Date().toISOString(),
      last_summary: { ...summary, error: msg } as never,
      updated_at: new Date().toISOString(),
    }).eq("name", RUN);
    return { ok: false, error: msg, summary };
  }
}

async function upsertChunks(db: Admin, table: "peer_kpi_normalized" | "peer_benchmarks", rows: object[], onConflict: string) {
  for (let i = 0; i < rows.length; i += 200) {
    const { error } = await db.from(table).upsert(rows.slice(i, i + 200) as never, { onConflict });
    if (error) throw new Error(`${table}: ${error.message}`);
  }
}

type Explained = { drivers: Array<{ text: string; refs: number[] }>; unknowns: string; citations: Array<{ title: string; url: string }> };

async function explainGap(b: PeerBenchmark, names: Map<string, string>, sources: Array<{ title: string | null; url: string; org: string | null }>): Promise<Explained | null> {
  if (!sources.length) return null;
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new GatewayStop(401, "Lovable AI is not configured");
  const peers = b.peer_values.map((p) => `${names.get(p.code) ?? p.code}: ${p.value.toFixed(2)}`).join("; ");
  const srcList = sources.map((s, i) => `[${i + 1}] ${s.title ?? s.org ?? "Source"} — ${s.url}`).join("\n");
  const prompt = `Country: ${names.get(b.country_code) ?? b.country_code}
Indicator: ${b.label} (${b.unit}), reference year ${b.ref_year ?? "n/a"}
Value: ${b.value.toFixed(2)}; Caribbean peer median ${b.median.toFixed(2)} (n=${b.n}); gap ${b.gap.toFixed(2)}; robust z ${b.z?.toFixed(2)}; this gap is ${b.favourable == null ? "neutral" : b.favourable ? "favourable" : "unfavourable"}.
Peer values: ${peers}

Numbered sources for this country:
${srcList}

Give 2-3 concise, evidence-bounded likely drivers (max 30 words each) for why this country sits ${b.gap > 0 ? "above" : "below"} the Caribbean median. Each driver must cite one or more source numbers from the list. State plainly what is unknown. Do not give advice. Do not mention any software platform.`;

  const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "fetch" },
    body: JSON.stringify({
      model: MODEL,
      input: prompt,
      stream: true,
      store: false,
      reasoning: { effort: "low" },
      text: {
        format: {
          type: "json_schema",
          name: "gap_explanation",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            required: ["drivers", "unknowns"],
            properties: {
              drivers: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: ["text", "refs"],
                  properties: { text: { type: "string" }, refs: { type: "array", items: { type: "integer" } } },
                },
              },
              unknowns: { type: "string" },
            },
          },
        },
      },
    }),
  });
  if (!res.ok || !res.body) {
    const t = await res.text().catch(() => "");
    if (res.status === 402 || res.status === 403 || res.status === 429) throw new GatewayStop(res.status === 429 ? 429 : res.status, `AI ${res.status}: ${t.slice(0, 200)}`);
    console.error(`peer explain failed [${res.status}]: ${t.slice(0, 300)}`);
    return null;
  }
  const text = await readSseText(res.body);
  let parsed: { drivers?: Array<{ text: string; refs: number[] }>; unknowns?: string };
  try { parsed = JSON.parse(text); } catch { return null; }
  // Renumber to the cited subset so [N] indexes the stored citations array.
  const used = new Map<number, number>();
  const citations: Array<{ title: string; url: string }> = [];
  const drivers = (parsed.drivers ?? []).slice(0, 3).map((d) => {
    const refs = (d.refs ?? []).filter((r) => r >= 1 && r <= sources.length).map((r) => {
      if (!used.has(r)) { used.set(r, citations.length + 1); citations.push({ title: sources[r - 1].title ?? sources[r - 1].org ?? "Source", url: sources[r - 1].url }); }
      return used.get(r) as number;
    });
    return { text: String(d.text ?? "").replace(/\s*\[[\d,\s]+\]/g, "").trim(), refs };
  }).filter((d) => d.text && d.refs.length);
  if (!drivers.length) return null;
  return { drivers, unknowns: String(parsed.unknowns ?? ""), citations };
}

async function readSseText(body: ReadableStream<Uint8Array>): Promise<string> {
  const reader = body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let out = "";
  let completed = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const ev = JSON.parse(payload) as { type?: string; delta?: string; response?: { output_text?: string } };
        if (ev.type === "response.output_text.delta" && ev.delta) out += ev.delta;
        if (ev.type === "response.completed" && ev.response?.output_text) completed = ev.response.output_text;
      } catch { /* ignore */ }
    }
  }
  return out || completed;
}
