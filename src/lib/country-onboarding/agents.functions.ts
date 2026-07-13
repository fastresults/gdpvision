// AI-first country onboarding server functions.
// Each `runXxx` server fn calls Perplexity Sonar (grounded, cited), writes an
// `onboarding_run` + `onboarding_drafts` + `onboarding_citations`, and returns
// the draft rows to the client for review. `commitXxx` writes reviewed drafts
// into the real tables.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { callSonar, parseSonarJson, type SonarCitation, type SonarModel } from "./perplexity.server";

type Stage = "profile" | "gdp" | "sector_composition" | "ministries" | "ministry_sector_map";

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data: isAdmin } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (!isAdmin) throw new Error("Forbidden: super admin only");
}

async function loadCountry(admin: any, code: string) {
  const { data, error } = await admin
    .from("countries")
    .select("code, name, iso3, currency, fiscal_year_start_month")
    .eq("code", code)
    .maybeSingle();
  if (error || !data) throw new Error(`Country ${code} not found`);
  return data as { code: string; name: string; iso3: string | null; currency: string; fiscal_year_start_month: number };
}

async function loadSectors(admin: any) {
  const { data, error } = await admin.from("sectors").select("code, label, isic").order("sort_order");
  if (error) throw error;
  return (data ?? []) as Array<{ code: string; label: string; isic: string | null }>;
}

async function openRun(admin: any, params: {
  country_code: string;
  stage: Stage;
  userId: string;
  model_stack: Record<string, string>;
}) {
  const { data, error } = await admin
    .from("onboarding_runs")
    .insert({
      country_code: params.country_code,
      stage: params.stage,
      status: "planning",
      started_by: params.userId,
      model_stack: params.model_stack,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

async function finishRun(admin: any, runId: string, patch: Record<string, unknown>) {
  await admin
    .from("onboarding_runs")
    .update({ ...patch, finished_at: new Date().toISOString() })
    .eq("id", runId);
}

async function saveDraft(admin: any, args: {
  run_id: string;
  country_code: string;
  stage: Stage;
  target_table: string;
  payload: unknown;
  confidence: "high" | "medium" | "low";
  citations: SonarCitation[];
  summary_md?: string | null;
  summary_highlights?: Array<{ label: string; value: string }> | null;
}) {
  const { data: draft, error } = await admin
    .from("onboarding_drafts")
    .insert({
      run_id: args.run_id,
      country_code: args.country_code,
      stage: args.stage,
      target_table: args.target_table,
      payload: args.payload as any,
      confidence: args.confidence,
      needs_review: true,
      summary_md: args.summary_md ?? null,
      summary_highlights: (args.summary_highlights ?? []) as any,
    })
    .select("id")
    .single();
  if (error) throw error;

  if (args.citations.length) {
    await admin.from("onboarding_citations").insert(
      args.citations.map((c) => ({
        draft_id: draft.id,
        url: c.url,
        domain: c.domain ?? null,
        title: c.title ?? null,
      })),
    );
  }
  return draft.id as string;
}

// ============================================================
// LIST / READ
// ============================================================

export const listOnboardingCountries = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [countriesRes, runsRes] = await Promise.all([
      supabaseAdmin
        .from("countries")
        .select("code, name, iso3, gdp_current_usd, gdp_year, membership_tier")
        .order("name"),
      supabaseAdmin
        .from("onboarding_runs")
        .select("country_code, stage, status")
        .in("status", ["ready", "committed"]),
    ]);

    if (countriesRes.error) throw countriesRes.error;
    const runs = runsRes.data ?? [];
    const stagesByCountry = new Map<string, Set<string>>();
    for (const r of runs) {
      if (r.status !== "committed") continue;
      const s = stagesByCountry.get(r.country_code) ?? new Set<string>();
      s.add(r.stage);
      stagesByCountry.set(r.country_code, s);
    }
    return (countriesRes.data ?? []).map((c) => ({
      ...c,
      completed_stages: Array.from(stagesByCountry.get(c.code) ?? []),
    }));
  });

export const getOnboardingStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ countryCode: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [country, runs, drafts, cites, summaries] = await Promise.all([
      supabaseAdmin.from("countries").select("*").eq("code", data.countryCode).maybeSingle(),
      supabaseAdmin
        .from("onboarding_runs")
        .select("*")
        .eq("country_code", data.countryCode)
        .order("started_at", { ascending: false })
        .limit(50),
      supabaseAdmin
        .from("onboarding_drafts")
        .select("*")
        .eq("country_code", data.countryCode)
        .is("committed_at", null)
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("onboarding_citations")
        .select("*"),
      supabaseAdmin
        .from("onboarding_summaries")
        .select("*")
        .eq("country_code", data.countryCode),
    ]);

    const draftIds = new Set((drafts.data ?? []).map((d) => d.id));
    const cByDraft = new Map<string, any[]>();
    for (const c of cites.data ?? []) {
      if (!draftIds.has(c.draft_id)) continue;
      const arr = cByDraft.get(c.draft_id) ?? [];
      arr.push(c);
      cByDraft.set(c.draft_id, arr);
    }
    return {
      country: country.data,
      runs: runs.data ?? [],
      drafts: (drafts.data ?? []).map((d) => ({ ...d, citations: cByDraft.get(d.id) ?? [] })),
      summaries: summaries.data ?? [],
    };
  });


// ============================================================
// AGENTS
// ============================================================

// -------- Stage 1: profile --------

const ProfileSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    currency: { type: "string" },
    fiscal_year_start_month: { type: "integer", minimum: 1, maximum: 12 },
    population: { type: "number" },
    hdi: { type: ["number", "null"] },
    main_exports: { type: "array", items: { type: "string" } },
    government_type: { type: "string" },
    head_of_government: { type: "string" },
    notes: { type: "string" },
  },
  required: [
    "currency",
    "fiscal_year_start_month",
    "population",
    "main_exports",
    "government_type",
    "head_of_government",
    "notes",
  ],
} as const;

export const runProfileAgent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ countryCode: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const country = await loadCountry(supabaseAdmin, data.countryCode);

    const model: SonarModel = "sonar-pro";
    const runId = await openRun(supabaseAdmin, {
      country_code: data.countryCode,
      stage: "profile",
      userId: context.userId,
      model_stack: { perplexity: model },
    });

    try {
      const result = await callSonar({
        model,
        system:
          "You are a country-profile researcher. Answer with a single JSON object matching the schema. Use only authoritative sources (national statistics offices, IMF, World Bank, UN). Cite every fact.",
        user: `Research the country of ${country.name} (${country.iso3 ?? country.code}). Return: currency code (ISO 4217), fiscal year start month (1-12), most recent population, HDI (or null), top 3-5 export categories, government type, and current head of government (as of 2026). Use only official/multilateral sources.`,
        responseSchema: ProfileSchema as unknown as Record<string, unknown>,
        recency: "year",
      });

      const parsed = parseSonarJson<any>(result.content);
      if (!parsed) throw new Error("Perplexity returned no parseable JSON");

      const draftId = await saveDraft(supabaseAdmin, {
        run_id: runId,
        country_code: data.countryCode,
        stage: "profile",
        target_table: "countries",
        payload: parsed,
        confidence: result.citations.length >= 2 ? "high" : "medium",
        citations: result.citations,
      });

      await finishRun(supabaseAdmin, runId, { status: "ready" });
      return { runId, draftId, payload: parsed, citations: result.citations };
    } catch (err) {
      await finishRun(supabaseAdmin, runId, { status: "failed", error: (err as Error).message });
      throw err;
    }
  });

// -------- Stage 2: GDP --------

const GdpSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    gdp_current_usd: { type: "number", description: "Nominal GDP in current US dollars" },
    gdp_year: { type: "integer", minimum: 2010, maximum: 2030 },
    source_primary: { type: "string", description: "Primary source name (e.g. World Bank WDI, IMF WEO)" },
    source_secondary: { type: ["string", "null"] },
    notes: { type: "string" },
  },
  required: ["gdp_current_usd", "gdp_year", "source_primary", "notes"],
} as const;

export const runGdpAgent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ countryCode: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const country = await loadCountry(supabaseAdmin, data.countryCode);

    const model: SonarModel = "sonar-pro";
    const runId = await openRun(supabaseAdmin, {
      country_code: data.countryCode,
      stage: "gdp",
      userId: context.userId,
      model_stack: { perplexity: model },
    });

    try {
      const result = await callSonar({
        model,
        system:
          "You are a macro-economics researcher. Return a single JSON object. Cross-check GDP between World Bank WDI and IMF WEO — pick the most recent year where BOTH publish a figure. Cite both sources.",
        user: `What is the nominal GDP of ${country.name} in current US dollars, most recent year with an official figure? Prefer World Bank WDI and IMF WEO. Return the value in USD (not billions).`,
        responseSchema: GdpSchema as unknown as Record<string, unknown>,
        recency: "year",
      });

      const parsed = parseSonarJson<any>(result.content);
      if (!parsed) throw new Error("Perplexity returned no parseable JSON");

      const draftId = await saveDraft(supabaseAdmin, {
        run_id: runId,
        country_code: data.countryCode,
        stage: "gdp",
        target_table: "countries",
        payload: parsed,
        confidence: result.citations.length >= 2 ? "high" : "medium",
        citations: result.citations,
      });

      await finishRun(supabaseAdmin, runId, { status: "ready" });
      return { runId, draftId, payload: parsed, citations: result.citations };
    } catch (err) {
      await finishRun(supabaseAdmin, runId, { status: "failed", error: (err as Error).message });
      throw err;
    }
  });

// -------- Stage 3: sector composition --------

export const runSectorCompositionAgent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ countryCode: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const country = await loadCountry(supabaseAdmin, data.countryCode);
    const sectors = await loadSectors(supabaseAdmin);

    const model: SonarModel = "sonar-reasoning-pro";
    const runId = await openRun(supabaseAdmin, {
      country_code: data.countryCode,
      stage: "sector_composition",
      userId: context.userId,
      model_stack: { perplexity: model },
    });

    try {
      const sectorList = sectors.map((s) => `- ${s.code} (${s.label}${s.isic ? `, ISIC ${s.isic}` : ""})`).join("\n");
      const rowsSchema = {
        type: "object",
        additionalProperties: false,
        properties: {
          rows: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                sector_code: { type: "string" },
                share_pct: { type: "number", minimum: 0, maximum: 100 },
                confidence_grade: { type: "string", enum: ["A", "B", "C", "D", "F"] },
                rationale: { type: "string" },
              },
              required: ["sector_code", "share_pct", "confidence_grade", "rationale"],
            },
          },
          method_note: { type: "string" },
        },
        required: ["rows", "method_note"],
      } as const;

      const result = await callSonar({
        model,
        system:
          "You are a national-accounts analyst. Map the country's GDP by industry (ISIC A-U) into the given sector taxonomy. Return one row per sector code (use 0 if the sector is negligible). Shares must sum to ~100%. Use A/B for values from official national accounts, C for multilateral estimates, D/F for inference. Cite each source.",
        user: `Country: ${country.name} (${country.iso3 ?? country.code}).\n\nSector taxonomy (return one row per code):\n${sectorList}\n\nUse the most recent full-year national accounts. Prefer the country's Central Statistical Office, then ECCB / CDB / IMF / World Bank.`,
        responseSchema: rowsSchema as unknown as Record<string, unknown>,
        recency: "year",
      });

      const parsed = parseSonarJson<{ rows: any[]; method_note: string }>(result.content);
      if (!parsed?.rows?.length) throw new Error("Perplexity returned no rows");

      // Ensure every sector has a row (fill missing with 0)
      const bySector = new Map(parsed.rows.map((r) => [String(r.sector_code), r]));
      const complete = sectors.map(
        (s) =>
          bySector.get(s.code) ?? {
            sector_code: s.code,
            share_pct: 0,
            confidence_grade: "F",
            rationale: "Not returned by agent — defaulted to 0",
          },
      );
      const total = complete.reduce((sum, r) => sum + Number(r.share_pct ?? 0), 0);

      const draftId = await saveDraft(supabaseAdmin, {
        run_id: runId,
        country_code: data.countryCode,
        stage: "sector_composition",
        target_table: "country_sectors",
        payload: { rows: complete, method_note: parsed.method_note, total_pct: total },
        confidence: total >= 95 && total <= 105 && result.citations.length >= 2 ? "high" : "medium",
        citations: result.citations,
      });

      await finishRun(supabaseAdmin, runId, { status: "ready" });
      return { runId, draftId, rows: complete, total_pct: total, citations: result.citations };
    } catch (err) {
      await finishRun(supabaseAdmin, runId, { status: "failed", error: (err as Error).message });
      throw err;
    }
  });

// -------- Stage 4: ministries --------

export const runMinistriesAgent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ countryCode: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const country = await loadCountry(supabaseAdmin, data.countryCode);

    const model: SonarModel = "sonar-pro";
    const runId = await openRun(supabaseAdmin, {
      country_code: data.countryCode,
      stage: "ministries",
      userId: context.userId,
      model_stack: { perplexity: model },
    });

    try {
      const schema = {
        type: "object",
        additionalProperties: false,
        properties: {
          ministries: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                slug: { type: "string", description: "kebab-case identifier" },
                name: { type: "string", description: "Full official ministry name" },
                minister: { type: ["string", "null"] },
                mandate: { type: "string" },
              },
              required: ["slug", "name", "mandate"],
            },
          },
        },
        required: ["ministries"],
      } as const;

      const result = await callSonar({
        model,
        system:
          "You are a governance researcher. Return the current canonical ministries of the country. Prefer the official government portal.",
        user: `List the current cabinet ministries of ${country.name} as of 2026, with the full official name, current minister (if known), and a one-line mandate. Use the government's official website.`,
        responseSchema: schema as unknown as Record<string, unknown>,
        recency: "year",
      });

      const parsed = parseSonarJson<{ ministries: any[] }>(result.content);
      if (!parsed?.ministries?.length) throw new Error("Perplexity returned no ministries");

      const draftId = await saveDraft(supabaseAdmin, {
        run_id: runId,
        country_code: data.countryCode,
        stage: "ministries",
        target_table: "ministries",
        payload: parsed,
        confidence: result.citations.length >= 1 ? "high" : "low",
        citations: result.citations,
      });

      await finishRun(supabaseAdmin, runId, { status: "ready" });
      return { runId, draftId, ministries: parsed.ministries, citations: result.citations };
    } catch (err) {
      await finishRun(supabaseAdmin, runId, { status: "failed", error: (err as Error).message });
      throw err;
    }
  });

// -------- Stage 5: ministry ↔ sector map --------

export const runMinistrySectorMapAgent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ countryCode: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const country = await loadCountry(supabaseAdmin, data.countryCode);
    const sectors = await loadSectors(supabaseAdmin);
    const { data: ministries, error: mErr } = await supabaseAdmin
      .from("ministries")
      .select("id, slug, name")
      .eq("country_code", data.countryCode);
    if (mErr) throw mErr;
    if (!ministries?.length) throw new Error("Commit ministries first — none exist for this country");

    const model: SonarModel = "sonar-pro";
    const runId = await openRun(supabaseAdmin, {
      country_code: data.countryCode,
      stage: "ministry_sector_map",
      userId: context.userId,
      model_stack: { perplexity: model },
    });

    try {
      const schema = {
        type: "object",
        additionalProperties: false,
        properties: {
          mappings: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                ministry_slug: { type: "string" },
                sector_code: { type: "string" },
                weight: { type: "number", minimum: 0, maximum: 100, description: "Percentage responsibility 0-100" },
                rationale: { type: "string" },
              },
              required: ["ministry_slug", "sector_code", "weight", "rationale"],
            },
          },
        },
        required: ["mappings"],
      } as const;

      const sectorList = sectors.map((s) => `${s.code} (${s.label})`).join(", ");
      const ministryList = ministries.map((m) => `${m.slug} (${m.name})`).join("\n- ");
      const result = await callSonar({
        model,
        system:
          "You map ministerial portfolios to economic sectors. For each ministry, output the sectors it primarily oversees with a weight 0-100 representing its share of responsibility for that sector. Per-ministry weights across all its sectors should roughly sum to 100. Omit sectors a ministry has no role in.",
        user: `Country: ${country.name}. Sectors: ${sectorList}. Ministries:\n- ${ministryList}\n\nProvide the ministry→sector mapping using the country's official ministerial mandates.`,
        responseSchema: schema as unknown as Record<string, unknown>,
      });

      const parsed = parseSonarJson<{ mappings: any[] }>(result.content);
      if (!parsed?.mappings?.length) throw new Error("Perplexity returned no mappings");

      const draftId = await saveDraft(supabaseAdmin, {
        run_id: runId,
        country_code: data.countryCode,
        stage: "ministry_sector_map",
        target_table: "ministry_sectors",
        payload: parsed,
        confidence: result.citations.length >= 1 ? "medium" : "low",
        citations: result.citations,
      });

      await finishRun(supabaseAdmin, runId, { status: "ready" });
      return { runId, draftId, mappings: parsed.mappings, citations: result.citations };
    } catch (err) {
      await finishRun(supabaseAdmin, runId, { status: "failed", error: (err as Error).message });
      throw err;
    }
  });

// ============================================================
// COMMITS
// ============================================================

async function markDraftCommitted(admin: any, draftId: string, runId: string) {
  await admin.from("onboarding_drafts").update({ committed_at: new Date().toISOString(), needs_review: false }).eq("id", draftId);
  await admin.from("onboarding_runs").update({ status: "committed" }).eq("id", runId);
  await admin.from("audit_log").insert({
    action: "onboarding.commit",
    target_type: "draft",
    target_id: draftId,
  });
  // Fire-and-forget: generate a fresh executive summary for this stage.
  try {
    const { data: d } = await admin
      .from("onboarding_drafts")
      .select("country_code, stage")
      .eq("id", draftId)
      .maybeSingle();
    if (d?.country_code && d?.stage) {
      const { generateSummaryForStage } = await import("./summaries.functions");
      generateSummaryForStage(admin, d.country_code, d.stage as any, runId).catch((e) => {
        console.error("[onboarding] summary generation failed", d.stage, e);
      });
    }
  } catch (e) {
    console.error("[onboarding] summary hook lookup failed", e);
  }
}


const CommitInput = z.object({
  draftId: z.string().uuid(),
  editedPayload: z.any().optional(),
});

export const commitProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CommitInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: draft, error } = await supabaseAdmin
      .from("onboarding_drafts")
      .select("*")
      .eq("id", data.draftId)
      .single();
    if (error || !draft) throw new Error("Draft not found");
    const payload = (data.editedPayload ?? draft.payload) as Record<string, any>;

    const patch: Record<string, unknown> = {
      country_pack: { ...(payload.notes ? { profile_notes: payload.notes } : {}), profile: payload },
    };
    if (typeof payload.currency === "string") patch.currency = payload.currency;
    if (Number.isInteger(payload.fiscal_year_start_month))
      patch.fiscal_year_start_month = payload.fiscal_year_start_month;

    const { error: upErr } = await supabaseAdmin.from("countries").update(patch as any).eq("code", draft.country_code);
    if (upErr) throw upErr;
    await markDraftCommitted(supabaseAdmin, draft.id, draft.run_id);
    return { ok: true };
  });

export const commitGdp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CommitInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: draft, error } = await supabaseAdmin
      .from("onboarding_drafts")
      .select("*")
      .eq("id", data.draftId)
      .single();
    if (error || !draft) throw new Error("Draft not found");
    const payload = (data.editedPayload ?? draft.payload) as Record<string, any>;

    const { error: upErr } = await supabaseAdmin
      .from("countries")
      .update({
        gdp_current_usd: payload.gdp_current_usd,
        gdp_year: payload.gdp_year,
      })
      .eq("code", draft.country_code);
    if (upErr) throw upErr;
    await markDraftCommitted(supabaseAdmin, draft.id, draft.run_id);
    return { ok: true };
  });

export const commitSectorComposition = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CommitInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: draft, error } = await supabaseAdmin
      .from("onboarding_drafts")
      .select("*")
      .eq("id", data.draftId)
      .single();
    if (error || !draft) throw new Error("Draft not found");
    const payload = (data.editedPayload ?? draft.payload) as { rows: Array<{ sector_code: string; share_pct: number; confidence_grade: string }> };

    // Replace all rows for this country in one shot
    await supabaseAdmin.from("country_sectors").delete().eq("country_code", draft.country_code);
    const rows = payload.rows
      .filter((r) => Number(r.share_pct) > 0)
      .map((r) => ({
        country_code: draft.country_code,
        sector_code: r.sector_code,
        share_pct: r.share_pct,
        confidence_grade: r.confidence_grade || "C",
      }));
    if (rows.length) {
      const { error: insErr } = await supabaseAdmin.from("country_sectors").insert(rows);
      if (insErr) throw insErr;
    }
    await markDraftCommitted(supabaseAdmin, draft.id, draft.run_id);
    return { ok: true, inserted: rows.length };
  });

export const commitMinistries = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CommitInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: draft, error } = await supabaseAdmin
      .from("onboarding_drafts")
      .select("*")
      .eq("id", data.draftId)
      .single();
    if (error || !draft) throw new Error("Draft not found");
    const payload = (data.editedPayload ?? draft.payload) as { ministries: Array<{ slug: string; name: string }> };

    // Upsert by (country_code, slug); existing rows keep their id (used by ministry_sectors).
    const rows = payload.ministries.map((m, i) => ({
      country_code: draft.country_code,
      slug: m.slug,
      name: m.name,
      sort_order: (i + 1) * 10,
    }));
    const { error: upErr } = await supabaseAdmin
      .from("ministries")
      .upsert(rows, { onConflict: "country_code,slug" });
    if (upErr) throw upErr;
    await markDraftCommitted(supabaseAdmin, draft.id, draft.run_id);
    return { ok: true, upserted: rows.length };
  });

export const commitMinistrySectorMap = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CommitInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: draft, error } = await supabaseAdmin
      .from("onboarding_drafts")
      .select("*")
      .eq("id", data.draftId)
      .single();
    if (error || !draft) throw new Error("Draft not found");
    const payload = (data.editedPayload ?? draft.payload) as { mappings: Array<{ ministry_slug: string; sector_code: string; weight: number }> };

    const { data: ministries } = await supabaseAdmin
      .from("ministries")
      .select("id, slug")
      .eq("country_code", draft.country_code);
    const bySlug = new Map((ministries ?? []).map((m) => [m.slug, m.id as string]));

    const rows = payload.mappings
      .map((m) => {
        const ministry_id = bySlug.get(m.ministry_slug);
        if (!ministry_id) return null;
        return { ministry_id, sector_code: m.sector_code, weight: m.weight };
      })
      .filter((r): r is { ministry_id: string; sector_code: string; weight: number } => r !== null);

    // Wipe and reinsert for the country's ministries
    if (ministries?.length) {
      await supabaseAdmin
        .from("ministry_sectors")
        .delete()
        .in("ministry_id", ministries.map((m) => m.id));
    }
    if (rows.length) {
      const { error: insErr } = await supabaseAdmin.from("ministry_sectors").insert(rows);
      if (insErr) throw insErr;
    }
    await markDraftCommitted(supabaseAdmin, draft.id, draft.run_id);
    return { ok: true, inserted: rows.length };
  });

// ============================================================
// SUPER ADMIN UTILITIES
// ============================================================

export const assertSuperAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    return { ok: true };
  });

export const getPerplexityKeyStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    return { configured: Boolean(process.env.PERPLEXITY_API_KEY) };
  });

export const listOnboardingRuns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("onboarding_runs")
      .select("id, country_code, stage, status, started_at, finished_at, model_stack, cost_cents, error, countries(name)")
      .order("started_at", { ascending: false })
      .limit(200);
    if (error) throw error;
    return (data ?? []).map((r: any) => ({
      ...r,
      country_name: r.countries?.name ?? null,
    }));
  });
