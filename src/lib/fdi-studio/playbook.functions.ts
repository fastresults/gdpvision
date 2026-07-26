// @domain fdi-studio
// @tables fdi_playbooks,fdi_playbook_actions,fdi_strategies,fdi_threats,ministries,ministry_sectors,country_kpis
// @ui src/components/studio/PlaybookTimeline.tsx

// Generate a 30d / 3m / 6m / 12m ministry-owned playbook from either an
// FDI strategy or a macro country rollup. Uses Gemini structured output
// keyed to real ministries + KPIs so nothing hallucinates.

import { createServerFn } from "@tanstack/react-start";
import { generateText, Output } from "ai";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

const HORIZONS = ["30d", "3m", "6m", "12m"] as const;
type Horizon = (typeof HORIZONS)[number];

const GenerateInput = z.object({
  countryCode: z.string().min(2).max(4),
  strategyId: z.string().uuid().optional(),
  scope: z.enum(["macro", "strategy"]).default("macro"),
});

const ListInput = z.object({ countryCode: z.string().min(2).max(4), strategyId: z.string().uuid().optional() });

const UpdateActionInput = z.object({
  actionId: z.string().uuid(),
  countryCode: z.string().min(2).max(4),
  patch: z.object({
    action: z.string().optional(),
    investor_signal: z.string().optional(),
    kpi_target: z.string().optional(),
    ministry_slug: z.string().nullable().optional(),
    status: z.enum(["proposed", "in_flight", "done", "blocked", "dropped"]).optional(),
  }),
});

export interface PlaybookAction {
  id: string;
  horizon: Horizon;
  sector_code: string | null;
  ministry_id: string | null;
  ministry_slug: string | null;
  ministry_name: string | null;
  action: string;
  investor_signal: string | null;
  kpi_id: string | null;
  kpi_target: string | null;
  status: "proposed" | "in_flight" | "done" | "blocked" | "dropped";
  sort_order: number;
}

export interface PlaybookRow {
  id: string;
  country_code: string;
  strategy_id: string | null;
  scope: "macro" | "strategy" | "sector";
  sector_code: string | null;
  title: string;
  summary: string | null;
  actions: PlaybookAction[];
  created_at: string;
  updated_at: string;
}

const HORIZON_INTENT: Record<Horizon, string> = {
  "30d": "Signal & unblock — visible investor signals, remove first frictions.",
  "3m": "Structure & de-risk — legal, incentive, and pipeline architecture.",
  "6m": "Land & anchor — first MOUs, first anchor investors, first proof points.",
  "12m": "Compound & measure — inflow, jobs, KPI targets hit; institutionalise.",
};

async function loadContext(supabase: any, code: string, strategyId?: string) {
  const [{ data: country }, { data: ministries }, { data: kpis }, { data: sectors }] = await Promise.all([
    supabase.from("countries").select("code,name,gdp_current_usd,currency").eq("code", code).maybeSingle(),
    supabase.from("ministries").select("id,slug,name").eq("country_code", code),
    supabase.from("country_kpis").select("id,slug,label,unit,latest_value,target").eq("country_code", code).limit(30),
    supabase.from("country_sectors").select("sector_code,share_pct,sectors(label)").eq("country_code", code).order("share_pct", { ascending: false }),
  ]);

  let strategy: any = null;
  let threat: any = null;
  if (strategyId) {
    const { data: s } = await supabase
      .from("fdi_strategies")
      .select("id,name,allocation,actions,metrics,fdi_threat_id")
      .eq("id", strategyId)
      .maybeSingle();
    strategy = s;
    if (s?.fdi_threat_id) {
      const { data: t } = await supabase
        .from("fdi_threats")
        .select("id,name,threat_type,severity_pct,target_sector_codes,brief")
        .eq("id", s.fdi_threat_id)
        .maybeSingle();
      threat = t;
    }
  }
  return { country, ministries: ministries ?? [], kpis: kpis ?? [], sectors: sectors ?? [], strategy, threat };
}

// Keep the schema constraint-free (no .min/.max, no formats): bounds are stated
// in the prompt and clamped in code. Bounds inside the schema make an otherwise
// successful gateway call fail post-hoc as AI_NoObjectGeneratedError.
const ActionSchema = z.object({
  horizon: z.string(),
  sector_code: z.string().nullish(),
  ministry_slug: z.string().nullish(),
  action: z.string(),
  investor_signal: z.string().nullish(),
  kpi_slug: z.string().nullish(),
  kpi_target: z.string().nullish(),
});

const PlaybookSchema = z.object({
  title: z.string(),
  summary: z.string(),
  actions: z.array(ActionSchema),
});

type RawPlan = z.infer<typeof PlaybookSchema>;

function normalizeHorizon(v: unknown): Horizon | null {
  const s = String(v ?? "").toLowerCase().replace(/\s+/g, "");
  if (["30d", "30days", "30day", "1m"].includes(s)) return "30d";
  if (["3m", "3months", "3month", "90d"].includes(s)) return "3m";
  if (["6m", "6months", "6month", "180d"].includes(s)) return "6m";
  if (["12m", "12months", "12month", "1y", "1year"].includes(s)) return "12m";
  return null;
}

/** Last-resort parse of raw model text when structured validation fails. */
function parseFallback(text: string | undefined): RawPlan | null {
  if (!text) return null;
  const cleaned = text
    .replace(/^\s*```(?:json)?/i, "")
    .replace(/```\s*$/, "")
    .trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    const parsed = PlaybookSchema.safeParse(JSON.parse(cleaned.slice(start, end + 1)));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}


export const generatePlaybook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => GenerateInput.parse(d))
  .handler(async ({ data, context }): Promise<{ playbook_id: string; note?: string }> => {
    const { supabase, userId } = context;
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

    const ctx = await loadContext(supabase, data.countryCode, data.strategyId);
    if (!ctx.country) throw new Error("Country not found");

    const gateway = createLovableAiGatewayProvider(key);
    const model = "google/gemini-2.5-flash";

    const scopeLine = data.scope === "strategy" && ctx.strategy
      ? `Strategy: ${ctx.strategy.name}. Threat: ${ctx.threat?.name ?? "n/a"} (${ctx.threat?.severity_pct ?? 0}% severity).`
      : `Country-wide FDI transition rollup for ${ctx.country.name}.`;

    const ministryList = ctx.ministries.map((m: any) => `- ${m.slug} (${m.name})`).join("\n");
    const kpiList = ctx.kpis.map((k: any) => `- ${k.slug}: ${k.label} [${k.unit ?? ""}]`).join("\n") || "(no KPIs yet)";
    const sectorList = ctx.sectors.map((s: any) => `- ${s.sector_code}: ${s.sectors?.label ?? s.sector_code} (${Number(s.share_pct).toFixed(1)}%)`).join("\n");

    const prompt = `You are advising the Prime Minister of ${ctx.country.name} on attracting foreign direct investment.

${scopeLine}

Sectors (share of GDP):
${sectorList}

Ministries (use ONLY these slugs for ministry_slug):
${ministryList}

KPIs (use ONLY these slugs for kpi_slug, or null):
${kpiList}

Produce a McKinsey-caliber transition playbook across four horizons:
30d — ${HORIZON_INTENT["30d"]}
3m — ${HORIZON_INTENT["3m"]}
6m — ${HORIZON_INTENT["6m"]}
12m — ${HORIZON_INTENT["12m"]}

Rules:
- Every action is ONE concrete move by a named ministry. No vague "explore" or "study".
- Each action includes an "investor_signal" — what a prospective investor SEES externally.
- Prefer 2-3 actions per horizon (max 6). Balance across the top sectors.
- kpi_target must be a numeric target with unit (e.g. "USD 45m committed", "12,000 stay-over arrivals/month").
- Cite the actual ministry_slug from the list above; if none fits, use null.
- horizon MUST be exactly one of "30d", "3m", "6m", "12m".
- Return between 8 and 16 actions total (2-4 per horizon).
- Title: max 8 words. Summary: max 60 words, plain English.`;

    let plan: RawPlan | null = null;
    try {
      const { output } = await generateText({
        model: gateway(model),
        output: Output.object({ schema: PlaybookSchema }),
        prompt,
      });
      plan = output;
    } catch (err: any) {
      plan = parseFallback(err?.text);
      if (!plan) throw new Error(`AI playbook generation failed: ${err?.message ?? err}`);
    }

    const minBySlug = new Map(ctx.ministries.map((m: any) => [m.slug, m]));
    const kpiBySlug = new Map(ctx.kpis.map((k: any) => [k.slug, k]));
    const validSectors = new Set(ctx.sectors.map((s: any) => s.sector_code));

    const cleanActions = (plan.actions ?? [])
      .map((a) => ({ ...a, horizon: normalizeHorizon(a.horizon) }))
      .filter((a): a is typeof a & { horizon: Horizon } => Boolean(a.horizon && a.action?.trim()))
      .slice(0, 24);

    if (cleanActions.length === 0) {
      throw new Error("AI playbook generation failed: model returned no usable actions");
    }

    // Insert parent + actions
    const { data: pb, error: pErr } = await supabase
      .from("fdi_playbooks")
      .insert({
        country_code: data.countryCode,
        strategy_id: data.strategyId ?? null,
        scope: data.scope,
        title: plan.title?.slice(0, 160) || `FDI transition playbook — ${ctx.country.name}`,
        summary: plan.summary ?? null,
        ai_model: model,
        created_by: userId,
      })
      .select("id")
      .single();
    if (pErr || !pb) throw new Error(pErr?.message ?? "Failed to create playbook");

    const rows = cleanActions.map((a, i) => {
      const m = a.ministry_slug ? minBySlug.get(a.ministry_slug) : null;
      const k = a.kpi_slug ? kpiBySlug.get(a.kpi_slug) : null;
      return {
        playbook_id: pb.id,
        country_code: data.countryCode,
        horizon: a.horizon,
        sector_code: a.sector_code && validSectors.has(a.sector_code) ? a.sector_code : null,
        ministry_id: (m as any)?.id ?? null,
        ministry_slug: (m as any)?.slug ?? a.ministry_slug ?? null,
        action: a.action,
        investor_signal: a.investor_signal ?? null,
        kpi_id: (k as any)?.id ?? null,
        kpi_target: a.kpi_target ?? null,
        sort_order: i,
      };
    });

    const { error: aErr } = await supabase.from("fdi_playbook_actions").insert(rows);
    if (aErr) throw new Error(aErr.message);

    return { playbook_id: pb.id };
  });

export const listPlaybooks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ListInput.parse(d))
  .handler(async ({ data, context }): Promise<PlaybookRow[]> => {
    const { supabase } = context;
    let q = supabase
      .from("fdi_playbooks")
      .select("id,country_code,strategy_id,scope,sector_code,title,summary,created_at,updated_at")
      .eq("country_code", data.countryCode)
      .order("created_at", { ascending: false });
    if (data.strategyId) q = q.eq("strategy_id", data.strategyId);
    const { data: pbs, error } = await q;
    if (error) throw new Error(error.message);
    if (!pbs?.length) return [];
    const ids = pbs.map((p: any) => p.id);
    const { data: actions } = await supabase
      .from("fdi_playbook_actions")
      .select("id,playbook_id,horizon,sector_code,ministry_id,ministry_slug,action,investor_signal,kpi_id,kpi_target,status,sort_order")
      .in("playbook_id", ids)
      .order("sort_order", { ascending: true });
    const { data: mins } = await supabase.from("ministries").select("id,slug,name").eq("country_code", data.countryCode);
    const nameById = new Map((mins ?? []).map((m: any) => [m.id, m.name]));
    const byPb = new Map<string, PlaybookAction[]>();
    (actions ?? []).forEach((a: any) => {
      const arr = byPb.get(a.playbook_id) ?? [];
      arr.push({
        id: a.id,
        horizon: a.horizon,
        sector_code: a.sector_code,
        ministry_id: a.ministry_id,
        ministry_slug: a.ministry_slug,
        ministry_name: a.ministry_id ? (nameById.get(a.ministry_id) as string | null) ?? null : null,
        action: a.action,
        investor_signal: a.investor_signal,
        kpi_id: a.kpi_id,
        kpi_target: a.kpi_target,
        status: a.status,
        sort_order: a.sort_order,
      });
      byPb.set(a.playbook_id, arr);
    });
    return pbs.map((p: any) => ({ ...p, actions: byPb.get(p.id) ?? [] })) as PlaybookRow[];
  });

export const updatePlaybookAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => UpdateActionInput.parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("fdi_playbook_actions")
      .update(data.patch)
      .eq("id", data.actionId)
      .eq("country_code", data.countryCode);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deletePlaybook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), countryCode: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("fdi_playbooks")
      .delete()
      .eq("id", data.id)
      .eq("country_code", data.countryCode);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
