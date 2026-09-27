// @domain portfolio
// @tables kpis,kpi_setup_sessions,ministries,ministry_sectors,country_sectors,country_kpis,peer_benchmarks,goal_cycles,ministry_profiles
// @ui src/components/portfolio/KpiSetupModal.tsx

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";

type Sb = SupabaseClient<Database>;

export type Proposal = {
  key: string;
  metric: string;
  unit: string;
  sector_code: string;
  source_kpi_code: string | null;
  direction: "up" | "down" | "flat";
  baseline: number | null;
  baseline_period: string;
  target: number;
  target_period: string;
  target_basis: "policy_commitment" | "peer_benchmark" | "approved_scenario";
  cadence: "monthly" | "quarterly" | "annual";
  warning_tolerance_pct: number;
  critical_tolerance_pct: number;
  evidence_url: string;
  rationale: string;
  peer_median: number | null;
  inferred: boolean;
  checks: string[];
  decision: "pending" | "accepted" | "rejected";
  actual: number | null;
  actual_period: string;
};

export type SetupDraft = { proposals: Proposal[]; aiNote?: string };

const CtxInput = z.object({ countryCode: z.string().min(2).max(4), ministrySlug: z.string().min(1) });

async function assertAccess(sb: Sb, userId: string, countryCode: string, write = false) {
  const { data: admin } = await sb.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (admin) return;
  if (write) {
    const { data: cab } = await sb.rpc("has_role", { _user_id: userId, _role: "cabinet_secretary" });
    if (cab) return;
    throw new Error("Forbidden: only admins or the cabinet secretary can set up scorecards");
  }
  const { data: ok } = await sb.rpc("has_country_access", { _user_id: userId, _country_code: countryCode });
  if (!ok) throw new Error("Forbidden: no access to this country");
}

async function loadContext(sb: Sb, countryCode: string, ministrySlug: string) {
  const { data: ministry, error } = await sb
    .from("ministries")
    .select("id,name,slug")
    .eq("country_code", countryCode)
    .eq("slug", ministrySlug)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!ministry) throw new Error("Ministry not found");
  const [ms, cs, ck, pb, existing, session, prof, country] = await Promise.all([
    sb.from("ministry_sectors").select("sector_code,weight").eq("ministry_id", ministry.id),
    sb.from("country_sectors").select("sector_code,share_pct").eq("country_code", countryCode),
    sb
      .from("country_kpis")
      .select("kpi_code,label,unit,direction,category,latest_value,latest_period,target,source_url,provenance,confidence")
      .eq("country_code", countryCode),
    sb.from("peer_benchmarks").select("kpi_code,median,n,ref_year").eq("country_code", countryCode),
    sb
      .from("kpis")
      .select("id,metric,unit,target,target_period,verification_status,source")
      .eq("country_code", countryCode)
      .eq("ministry_id", ministry.id),
    sb.from("kpi_setup_sessions").select("*").eq("country_code", countryCode).eq("ministry_id", ministry.id).maybeSingle(),
    sb.from("ministry_profiles").select("minister,mandate").eq("country_code", countryCode).eq("ministry_slug", ministrySlug).maybeSingle(),
    sb.from("countries").select("name").eq("code", countryCode).maybeSingle(),
  ]);
  const shares = new Map<string, number>((cs.data ?? []).map((r: { sector_code: string; share_pct: number }) => [r.sector_code, Number(r.share_pct)]));
  const sectors = (ms.data ?? []).map((r: { sector_code: string }) => ({
    code: r.sector_code,
    share_pct: shares.get(r.sector_code) ?? null,
  }));
  const peers = new Map<string, { median: number; n: number }>(
    (pb.data ?? []).map((p: { kpi_code: string; median: number | null; n: number }) => [p.kpi_code, { median: Number(p.median), n: p.n }]),
  );
  const indicators = (ck.data ?? []).map((k: Record<string, unknown>) => ({
    kpi_code: k.kpi_code as string,
    label: k.label as string,
    unit: (k.unit as string) ?? "",
    direction: (k.direction as string) ?? null,
    category: (k.category as string) ?? null,
    latest_value: k.latest_value == null ? null : Number(k.latest_value),
    latest_period: (k.latest_period as string) ?? null,
    target: k.target == null ? null : Number(k.target),
    source_url: (k.source_url as string) ?? null,
    inferred: String(k.provenance ?? "").includes("infer"),
    peer_median: peers.get(k.kpi_code as string)?.median ?? null,
  }));
  const gaps: string[] = [];
  if (!sectors.length) gaps.push("No sectors are mapped to this ministry.");
  if (!indicators.some((i: { target: number | null }) => i.target != null)) gaps.push("No national targets are on file.");
  if (!indicators.length) gaps.push("No national indicators are recorded for this country.");
  if (!(existing.data ?? []).length) gaps.push("This ministry has no delivery KPIs yet.");
  return {
    country: { code: countryCode, name: (country.data?.name as string) ?? countryCode },
    ministry,
    minister: (prof.data?.minister as string) ?? null,
    mandate: prof.data?.mandate ? String(prof.data.mandate).slice(0, 1200) : null,
    sectors,
    gdpExposure: sectors.reduce((s: number, x: { share_pct: number | null }) => s + (x.share_pct ?? 0), 0),
    indicators,
    existing: existing.data ?? [],
    session: session.data
      ? { step: session.data.step as number, status: session.data.status as string, draft: session.data.draft as unknown as SetupDraft }
      : null,
    gaps,
  };
}

export type SetupContext = Awaited<ReturnType<typeof loadContext>>;

export const getSetupContext = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => CtxInput.parse(v))
  .handler(async ({ data, context }) => {
    await assertAccess(context.supabase, context.userId, data.countryCode);
    return loadContext(context.supabase, data.countryCode, data.ministrySlug);
  });

// ---------------- AI draft ----------------

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["kpis", "note"],
  properties: {
    note: { type: "string" },
    kpis: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "metric", "unit", "sector_code", "source_kpi_code", "direction", "baseline", "baseline_period",
          "target", "target_period", "target_basis", "cadence", "evidence_url", "rationale",
        ],
        properties: {
          metric: { type: "string" },
          unit: { type: "string" },
          sector_code: { type: "string" },
          source_kpi_code: { type: ["string", "null"] },
          direction: { type: "string", enum: ["up", "down", "flat"] },
          baseline: { type: ["number", "null"] },
          baseline_period: { type: "string" },
          target: { type: "number" },
          target_period: { type: "string" },
          target_basis: { type: "string", enum: ["policy_commitment", "peer_benchmark", "approved_scenario"] },
          cadence: { type: "string", enum: ["monthly", "quarterly", "annual"] },
          evidence_url: { type: ["string", "null"] },
          rationale: { type: "string" },
        },
      },
    },
  },
} as const;

async function readSse(body: ReadableStream<Uint8Array>): Promise<string> {
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
      } catch {
        /* ignore */
      }
    }
  }
  return out || completed;
}

function isUrl(s: unknown): s is string {
  return typeof s === "string" && /^https:\/\/\S+$/.test(s);
}

export const draftScorecard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => CtxInput.parse(v))
  .handler(async ({ data, context }) => {
    await assertAccess(context.supabase, context.userId, data.countryCode, true);
    const ctx = await loadContext(context.supabase, data.countryCode, data.ministrySlug);
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("AI is not configured for this workspace.");
    const year = new Date().getUTCFullYear();
    const prompt = `You draft a delivery scorecard for a government ministry. Use ONLY the data below.
Country: ${ctx.country.name} (${ctx.country.code}). Ministry: ${ctx.ministry.name}. Minister: ${ctx.minister ?? "unknown"}.
Mapped sectors (code: GDP share %): ${ctx.sectors.map((s) => `${s.code}: ${s.share_pct ?? "?"}`).join("; ") || "none"}.
Mandate excerpt: ${ctx.mandate ?? "none on file"}.
National indicators (kpi_code | label | unit | direction | latest value @ period | target | source | Caribbean peer median):
${ctx.indicators.map((i) => `${i.kpi_code} | ${i.label} | ${i.unit} | ${i.direction ?? "?"} | ${i.latest_value ?? "?"} @ ${i.latest_period ?? "?"} | ${i.target ?? "-"} | ${i.source_url ?? "-"} | ${i.peer_median ?? "-"}`).join("\n") || "none"}
Existing ministry KPIs: ${ctx.existing.map((e: { metric: string }) => e.metric).join("; ") || "none"}.

Propose 3 to 6 KPIs this ministry can plausibly be held accountable for. Prefer indicators from the list: set source_kpi_code to the matching kpi_code and copy its latest value as baseline and its period as baseline_period. Only use sector_code values from the mapped sectors (or "ALL" if none). Target period should be ${year + 2} or ${year + 3} unless a national target implies otherwise. target_basis: policy_commitment only if the mandate or a national target supports it; peer_benchmark if based on the peer median; otherwise approved_scenario. evidence_url must be a source URL from the list or null. Rationale under 40 words, factual. Do not invent figures you cannot derive; use null baseline if unknown. note: one sentence on data gaps.`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "fetch" },
      body: JSON.stringify({
        model: "openai/gpt-6-astra",
        input: prompt,
        stream: true,
        store: false,
        reasoning: { effort: "low" },
        text: { format: { type: "json_schema", name: "scorecard", strict: true, schema: SCHEMA } },
      }),
    });
    if (!res.ok || !res.body) {
      const t = await res.text().catch(() => "");
      if (res.status === 402) throw new Error("AI credits are exhausted for this workspace. Add credits, then try again.");
      if (res.status === 429) throw new Error("AI is busy right now. Please wait a minute and try again.");
      if (res.status === 403) throw new Error(`AI access was denied: ${t.slice(0, 200)}`);
      throw new Error(`AI draft failed (${res.status}).`);
    }
    const text = await readSse(res.body);
    let parsed: { kpis?: Array<Record<string, unknown>>; note?: string };
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error("The AI response could not be read. Please try again.");
    }
    const byCode = new Map(ctx.indicators.map((i) => [i.kpi_code, i]));
    const sectorCodes = new Set(ctx.sectors.map((s) => s.code));
    const proposals: Proposal[] = (parsed.kpis ?? []).slice(0, 6).map((k, idx) => {
      const ind = typeof k.source_kpi_code === "string" ? byCode.get(k.source_kpi_code) : undefined;
      const checks: string[] = [];
      let baseline = typeof k.baseline === "number" ? k.baseline : null;
      let baselinePeriod = String(k.baseline_period ?? "");
      let evidence = isUrl(k.evidence_url) ? k.evidence_url : "";
      let inferred = false;
      if (ind) {
        if (ind.latest_value != null && (baseline == null || Math.abs(baseline - ind.latest_value) > 1e-6)) {
          checks.push(`Baseline corrected to stored value ${ind.latest_value}.`);
          baseline = ind.latest_value;
        }
        if (ind.latest_period) baselinePeriod = ind.latest_period;
        if (!evidence && ind.source_url && isUrl(ind.source_url)) evidence = ind.source_url;
        if (ind.inferred) inferred = true;
      } else {
        inferred = true;
        checks.push("Not linked to a stored indicator — confirm figures.");
      }
      if (!evidence) {
        inferred = true;
        checks.push("No source link — add evidence before approval.");
      }
      let sector = String(k.sector_code ?? "");
      if (sectorCodes.size && !sectorCodes.has(sector)) sector = [...sectorCodes][0];
      if (!sector) sector = "ALL";
      return {
        key: `${idx}-${String(k.metric ?? "").slice(0, 20)}`,
        metric: String(k.metric ?? "").slice(0, 200),
        unit: String(k.unit ?? ind?.unit ?? "").slice(0, 32) || "value",
        sector_code: sector,
        source_kpi_code: ind?.kpi_code ?? null,
        direction: (["up", "down", "flat"].includes(String(k.direction)) ? k.direction : "up") as Proposal["direction"],
        baseline,
        baseline_period: baselinePeriod,
        target: Number(k.target ?? 0),
        target_period: String(k.target_period ?? year + 2),
        target_basis: (k.target_basis as Proposal["target_basis"]) ?? "approved_scenario",
        cadence: (k.cadence as Proposal["cadence"]) ?? "annual",
        warning_tolerance_pct: 10,
        critical_tolerance_pct: 20,
        evidence_url: evidence,
        rationale: String(k.rationale ?? "").slice(0, 400),
        peer_median: ind?.peer_median ?? null,
        inferred,
        checks,
        decision: "pending" as const,
        actual: ind?.latest_value ?? null,
        actual_period: ind?.latest_period ?? "",
      };
    }).filter((p) => p.metric);
    const draft: SetupDraft = { proposals, aiNote: parsed.note };
    await context.supabase.from("kpi_setup_sessions").upsert(
      {
        country_code: data.countryCode,
        ministry_id: ctx.ministry.id,
        step: 3,
        status: "ai_drafted",
        draft: draft as unknown as Json,
        created_by: context.userId,
      },
      { onConflict: "country_code,ministry_id" },
    );
    return draft;
  });

// ---------------- Save + submit ----------------

const SaveInput = z.object({
  countryCode: z.string().min(2).max(4),
  ministryId: z.string().uuid(),
  step: z.number().int().min(1).max(5),
  draft: z.any(),
});

export const saveSetupSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => SaveInput.parse(v))
  .handler(async ({ data, context }) => {
    await assertAccess(context.supabase, context.userId, data.countryCode, true);
    const { error } = await context.supabase.from("kpi_setup_sessions").upsert(
      {
        country_code: data.countryCode,
        ministry_id: data.ministryId,
        step: data.step,
        draft: data.draft as Json,
        created_by: context.userId,
      },
      { onConflict: "country_code,ministry_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export function checklist(p: Proposal): string[] {
  const missing: string[] = [];
  if (!p.metric.trim()) missing.push("Name");
  if (p.baseline == null) missing.push("Baseline value");
  if (!p.baseline_period.trim()) missing.push("Baseline period");
  if (!Number.isFinite(p.target)) missing.push("Target");
  if (!p.target_period.trim()) missing.push("Target period");
  if (!/^https:\/\/\S+$/.test(p.evidence_url)) missing.push("Evidence link (https)");
  if (p.critical_tolerance_pct < p.warning_tolerance_pct) missing.push("Tolerances");
  return missing;
}

export const submitScorecard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => SaveInput.parse(v))
  .handler(async ({ data, context }) => {
    await assertAccess(context.supabase, context.userId, data.countryCode, true);
    const draft = data.draft as SetupDraft;
    const accepted = (draft.proposals ?? []).filter((p) => p.decision === "accepted");
    if (!accepted.length) throw new Error("Accept at least one KPI before submitting.");
    for (const p of accepted) {
      const miss = checklist(p);
      if (miss.length) throw new Error(`“${p.metric}” is missing: ${miss.join(", ")}`);
    }
    const { data: existing } = await context.supabase
      .from("kpis")
      .select("id,metric,verification_status")
      .eq("country_code", data.countryCode)
      .eq("ministry_id", data.ministryId);
    const norm = (s: string) => s.trim().toLowerCase();
    const byMetric = new Map((existing ?? []).map((e) => [norm(e.metric), e]));
    let saved = 0;
    for (const p of accepted) {
      const row = {
        country_code: data.countryCode,
        ministry_id: data.ministryId,
        sector_code: p.sector_code,
        metric: p.metric.trim(),
        unit: p.unit,
        baseline: p.baseline,
        baseline_period: p.baseline_period,
        target: p.target,
        target_period: p.target_period,
        direction: p.direction,
        target_basis: p.target_basis,
        cadence: p.cadence,
        evidence_url: p.evidence_url,
        warning_tolerance_pct: p.warning_tolerance_pct,
        critical_tolerance_pct: p.critical_tolerance_pct,
        source: "ai",
        ai_rationale: p.rationale,
        peer_median: p.peer_median,
        source_kpi_code: p.source_kpi_code,
        inferred: p.inferred,
        verification_status: "submitted",
        verified_by: null,
        verified_at: null,
        owner_id: context.userId,
      };
      const prior = byMetric.get(norm(p.metric));
      let id: string;
      if (prior) {
        if (prior.verification_status === "qualified") continue; // never overwrite qualified KPIs
        const { error } = await context.supabase.from("kpis").update(row).eq("id", prior.id);
        if (error) throw new Error(error.message);
        id = prior.id;
      } else {
        const { data: ins, error } = await context.supabase.from("kpis").insert(row).select("id").single();
        if (error) throw new Error(error.message);
        id = ins.id;
      }
      if (p.actual != null && p.actual_period.trim()) {
        await context.supabase.from("goal_cycles").upsert(
          {
            kpi_id: id,
            period: p.actual_period.trim(),
            figures: { actual: p.actual } as Json,
            status: "reported",
            created_by: context.userId,
          },
          { onConflict: "kpi_id,period" },
        );
      }
      saved++;
    }
    await context.supabase.from("kpi_setup_sessions").upsert(
      {
        country_code: data.countryCode,
        ministry_id: data.ministryId,
        step: 5,
        status: "submitted",
        draft: draft as unknown as Json,
        created_by: context.userId,
      },
      { onConflict: "country_code,ministry_id" },
    );
    return { saved };
  });
