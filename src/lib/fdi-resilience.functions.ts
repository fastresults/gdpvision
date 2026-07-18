// Chamber 04 — FDI Transition Studio server functions.
// Threat-in / resilient-FDI-strategy-out workbench.
// All authed via requireSupabaseAuth; RLS scopes reads/writes per country.

import { createServerFn } from "@tanstack/react-start";
import { generateText, Output } from "ai";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

// ─── Types ───────────────────────────────────────────────────────────────────

export type OnsetKind = "immediate" | "phased" | "tail_risk";
export type ThreatType =
  | "tariff"
  | "climate"
  | "cbi_wind_down"
  | "tourism_collapse"
  | "anchor_exit"
  | "commodity_shock"
  | "sanctions"
  | "treaty_change"
  | "custom";

export type ActionType =
  | "attract_new_fdi"
  | "expand_existing"
  | "retain_at_risk"
  | "substitute_domestic"
  | "exit_wind_down";

export type StrategyStatus = "draft" | "plan_of_record" | "superseded";

export interface ThreatBrief {
  bullets: Array<{ label: string; body: string }>;
  citations: Array<{ n: number; title?: string | null; url?: string | null; org?: string | null }>;
  ai_model?: string;
}

export interface AllocationEntry {
  sector_code: string;
  current_pct: number;
  resilient_pct: number;
  exposure_delta_pp: number;
}

export interface Allocation {
  entries: AllocationEntry[];
  currency: "pct_of_fdi";
  updated_at?: string;
}

export interface ResilienceAction {
  id: string;
  sector_code: string;
  action_type: ActionType;
  label: string;
  target_pp: number;
  staging_year: number;
  sponsor_ministry_slug?: string | null;
  ai_generated?: boolean;
  note?: string | null;
}

export interface StrategyMetrics {
  exposure_closed_pp: number;
  residual_risk_pp: number;
  hhi_delta: number;
  time_to_resilience_years: number;
  ministries_engaged: number;
}

export interface FdiThreatRow {
  id: string;
  country_code: string;
  name: string;
  threat_type: ThreatType;
  target_sector_codes: string[];
  severity_pct: number;
  horizon_years: number;
  onset: OnsetKind;
  brief: ThreatBrief;
  created_at: string;
  updated_at: string;
}

export interface FdiStrategyRow {
  id: string;
  fdi_threat_id: string;
  country_code: string;
  name: string;
  allocation: Allocation;
  actions: ResilienceAction[];
  metrics: StrategyMetrics;
  status: StrategyStatus;
  promoted_scenario_id: string | null;
  promoted_at: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Zod schemas ─────────────────────────────────────────────────────────────

const CountryInput = z.object({ countryCode: z.string().min(2).max(4) });
const IdInput = z.object({ id: z.string().uuid() });

const CreateThreatInput = z.object({
  countryCode: z.string().min(2).max(4),
  name: z.string().min(1).max(200),
  threatType: z.enum([
    "tariff",
    "climate",
    "cbi_wind_down",
    "tourism_collapse",
    "anchor_exit",
    "commodity_shock",
    "sanctions",
    "treaty_change",
    "custom",
  ]),
  targetSectorCodes: z.array(z.string().min(1).max(64)).min(1).max(12),
  severityPct: z.number().min(0).max(100).default(50),
  horizonYears: z.number().int().min(1).max(20).default(5),
  onset: z.enum(["immediate", "phased", "tail_risk"]).default("phased"),
});

const AllocationEntryZ = z.object({
  sector_code: z.string(),
  current_pct: z.number().min(0).max(100),
  resilient_pct: z.number().min(0).max(100),
  exposure_delta_pp: z.number(),
});

const ActionZ = z.object({
  id: z.string(),
  sector_code: z.string(),
  action_type: z.enum([
    "attract_new_fdi",
    "expand_existing",
    "retain_at_risk",
    "substitute_domestic",
    "exit_wind_down",
  ]),
  label: z.string().min(1).max(240),
  target_pp: z.number().min(0).max(100),
  staging_year: z.number().int().min(1).max(20),
  sponsor_ministry_slug: z.string().max(64).nullable().optional(),
  ai_generated: z.boolean().optional(),
  note: z.string().max(1000).nullable().optional(),
});

const SaveStrategyInput = z.object({
  id: z.string().uuid().optional(),
  threatId: z.string().uuid(),
  name: z.string().min(1).max(200),
  allocation: z.object({
    entries: z.array(AllocationEntryZ),
    currency: z.literal("pct_of_fdi").default("pct_of_fdi"),
  }),
  actions: z.array(ActionZ),
  status: z.enum(["draft", "plan_of_record", "superseded"]).default("draft"),
});

const SuggestInput = z.object({
  threatId: z.string().uuid(),
  constraints: z.string().max(1000).optional(),
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function computeMetrics(
  allocation: Allocation,
  actions: ResilienceAction[],
): StrategyMetrics {
  const exposureClosed = actions.reduce((sum, a) => sum + (a.target_pp || 0), 0);
  const totalExposure = allocation.entries.reduce(
    (sum, e) => sum + Math.max(0, e.exposure_delta_pp),
    0,
  );
  const residual = Math.max(0, totalExposure - exposureClosed);
  // HHI delta: sum of squared shares (resilient vs current), scaled 0-10000.
  const hhiCurrent = allocation.entries.reduce((s, e) => s + (e.current_pct / 100) ** 2, 0) * 10000;
  const hhiResilient =
    allocation.entries.reduce((s, e) => s + (e.resilient_pct / 100) ** 2, 0) * 10000;
  const ministries = new Set(
    actions.map((a) => a.sponsor_ministry_slug).filter(Boolean) as string[],
  );
  const maxYear = actions.reduce((m, a) => Math.max(m, a.staging_year || 0), 0);
  return {
    exposure_closed_pp: Number(exposureClosed.toFixed(2)),
    residual_risk_pp: Number(residual.toFixed(2)),
    hhi_delta: Number((hhiResilient - hhiCurrent).toFixed(1)),
    time_to_resilience_years: maxYear,
    ministries_engaged: ministries.size,
  };
}

function asBrief(v: unknown): ThreatBrief {
  const b = (v ?? {}) as Partial<ThreatBrief>;
  return {
    bullets: Array.isArray(b.bullets) ? b.bullets : [],
    citations: Array.isArray(b.citations) ? b.citations : [],
    ai_model: b.ai_model,
  };
}

function asAllocation(v: unknown): Allocation {
  const a = (v ?? {}) as Partial<Allocation>;
  return {
    entries: Array.isArray(a.entries) ? (a.entries as AllocationEntry[]) : [],
    currency: "pct_of_fdi",
    updated_at: a.updated_at,
  };
}

function asActions(v: unknown): ResilienceAction[] {
  return Array.isArray(v) ? (v as ResilienceAction[]) : [];
}

function asMetrics(v: unknown): StrategyMetrics {
  const m = (v ?? {}) as Partial<StrategyMetrics>;
  return {
    exposure_closed_pp: Number(m.exposure_closed_pp ?? 0),
    residual_risk_pp: Number(m.residual_risk_pp ?? 0),
    hhi_delta: Number(m.hhi_delta ?? 0),
    time_to_resilience_years: Number(m.time_to_resilience_years ?? 0),
    ministries_engaged: Number(m.ministries_engaged ?? 0),
  };
}

// ─── Studio context (sectors + ministries) ───────────────────────────────────

export interface StudioSector {
  code: string;
  label: string;
  hue_token: string | null;
  share_pct: number;
}
export interface StudioMinistry { id: string; slug: string; name: string }

export const listStudioContext = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CountryInput.parse(d))
  .handler(async ({ data, context }): Promise<{ sectors: StudioSector[]; ministries: StudioMinistry[] }> => {
    const [csRes, minRes] = await Promise.all([
      context.supabase
        .from("country_sectors")
        .select("sector_code,share_pct,sectors(label,hue_token)")
        .eq("country_code", data.countryCode)
        .order("share_pct", { ascending: false }),
      context.supabase
        .from("ministries")
        .select("id,slug,name")
        .eq("country_code", data.countryCode)
        .order("sort_order", { ascending: true }),
    ]);
    if (csRes.error) throw new Error(csRes.error.message);
    if (minRes.error) throw new Error(minRes.error.message);
    const sectors: StudioSector[] = (csRes.data ?? []).map((r: any) => ({
      code: r.sector_code,
      label: r.sectors?.label ?? r.sector_code,
      hue_token: r.sectors?.hue_token ?? null,
      share_pct: Number(r.share_pct ?? 0),
    }));
    return { sectors, ministries: (minRes.data ?? []) as StudioMinistry[] };
  });

// ─── Threats ─────────────────────────────────────────────────────────────────

export const listThreats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CountryInput.parse(d))
  .handler(async ({ data, context }): Promise<FdiThreatRow[]> => {
    const { data: rows, error } = await context.supabase
      .from("fdi_threats")
      .select(
        "id,country_code,name,threat_type,target_sector_codes,severity_pct,horizon_years,onset,brief,created_at,updated_at",
      )
      .eq("country_code", data.countryCode)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r) => ({
      id: r.id,
      country_code: r.country_code,
      name: r.name,
      threat_type: r.threat_type as ThreatType,
      target_sector_codes: (r.target_sector_codes ?? []) as string[],
      severity_pct: Number(r.severity_pct),
      horizon_years: Number(r.horizon_years),
      onset: r.onset as OnsetKind,
      brief: asBrief(r.brief),
      created_at: r.created_at,
      updated_at: r.updated_at,
    }));
  });

export const getThreat = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => IdInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: threat, error } = await context.supabase
      .from("fdi_threats")
      .select(
        "id,country_code,name,threat_type,target_sector_codes,severity_pct,horizon_years,onset,brief,created_at,updated_at",
      )
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!threat) throw new Error("Threat not found");
    const { data: strategies, error: sErr } = await context.supabase
      .from("fdi_strategies")
      .select(
        "id,fdi_threat_id,country_code,name,allocation,actions,metrics,status,promoted_scenario_id,promoted_at,created_at,updated_at",
      )
      .eq("fdi_threat_id", data.id)
      .order("updated_at", { ascending: false });
    if (sErr) throw new Error(sErr.message);
    const threatRow: FdiThreatRow = {
      id: threat.id,
      country_code: threat.country_code,
      name: threat.name,
      threat_type: threat.threat_type as ThreatType,
      target_sector_codes: (threat.target_sector_codes ?? []) as string[],
      severity_pct: Number(threat.severity_pct),
      horizon_years: Number(threat.horizon_years),
      onset: threat.onset as OnsetKind,
      brief: asBrief(threat.brief),
      created_at: threat.created_at,
      updated_at: threat.updated_at,
    };
    const strategyRows: FdiStrategyRow[] = (strategies ?? []).map((s) => ({
      id: s.id,
      fdi_threat_id: s.fdi_threat_id,
      country_code: s.country_code,
      name: s.name,
      allocation: asAllocation(s.allocation),
      actions: asActions(s.actions),
      metrics: asMetrics(s.metrics),
      status: s.status as StrategyStatus,
      promoted_scenario_id: s.promoted_scenario_id,
      promoted_at: s.promoted_at,
      created_at: s.created_at,
      updated_at: s.updated_at,
    }));
    return { threat: threatRow, strategies: strategyRows };
  });

async function fetchCountryContext(supabase: any, countryCode: string) {
  const [sectorsRes, ministriesRes, kpisRes] = await Promise.all([
    supabase
      .from("country_sectors")
      .select("sector_code,share_pct,confidence_grade")
      .eq("country_code", countryCode)
      .order("share_pct", { ascending: false }),
    supabase
      .from("ministries")
      .select("id,slug,name,ministry_sectors(sector_code,weight)")
      .eq("country_code", countryCode)
      .order("sort_order", { ascending: true }),
    supabase
      .from("country_kpis")
      .select("kpi_code,label,sector_code,latest_value,target,unit,direction")
      .eq("country_code", countryCode)
      .limit(120),
  ]);
  const sectors = (sectorsRes.data ?? []) as Array<{
    sector_code: string;
    share_pct: number;
    confidence_grade: string;
  }>;
  const ministries = (ministriesRes.data ?? []) as Array<{
    id: string;
    slug: string;
    name: string;
    ministry_sectors: Array<{ sector_code: string; weight: number }>;
  }>;
  const kpis = (kpisRes.data ?? []) as Array<{
    kpi_code: string;
    label: string;
    sector_code: string | null;
    latest_value: number | null;
    target: number | null;
    unit: string | null;
    direction: string | null;
  }>;
  return { sectors, ministries, kpis };
}

const BriefSchema = z.object({
  bullets: z
    .array(
      z.object({
        label: z.string().min(2).max(60),
        body: z.string().min(10).max(600),
      }),
    )
    .min(3)
    .max(3),
});

export const createThreat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CreateThreatInput.parse(d))
  .handler(async ({ data, context }) => {
    const ctxData = await fetchCountryContext(context.supabase, data.countryCode);
    const targetSectors = ctxData.sectors.filter((s) =>
      data.targetSectorCodes.includes(s.sector_code),
    );
    let brief: ThreatBrief = { bullets: [], citations: [] };
    const key = process.env.LOVABLE_API_KEY;
    if (key) {
      try {
        const gateway = createLovableAiGatewayProvider(key);
        const model = "google/gemini-2.5-flash";
        const prompt = [
          `Country: ${data.countryCode}. Threat: ${data.name} (${data.threatType}).`,
          `Severity: ${data.severityPct}%. Horizon: ${data.horizonYears}y. Onset: ${data.onset}.`,
          `Target sectors (GDP share %): ${targetSectors
            .map((s) => `${s.sector_code} ${s.share_pct}%`)
            .join(", ")}.`,
          `Other sectors on record: ${ctxData.sectors
            .filter((s) => !data.targetSectorCodes.includes(s.sector_code))
            .slice(0, 10)
            .map((s) => `${s.sector_code} ${s.share_pct}%`)
            .join(", ")}.`,
          "Write a McKinsey-tone 3-bullet framing of this shock's implications for the country's FDI strategy. Bullet 1 label 'Mechanism' — how the shock transmits. Bullet 2 label 'First-order FDI exposure' — quantified where possible in pp of GDP. Bullet 3 label 'Second-order spillovers' — adjacent sectors and multiplier risks. Concise, sovereign policy register.",
        ].join(" ");
        const result = await generateText({
          model: gateway(model),
          prompt,
          experimental_output: Output.object({ schema: BriefSchema }) as any,
        } as any);
        const out = (result as any).experimental_output ?? (result as any).output;
        if (out?.bullets?.length) {
          brief = {
            bullets: out.bullets,
            citations: targetSectors.map((s, i) => ({
              n: i + 1,
              title: `${s.sector_code} sector share ${s.share_pct}% (grade ${s.confidence_grade})`,
              url: null,
              org: "country_sectors",
            })),
            ai_model: model,
          };
        }
      } catch (err) {
        console.error("AI brief failed", err);
      }
    }
    const { data: row, error } = await context.supabase
      .from("fdi_threats")
      .insert({
        country_code: data.countryCode,
        name: data.name,
        threat_type: data.threatType,
        target_sector_codes: data.targetSectorCodes,
        severity_pct: data.severityPct,
        horizon_years: data.horizonYears,
        onset: data.onset,
        brief: brief as unknown as Json,
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

// ─── Suggest resilient strategy (AI) ─────────────────────────────────────────

const SuggestionSchema = z.object({
  allocation: z.array(
    z.object({
      sector_code: z.string(),
      resilient_pct: z.number().min(0).max(100),
      exposure_delta_pp: z.number(),
      rationale: z.string().max(400).optional(),
    }),
  ),
  actions: z
    .array(
      z.object({
        sector_code: z.string(),
        action_type: z.enum([
          "attract_new_fdi",
          "expand_existing",
          "retain_at_risk",
          "substitute_domestic",
          "exit_wind_down",
        ]),
        label: z.string().min(1).max(200),
        target_pp: z.number().min(0).max(100),
        staging_year: z.number().int().min(1).max(20),
        sponsor_ministry_slug: z.string().max(64).nullable().optional(),
      }),
    )
    .min(3)
    .max(12),
});

export const suggestResilientStrategy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SuggestInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: threat, error } = await context.supabase
      .from("fdi_threats")
      .select("*")
      .eq("id", data.threatId)
      .single();
    if (error) throw new Error(error.message);
    const ctxData = await fetchCountryContext(context.supabase, threat.country_code);
    const totalShare = ctxData.sectors.reduce((s, x) => s + Number(x.share_pct || 0), 0) || 100;
    const currentAlloc: AllocationEntry[] = ctxData.sectors.map((s) => ({
      sector_code: s.sector_code,
      current_pct: Number(((Number(s.share_pct) / totalShare) * 100).toFixed(2)),
      resilient_pct: Number(((Number(s.share_pct) / totalShare) * 100).toFixed(2)),
      exposure_delta_pp: 0,
    }));

    const key = process.env.LOVABLE_API_KEY;
    if (!key) {
      // Deterministic fallback: shift 30% of exposure away from targets proportionally.
      return heuristicSuggestion(
        currentAlloc,
        (threat.target_sector_codes ?? []) as string[],
        Number(threat.severity_pct),
        Number(threat.horizon_years),
        ctxData.ministries,
      );
    }
    try {
      const gateway = createLovableAiGatewayProvider(key);
      const model = "google/gemini-2.5-flash";
      const prompt = [
        `Country ${threat.country_code}. Threat ${threat.name} (${threat.threat_type}), severity ${threat.severity_pct}%, horizon ${threat.horizon_years}y, onset ${threat.onset}.`,
        `Target sectors: ${(threat.target_sector_codes ?? []).join(", ")}.`,
        `Current FDI allocation shares (% of envelope): ${currentAlloc
          .map((a) => `${a.sector_code}:${a.current_pct}`)
          .join(", ")}.`,
        `Available ministries: ${ctxData.ministries.map((m) => `${m.slug} (${m.name})`).join(", ")}.`,
        data.constraints ? `Hard constraints: ${data.constraints}.` : "",
        "Propose a RESILIENT reallocation across ALL listed sectors (percentages summing to 100) and 3-8 staged actions (year 1..horizon) that mitigate the shock. For each target sector, quantify exposure_delta_pp (pp of FDI envelope at risk). Prefer diversification (lower HHI) without abandoning the targets — mix retain/expand/substitute/attract. Assign each action a sponsor_ministry_slug from the available list.",
      ]
        .filter(Boolean)
        .join(" ");
      const result = await generateText({
        model: gateway(model),
        prompt,
        experimental_output: Output.object({ schema: SuggestionSchema }) as any,
      } as any);
      const out = (result as any).experimental_output ?? (result as any).output;
      if (!out?.allocation?.length) {
        return heuristicSuggestion(
          currentAlloc,
          (threat.target_sector_codes ?? []) as string[],
          Number(threat.severity_pct),
          Number(threat.horizon_years),
          ctxData.ministries,
        );
      }
      // Merge model output into full allocation grid.
      const byCode = new Map(
        out.allocation.map((a: any) => [a.sector_code, a] as const),
      );
      const entries: AllocationEntry[] = currentAlloc.map((c) => {
        const m = byCode.get(c.sector_code) as any;
        return {
          sector_code: c.sector_code,
          current_pct: c.current_pct,
          resilient_pct: m ? Number(m.resilient_pct) : c.current_pct,
          exposure_delta_pp: m ? Number(m.exposure_delta_pp) : 0,
        };
      });
      // Normalise resilient_pct to 100.
      const rSum = entries.reduce((s, e) => s + e.resilient_pct, 0) || 100;
      entries.forEach((e) => {
        e.resilient_pct = Number(((e.resilient_pct / rSum) * 100).toFixed(2));
      });
      const actions: ResilienceAction[] = out.actions.map((a: any, i: number) => ({
        id: cryptoRandomId(i),
        sector_code: a.sector_code,
        action_type: a.action_type,
        label: a.label,
        target_pp: Number(a.target_pp),
        staging_year: a.staging_year,
        sponsor_ministry_slug: a.sponsor_ministry_slug ?? null,
        ai_generated: true,
      }));
      return { allocation: { entries, currency: "pct_of_fdi" as const }, actions };
    } catch (err) {
      console.error("AI suggest failed", err);
      return heuristicSuggestion(
        currentAlloc,
        (threat.target_sector_codes ?? []) as string[],
        Number(threat.severity_pct),
        Number(threat.horizon_years),
        ctxData.ministries,
      );
    }
  });

function cryptoRandomId(seed: number): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `a_${Date.now()}_${seed}`;
  }
}

function heuristicSuggestion(
  current: AllocationEntry[],
  targets: string[],
  severity: number,
  horizon: number,
  ministries: Array<{ slug: string; ministry_sectors: Array<{ sector_code: string }> }>,
): { allocation: Allocation; actions: ResilienceAction[] } {
  const shift = Math.min(50, severity * 0.5); // pp to move OFF target sectors
  const targetSet = new Set(targets);
  const targetTotal = current.filter((c) => targetSet.has(c.sector_code)).reduce((s, c) => s + c.current_pct, 0);
  const takePerTarget = targetTotal > 0 ? shift / current.filter((c) => targetSet.has(c.sector_code)).length : 0;
  const nonTargets = current.filter((c) => !targetSet.has(c.sector_code));
  const givePerNonTarget = nonTargets.length ? shift / nonTargets.length : 0;
  const entries: AllocationEntry[] = current.map((c) => {
    const isTarget = targetSet.has(c.sector_code);
    const resilient = isTarget
      ? Math.max(0, c.current_pct - takePerTarget)
      : c.current_pct + givePerNonTarget;
    return {
      sector_code: c.sector_code,
      current_pct: c.current_pct,
      resilient_pct: Number(resilient.toFixed(2)),
      exposure_delta_pp: isTarget ? Number((c.current_pct * (severity / 100)).toFixed(2)) : 0,
    };
  });
  const sum = entries.reduce((s, e) => s + e.resilient_pct, 0) || 100;
  entries.forEach((e) => {
    e.resilient_pct = Number(((e.resilient_pct / sum) * 100).toFixed(2));
  });

  function sponsorFor(code: string): string | null {
    return ministries.find((m) => m.ministry_sectors?.some((s) => s.sector_code === code))?.slug ?? null;
  }
  const actions: ResilienceAction[] = [];
  targets.forEach((code, i) => {
    actions.push({
      id: cryptoRandomId(i),
      sector_code: code,
      action_type: "retain_at_risk",
      label: `Stabilise ${code} through the ${horizon}-year window`,
      target_pp: Number((takePerTarget * 0.4).toFixed(2)),
      staging_year: 1,
      sponsor_ministry_slug: sponsorFor(code),
    });
  });
  nonTargets.slice(0, 3).forEach((c, i) => {
    actions.push({
      id: cryptoRandomId(i + 100),
      sector_code: c.sector_code,
      action_type: i === 0 ? "attract_new_fdi" : "expand_existing",
      label: `Grow ${c.sector_code} to offset target-sector exposure`,
      target_pp: Number((givePerNonTarget * 0.7).toFixed(2)),
      staging_year: i + 1,
      sponsor_ministry_slug: sponsorFor(c.sector_code),
    });
  });
  return { allocation: { entries, currency: "pct_of_fdi" }, actions };
}

// ─── Save strategy ───────────────────────────────────────────────────────────

export const saveStrategy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SaveStrategyInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: threat, error: tErr } = await context.supabase
      .from("fdi_threats")
      .select("country_code")
      .eq("id", data.threatId)
      .single();
    if (tErr) throw new Error(tErr.message);
    const metrics = computeMetrics(
      { entries: data.allocation.entries, currency: "pct_of_fdi" },
      data.actions as ResilienceAction[],
    );
    if (data.id) {
      const { error } = await context.supabase
        .from("fdi_strategies")
        .update({
          name: data.name,
          allocation: {
            entries: data.allocation.entries,
            currency: "pct_of_fdi",
            updated_at: new Date().toISOString(),
          } as unknown as Json,
          actions: data.actions as unknown as Json,
          metrics: metrics as unknown as Json,
          status: data.status,
        })
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id, metrics };
    }
    const { data: row, error } = await context.supabase
      .from("fdi_strategies")
      .insert({
        fdi_threat_id: data.threatId,
        country_code: threat.country_code,
        name: data.name,
        allocation: {
          entries: data.allocation.entries,
          currency: "pct_of_fdi",
          updated_at: new Date().toISOString(),
        } as unknown as Json,
        actions: data.actions as unknown as Json,
        metrics: metrics as unknown as Json,
        status: data.status,
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id, metrics };
  });

// ─── Promotions ──────────────────────────────────────────────────────────────

export const promoteStrategyToPackages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => IdInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: strategy, error } = await context.supabase
      .from("fdi_strategies")
      .select("id,country_code,name,actions,fdi_threat_id")
      .eq("id", data.id)
      .single();
    if (error) throw new Error(error.message);
    const actions = asActions(strategy.actions);
    const rows = actions.map((a) => ({
      country_code: strategy.country_code,
      sector_code: a.sector_code,
      name: a.label,
      summary: `From Chamber 04 · strategy ${strategy.name} · threat ${strategy.fdi_threat_id} · year ${a.staging_year} · ${a.action_type}`,
      gates: [
        { label: "Fiscal impact modelled", passed: false },
        { label: "Regulatory pathway", passed: false },
        { label: "Ministerial sponsor", passed: !!a.sponsor_ministry_slug },
      ] as unknown as Json,
      enabling_actions: [] as unknown as Json,
      target_gap_pct: a.target_pp,
      status: "proposed",
      created_by: context.userId,
    }));
    if (rows.length) {
      const { error: insErr } = await context.supabase.from("packages").insert(rows);
      if (insErr) throw new Error(insErr.message);
    }
    const { error: upErr } = await context.supabase
      .from("fdi_strategies")
      .update({ status: "plan_of_record", promoted_at: new Date().toISOString() })
      .eq("id", strategy.id);
    if (upErr) throw new Error(upErr.message);
    return { promoted: rows.length };
  });

export const promoteStrategyToScenario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => IdInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: strategy, error } = await context.supabase
      .from("fdi_strategies")
      .select("id,country_code,name,allocation,actions,fdi_threat_id")
      .eq("id", data.id)
      .single();
    if (error) throw new Error(error.message);
    const { data: threat } = await context.supabase
      .from("fdi_threats")
      .select("name,horizon_years")
      .eq("id", strategy.fdi_threat_id)
      .single();
    const { data: scen, error: sErr } = await context.supabase
      .from("scenarios")
      .insert({
        country_code: strategy.country_code,
        author_id: context.userId,
        title: `${strategy.name} · from Chamber 04`,
        horizon_years: threat?.horizon_years ?? 5,
        model_version: "v1",
        status: "draft",
        lever_settings: {} as unknown as Json,
        assumptions: {
          source_chamber: "04",
          source_strategy_id: strategy.id,
          source_threat_id: strategy.fdi_threat_id,
          threat_name: threat?.name ?? null,
          allocation: strategy.allocation,
          actions: strategy.actions,
        } as unknown as Json,
      })
      .select("id")
      .single();
    if (sErr) throw new Error(sErr.message);
    await context.supabase
      .from("fdi_strategies")
      .update({ promoted_scenario_id: scen.id })
      .eq("id", strategy.id);
    return { scenarioId: scen.id };
  });
