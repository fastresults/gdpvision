// @domain core
// @tables countries,country_sectors,exposure_index,levers,ministries,scenario_promotions,scenarios
// @ui src/components/scenarios/GuidedRail.tsx; src/components/scenarios/NarrativePanel.tsx; src/routes/_authenticated/admin/countries.$code.portfolio.$ministry.tsx

// Engine + scenario workspace server functions (PRD §7.2).
// All authed via requireSupabaseAuth so RLS scopes reads to the caller.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ENGINE_VERSION, runEngine, type EngineInput, type EngineOutput } from "@/lib/engine/v1_macro";

type JsonValue = string | number | boolean | null | JsonValue[] | { [k: string]: JsonValue };
type JsonObject = { [k: string]: JsonValue };


// ─── Ministry portfolio ──────────────────────────────────────────────────────

const CountryInput = z.object({ countryCode: z.string().min(3).max(4) });
const MinistryInput = z.object({
  countryCode: z.string().min(3).max(4),
  slug: z.string().min(1).max(64),
});

export interface Ministry {
  id: string;
  slug: string;
  name: string;
  sectors: Array<{ sector_code: string; weight: number }>;
}

export const listMinistries = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => CountryInput.parse(data))
  .handler(async ({ data, context }): Promise<Ministry[]> => {
    const { data: rows, error } = await context.supabase
      .from("ministries")
      .select("id,slug,name,ministry_sectors(sector_code,weight)")
      .eq("country_code", data.countryCode)
      .order("sort_order", { ascending: true });
    if (error) throw new Error(error.message);
    return (rows ?? []).map((m) => ({
      id: m.id,
      slug: m.slug,
      name: m.name,
      sectors: ((m.ministry_sectors ?? []) as Array<{ sector_code: string; weight: number }>).map(
        (s) => ({ sector_code: s.sector_code, weight: Number(s.weight) }),
      ),
    }));
  });

export interface PortfolioOverview {
  ministry: Ministry;
  composition: Array<{ sector_code: string; share_pct: number; confidence_grade: string }>;
  scenarios: Array<{
    id: string;
    title: string;
    status: string;
    updated_at: string;
    author_id: string;
  }>;
}

export const getPortfolio = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => MinistryInput.parse(data))
  .handler(async ({ data, context }): Promise<PortfolioOverview> => {
    const { supabase } = context;

    const { data: m, error: mErr } = await supabase
      .from("ministries")
      .select("id,slug,name,ministry_sectors(sector_code,weight)")
      .eq("country_code", data.countryCode)
      .eq("slug", data.slug)
      .maybeSingle();
    if (mErr) throw new Error(mErr.message);
    if (!m) throw new Error(`Ministry ${data.slug} not found`);

    const sectors = ((m.ministry_sectors ?? []) as Array<{ sector_code: string; weight: number }>).map(
      (s) => ({ sector_code: s.sector_code, weight: Number(s.weight) }),
    );
    const sectorCodes = sectors.map((s) => s.sector_code);

    const [{ data: comp }, { data: scenarios }] = await Promise.all([
      sectorCodes.length
        ? supabase
            .from("country_sectors")
            .select("sector_code,share_pct,confidence_grade")
            .eq("country_code", data.countryCode)
            .in("sector_code", sectorCodes)
        : Promise.resolve({ data: [] as Array<{ sector_code: string; share_pct: number; confidence_grade: string }> }),
      supabase
        .from("scenarios")
        .select("id,title,status,updated_at,author_id")
        .eq("country_code", data.countryCode)
        .eq("ministry_id", m.id)
        .order("updated_at", { ascending: false })
        .limit(20),
    ]);

    return {
      ministry: { id: m.id, slug: m.slug, name: m.name, sectors },
      composition: (comp ?? []).map((c) => ({
        sector_code: c.sector_code,
        share_pct: Number(c.share_pct),
        confidence_grade: c.confidence_grade,
      })),
      scenarios: (scenarios ?? []).map((s) => ({
        id: s.id,
        title: s.title,
        status: s.status,
        updated_at: s.updated_at,
        author_id: s.author_id,
      })),
    };
  });

// ─── Scenarios ───────────────────────────────────────────────────────────────

export interface ScenarioSummary {
  id: string;
  title: string;
  status: string;
  horizon_years: number;
  model_version: string;
  updated_at: string;
  author_id: string;
  country_code: string;
  ministry_id: string | null;
  sector_code: string | null;
}

export const listScenarios = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => CountryInput.parse(data))
  .handler(async ({ data, context }): Promise<ScenarioSummary[]> => {
    const { data: rows, error } = await context.supabase
      .from("scenarios")
      .select("id,title,status,horizon_years,model_version,updated_at,author_id,country_code,ministry_id,sector_code")
      .eq("country_code", data.countryCode)
      .order("updated_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return (rows ?? []) as ScenarioSummary[];
  });

export interface ScenarioArtifact extends ScenarioSummary {
  lever_settings: Record<string, number>;
  assumptions: JsonObject;
  results: EngineOutput | Record<string, never>;
  attribution: JsonObject;
  ministry: { slug: string; name: string } | null;
  promotions: Array<{ id: string; from_status: string; to_status: string; note: string | null; created_at: string }>;
}

const IdInput = z.object({ id: z.string().uuid() });

export const getScenario = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => IdInput.parse(data))
  .handler(async ({ data, context }): Promise<ScenarioArtifact> => {
    const { supabase } = context;
    const { data: s, error } = await supabase
      .from("scenarios")
      .select("*,ministries(slug,name)")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!s) throw new Error("Scenario not found");

    const { data: promos } = await supabase
      .from("scenario_promotions")
      .select("id,from_status,to_status,note,created_at")
      .eq("scenario_id", data.id)
      .order("created_at", { ascending: false });

    return {
      id: s.id,
      title: s.title,
      status: s.status,
      horizon_years: s.horizon_years,
      model_version: s.model_version,
      updated_at: s.updated_at,
      author_id: s.author_id,
      country_code: s.country_code,
      ministry_id: s.ministry_id,
      sector_code: s.sector_code,
      lever_settings: (s.lever_settings ?? {}) as Record<string, number>,
      assumptions: (s.assumptions ?? {}) as JsonObject,
      results: (s.results ?? {}) as ScenarioArtifact["results"],
      attribution: (s.attribution ?? {}) as JsonObject,
      ministry:
        (s.ministries as unknown as { slug: string; name: string } | null) ?? null,
      promotions: (promos ?? []).map((p) => ({
        id: p.id,
        from_status: p.from_status,
        to_status: p.to_status,
        note: p.note,
        created_at: p.created_at,
      })),
    };
  });

// Run the engine live for the Scenario Builder (no persistence).
const RunInput = z.object({
  countryCode: z.string().min(3).max(4),
  horizonYears: z.number().int().min(1).max(20),
  levers: z.record(z.string(), z.number()),
});

export interface EngineRunResult {
  output: EngineOutput;
  baseline: {
    composition: Record<string, number>;
    exposureIndex: number | null;
  };
  leverDefs: EngineInput["leverDefs"];
}

export const runScenarioEngine = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => RunInput.parse(data))
  .handler(async ({ data, context }): Promise<EngineRunResult> => {
    const { supabase } = context;

    const [{ data: comp }, { data: exp }, { data: leverRows }] = await Promise.all([
      supabase
        .from("country_sectors")
        .select("sector_code,share_pct")
        .eq("country_code", data.countryCode),
      supabase
        .from("exposure_index")
        .select("value")
        .eq("country_code", data.countryCode)
        .order("period", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("levers")
        .select("slug,sector_code,response_fn_ref,bounds")
        .eq("country_code", data.countryCode),
    ]);

    const composition: Record<string, number> = {};
    for (const r of comp ?? []) composition[r.sector_code] = Number(r.share_pct);

    const leverDefs: EngineInput["leverDefs"] = (leverRows ?? []).map((l) => ({
      slug: l.slug,
      sector_code: l.sector_code,
      response_fn_ref: l.response_fn_ref,
      bounds: (l.bounds ?? { min: 0, max: 100 }) as EngineInput["leverDefs"][number]["bounds"],
    }));

    const baseline = { composition, exposureIndex: exp ? Number(exp.value) : null };
    const output = runEngine({
      baseline,
      horizonYears: data.horizonYears,
      levers: data.levers,
      leverDefs,
    });
    return { output, baseline, leverDefs };
  });

// Save a scenario snapshot (pinned model_version).
const SaveInput = z.object({
  countryCode: z.string().min(3).max(4),
  ministrySlug: z.string().min(1).max(64).nullable().optional(),
  sectorCode: z.string().min(2).max(64).nullable().optional(),
  title: z.string().min(1).max(200),
  horizonYears: z.number().int().min(1).max(20),
  levers: z.record(z.string(), z.number()),
  assumptions: z.record(z.string(), z.any()).default({}),
});

export const saveScenario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => SaveInput.parse(data))
  .handler(async ({ data, context }): Promise<{ id: string }> => {
    const { supabase, userId } = context;

    let ministryId: string | null = null;
    if (data.ministrySlug) {
      const { data: m } = await supabase
        .from("ministries")
        .select("id")
        .eq("country_code", data.countryCode)
        .eq("slug", data.ministrySlug)
        .maybeSingle();
      ministryId = m?.id ?? null;
    }

    // Recompute results once so the artifact is self-contained.
    const run = await runScenarioEngine({
      data: {
        countryCode: data.countryCode,
        horizonYears: data.horizonYears,
        levers: data.levers,
      },
    });

    const { data: inserted, error } = await supabase
      .from("scenarios")
      .insert({
        country_code: data.countryCode,
        sector_code: data.sectorCode ?? null,
        ministry_id: ministryId,
        author_id: userId,
        title: data.title,
        horizon_years: data.horizonYears,
        model_version: ENGINE_VERSION,
        status: "draft",
        lever_settings: data.levers as unknown as JsonObject,
        assumptions: data.assumptions as unknown as JsonObject,
        results: run.output as unknown as JsonObject,
        attribution: { attribution: run.output.attribution } as unknown as JsonObject,

      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: inserted.id };
  });

// Promote a scenario (draft → shared → adopted). Only cabinet_secretary/admin
// can insert into scenario_promotions, so this is doubly gated.
const PromoteInput = z.object({
  id: z.string().uuid(),
  toStatus: z.enum(["draft", "shared", "adopted", "archived"]),
  note: z.string().max(2000).optional(),
});

export const promoteScenario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => PromoteInput.parse(data))
  .handler(async ({ data, context }): Promise<{ id: string; status: string }> => {
    const { supabase, userId } = context;

    const { data: current, error: cErr } = await supabase
      .from("scenarios")
      .select("status")
      .eq("id", data.id)
      .maybeSingle();
    if (cErr) throw new Error(cErr.message);
    if (!current) throw new Error("Scenario not found");

    const { error: updErr } = await supabase
      .from("scenarios")
      .update({ status: data.toStatus })
      .eq("id", data.id);
    if (updErr) throw new Error(updErr.message);

    const { error: promoErr } = await supabase.from("scenario_promotions").insert({
      scenario_id: data.id,
      actor_id: userId,
      from_status: current.status,
      to_status: data.toStatus,
      note: data.note ?? null,
    });
    if (promoErr) throw new Error(promoErr.message);

    return { id: data.id, status: data.toStatus };
  });

// ─── AI executive narrative ──────────────────────────────────────────────────

const NarrateSchema = z.object({
  scenarioId: z.string().uuid().optional(),
  livePayload: z
    .object({
      countryCode: z.string().min(3).max(4),
      title: z.string().min(1).max(200),
      horizonYears: z.number().int().min(1).max(20),
      levers: z.record(z.string(), z.number()),
      engineOutput: z.record(z.string(), z.any()),
    })
    .optional(),
});
export type NarrateInput = z.infer<typeof NarrateSchema>;

export const narrateScenario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => NarrateSchema.parse(data))
  .handler(async ({ data, context }): Promise<{ narrative_md: string; generated_at: string }> => {
    const { supabase } = context;

    // Resolve source scenario (persisted or live).
    let countryCode: string;
    let title: string;
    let horizonYears: number;
    let levers: Record<string, number>;
    let engineOutput: Record<string, unknown>;

    if (data.scenarioId) {
      const { data: s, error } = await supabase
        .from("scenarios")
        .select("country_code,title,horizon_years,lever_settings,results")
        .eq("id", data.scenarioId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!s) throw new Error("Scenario not found");
      countryCode = s.country_code;
      title = s.title;
      horizonYears = s.horizon_years;
      levers = (s.lever_settings ?? {}) as Record<string, number>;
      engineOutput = (s.results ?? {}) as Record<string, unknown>;
    } else if (data.livePayload) {
      ({ countryCode, title, horizonYears, levers, engineOutput } = data.livePayload);
    } else {
      throw new Error("Provide scenarioId or livePayload");
    }

    // Enrich with country name + baseline composition (safe to send to model).
    const [{ data: country }, { data: comp }] = await Promise.all([
      supabase.from("countries").select("name").eq("code", countryCode).maybeSingle(),
      supabase
        .from("country_sectors")
        .select("sector_code,share_pct,confidence_grade")
        .eq("country_code", countryCode),
    ]);

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("Lovable AI Gateway not configured");

    const prompt = [
      `You are a McKinsey senior partner drafting an executive brief for the ${country?.name ?? countryCode} government.`,
      `Scenario title: "${title}" · Horizon: ${horizonYears} years · Engine: ${ENGINE_VERSION}.`,
      "",
      "Baseline sector composition (share % of GDP):",
      (comp ?? [])
        .map((r) => `- ${r.sector_code}: ${Number(r.share_pct).toFixed(1)}% (grade ${r.confidence_grade})`)
        .join("\n") || "- none available",
      "",
      "Policy lever settings:",
      Object.entries(levers)
        .map(([k, v]) => `- ${k}: ${Number(v).toFixed(2)}`)
        .join("\n") || "- defaults",
      "",
      "Engine output (JSON):",
      JSON.stringify(engineOutput).slice(0, 6000),
      "",
      "Write a tight brief in Markdown with these sections (use ## for headings):",
      "## Situation",
      "## Complication",
      "## Recommendation",
      "## Downside risks",
      "## Watch-list KPIs",
      "",
      "Rules:",
      "- Ground every claim in the numbers above. No filler.",
      "- Quote specific delta values (pp) and years.",
      "- Recommendation: 3 crisp actions, each with an owner ministry hint.",
      "- 250-400 words total.",
    ].join("\n");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": apiKey,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You produce grounded executive briefs, McKinsey style." },
          { role: "user", content: prompt },
        ],
        temperature: 0.3,
      }),
    });
    if (!res.ok) {
      if (res.status === 429) throw new Error("AI Gateway rate limit — try again in a moment.");
      if (res.status === 402) throw new Error("AI credits exhausted for this workspace.");
      throw new Error(`AI Gateway ${res.status}: ${await res.text()}`);
    }
    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const narrative_md = json.choices?.[0]?.message?.content?.trim() ?? "";
    const generated_at = new Date().toISOString();
    if (!narrative_md) throw new Error("AI returned an empty narrative.");

    // Persist onto the artifact when we have one.
    if (data.scenarioId) {
      const { data: cur } = await supabase
        .from("scenarios")
        .select("assumptions")
        .eq("id", data.scenarioId)
        .maybeSingle();
      const next = {
        ...(((cur?.assumptions ?? {}) as JsonObject) || {}),
        narrative_md,
        narrative_generated_at: generated_at,
      } as unknown as JsonObject;
      await supabase
        .from("scenarios")
        .update({ assumptions: next })
        .eq("id", data.scenarioId);
    }

    return { narrative_md, generated_at };
  });

