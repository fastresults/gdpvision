// Pass F — AI inference for KPIs still unresolved after Passes A-E.
//
// Uses a reasoning model (Gemini 2.5 Pro via Lovable AI Gateway, GPT-5.5 fallback)
// to estimate a value from adjacent context:
//   - already-resolved KPIs for THIS country
//   - top RAG chunks from country_source_chunks (semantic search)
//   - peer-country values for structurally similar countries (region / income group)
//   - registry entry (unit, bounds, direction)
//
// Output is stored with provenance='inferred', a rationale, evidence list,
// and a confidence tier. Admins review each inference and can accept, override,
// reject, or re-infer via the Data → KPIs tab.

import { findRegistryEntry, isPlausible, type KpiRegistryEntry } from "./kpi-registry";

export type InferenceResult = {
  kpi_code: string;
  value: number | null;
  period: string | null;
  confidence: "low" | "medium" | "high";
  rationale: string;
  assumptions: string[];
  evidence: Array<{ kind: string; ref: string; note: string; url?: string }>;
  model: string;
  source_url: string | null;
  source_org: string | null;
};

export type InferenceAttempt = {
  kpi_code: string;
  ok: boolean;
  model: string;
  value: number | null;
  period: string | null;
  source_url: string | null;
  error: string | null;
};

const PRIMARY_MODEL = "google/gemini-2.5-pro";
const FALLBACK_MODEL = "openai/gpt-5.5";

// ============================================================
// Context builders (best-effort — inference degrades gracefully)
// ============================================================

async function loadResolvedKpis(admin: any, countryCode: string) {
  const { data } = await admin
    .from("country_kpis")
    .select("kpi_code, label, unit, latest_value, latest_period")
    .eq("country_code", countryCode)
    .not("latest_value", "is", null);
  return (data ?? []) as Array<{
    kpi_code: string;
    label: string;
    unit: string | null;
    latest_value: number;
    latest_period: string | null;
  }>;
}

async function loadPeerCountryValues(
  admin: any,
  countryCode: string,
  kpi_code: string,
): Promise<Array<{ country_code: string; country_name: string; value: number; period: string | null }>> {
  const { data: self } = await admin
    .from("countries")
    .select("region, income_group")
    .eq("code", countryCode)
    .maybeSingle();
  if (!self) return [];

  let peerQ = admin
    .from("countries")
    .select("code, name, region, income_group")
    .neq("code", countryCode);
  if ((self as any).region) peerQ = peerQ.eq("region", (self as any).region);
  const { data: peers } = await peerQ.limit(20);
  const codes = (peers ?? []).map((p: any) => p.code);
  if (!codes.length) return [];

  const { data: rows } = await admin
    .from("country_kpis")
    .select("country_code, latest_value, latest_period")
    .in("country_code", codes)
    .eq("kpi_code", kpi_code)
    .not("latest_value", "is", null)
    .limit(10);

  const nameByCode = new Map((peers ?? []).map((p: any) => [p.code, p.name]));
  return (rows ?? []).map((r: any) => ({
    country_code: r.country_code,
    country_name: nameByCode.get(r.country_code) ?? r.country_code,
    value: r.latest_value,
    period: r.latest_period,
  }));
}

async function loadRagChunks(
  admin: any,
  countryCode: string,
  kpi: KpiRegistryEntry,
): Promise<Array<{ content: string; source_url: string; source_org: string }>> {
  try {
    const { embedBatch } = await import("./ingest.server");
    const [emb] = await embedBatch([`${kpi.label} ${kpi.kpi_code} ${kpi.unit}`]);
    const vec = `[${emb.join(",")}]`;
    const { data: rows } = await admin.rpc("country_chunks_search", {
      _country_code: countryCode,
      _query_embedding: vec,
      _limit: 5,
    });
    return ((rows ?? []) as any[]).map((r) => ({
      content: (r.content as string).slice(0, 700),
      source_url: r.source_url,
      source_org: r.source_org,
    }));
  } catch {
    return [];
  }
}

// ============================================================
// Model call
// ============================================================

type ModelJson = {
  value: number | null;
  period: string | null;
  confidence: "low" | "medium" | "high";
  rationale: string;
  assumptions: string[];
  evidence: Array<{ kind: string; ref: string; note: string; url?: string }>;
  suggested_source_url?: string | null;
  suggested_source_org?: string | null;
};

async function callInferenceModel(args: {
  model: string;
  country: { name: string; iso3: string | null; code: string };
  kpi: KpiRegistryEntry;
  resolved: Awaited<ReturnType<typeof loadResolvedKpis>>;
  peers: Awaited<ReturnType<typeof loadPeerCountryValues>>;
  chunks: Awaited<ReturnType<typeof loadRagChunks>>;
}): Promise<ModelJson | null> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY not configured");

  const resolvedBlock = args.resolved.length
    ? args.resolved
        .slice(0, 20)
        .map((r) => `- ${r.kpi_code} = ${r.latest_value} ${r.unit ?? ""} (${r.latest_period ?? "?"}) — ${r.label}`)
        .join("\n")
    : "(none)";
  const peerBlock = args.peers.length
    ? args.peers
        .map((p) => `- ${p.country_name} (${p.country_code}): ${p.value} ${args.kpi.unit} (${p.period ?? "?"})`)
        .join("\n")
    : "(no peer values available)";
  const chunkBlock = args.chunks.length
    ? args.chunks
        .map((c, i) => `[${i + 1}] ${c.source_org} — ${c.source_url}\n${c.content}`)
        .join("\n\n")
    : "(no ingested chunks matched)";

  const system = `You are a national statistics inference engine. Estimate the most likely current value for a KPI that could NOT be found from authoritative primary sources after a full research pass.

RULES:
- Reason from the provided evidence: this country's other resolved KPIs, peer-country values for structurally similar countries, and retrieved document chunks.
- The estimate MUST fall inside the plausibility bounds [${args.kpi.value_bounds.min}, ${args.kpi.value_bounds.max}] in unit "${args.kpi.unit}".
- Set confidence honestly: "high" only if multiple independent signals converge; "low" if you are extrapolating from one indirect signal.
- If you cannot make a defensible estimate, set value=null and explain why in rationale.
- Rationale MUST be 2-5 sentences a policy advisor could read.
- List concrete assumptions.
- Cite every evidence item you actually used (kind = "resolved_kpi" | "peer_country" | "chunk" | "reasoning"; ref = kpi_code or country_code or chunk index; url only for chunk).
- If you know a public URL where this figure is likely published (e.g. national stats office), put it in suggested_source_url — the admin will decide whether to add it.

Return ONE JSON object, no prose, no code fence.`;

  const user = `Country: ${args.country.name} (${args.country.iso3 ?? args.country.code}).
KPI to estimate: ${args.kpi.label} (${args.kpi.kpi_code}), unit ${args.kpi.unit}, direction "${args.kpi.direction}", expected period shape "${args.kpi.expected_period_shape}".

Resolved KPIs for this country:
${resolvedBlock}

Peer-country values for the same KPI (same region):
${peerBlock}

Top retrieved chunks from this country's ingested corpus:
${chunkBlock}

Return JSON:
{
  "value": number|null,
  "period": string|null,
  "confidence": "low"|"medium"|"high",
  "rationale": string,
  "assumptions": string[],
  "evidence": [{"kind": string, "ref": string, "note": string, "url": string|null}],
  "suggested_source_url": string|null,
  "suggested_source_org": string|null
}`;

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: args.model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) throw new Error(`Gateway ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const json = (await res.json()) as any;
  const content = (json?.choices?.[0]?.message?.content ?? "") as string;
  return parseJsonLoose(content);
}

function parseJsonLoose(content: string): ModelJson | null {
  if (!content) return null;
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = (fenced?.[1] ?? content).trim();
  const start = raw.indexOf("{");
  if (start === -1) return null;
  try {
    return JSON.parse(raw.slice(start));
  } catch {
    return null;
  }
}

// ============================================================
// Public API
// ============================================================

export async function inferOneKpi(args: {
  admin: any;
  country: { code: string; name: string; iso3: string | null };
  kpi: KpiRegistryEntry;
}): Promise<{ result: InferenceResult | null; attempt: InferenceAttempt }> {
  const [resolved, peers, chunks] = await Promise.all([
    loadResolvedKpis(args.admin, args.country.code),
    loadPeerCountryValues(args.admin, args.country.code, args.kpi.kpi_code),
    loadRagChunks(args.admin, args.country.code, args.kpi),
  ]);

  let model = PRIMARY_MODEL;
  let parsed: ModelJson | null = null;
  try {
    parsed = await callInferenceModel({ model, country: args.country, kpi: args.kpi, resolved, peers, chunks });
  } catch {
    // Fallback to secondary model on any transport/model failure.
    try {
      model = FALLBACK_MODEL;
      parsed = await callInferenceModel({ model, country: args.country, kpi: args.kpi, resolved, peers, chunks });
    } catch (err) {
      return {
        result: null,
        attempt: {
          kpi_code: args.kpi.kpi_code,
          ok: false,
          model,
          value: null,
          period: null,
          source_url: null,
          error: (err as Error).message.slice(0, 400),
        },
      };
    }
  }

  if (!parsed || parsed.value == null || !Number.isFinite(parsed.value)) {
    return {
      result: null,
      attempt: {
        kpi_code: args.kpi.kpi_code,
        ok: false,
        model,
        value: null,
        period: parsed?.period ?? null,
        source_url: parsed?.suggested_source_url ?? null,
        error: parsed?.rationale?.slice(0, 300) ?? "no value produced",
      },
    };
  }

  // Enforce registry sanity bounds.
  if (!isPlausible(args.kpi.kpi_code, parsed.value)) {
    const entry = findRegistryEntry(args.kpi.kpi_code);
    return {
      result: null,
      attempt: {
        kpi_code: args.kpi.kpi_code,
        ok: false,
        model,
        value: parsed.value,
        period: parsed.period,
        source_url: parsed.suggested_source_url ?? null,
        error: `inferred value out of bounds [${entry?.value_bounds.min}, ${entry?.value_bounds.max}]`,
      },
    };
  }

  const result: InferenceResult = {
    kpi_code: args.kpi.kpi_code,
    value: parsed.value,
    period: parsed.period,
    confidence: parsed.confidence ?? "low",
    rationale: parsed.rationale ?? "",
    assumptions: Array.isArray(parsed.assumptions) ? parsed.assumptions : [],
    evidence: Array.isArray(parsed.evidence) ? parsed.evidence : [],
    model,
    source_url: parsed.suggested_source_url ?? null,
    source_org: parsed.suggested_source_org ?? null,
  };

  // Best-effort: queue any suggested_source_url as a source candidate for admin approval.
  if (result.source_url) {
    try {
      await args.admin.from("source_candidates").upsert(
        {
          country_code: args.country.code,
          url: result.source_url,
          title: result.source_org ? `${result.source_org} — suggested for ${args.kpi.kpi_code}` : null,
          suggested_by_model: model,
          suggested_for_kpi: args.kpi.kpi_code,
          rationale: result.rationale.slice(0, 500),
          status: "pending",
        },
        { onConflict: "country_code,url", ignoreDuplicates: true },
      );
    } catch {
      /* best-effort */
    }
  }

  return {
    result,
    attempt: {
      kpi_code: args.kpi.kpi_code,
      ok: true,
      model,
      value: result.value,
      period: result.period,
      source_url: result.source_url,
      error: null,
    },
  };
}
