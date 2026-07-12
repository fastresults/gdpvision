// AI-first corpus, KPI, sector-dossier, ministry deep-dive, and second-brain seed
// server functions. Wave 2 of the country onboarding pipeline.
//
// Same pattern as `agents.functions.ts`:
//   runXxxAgent      — Perplexity Sonar research → onboarding_drafts (needs review)
//   commitXxx        — writes reviewed draft into real tables
//
// Additionally: runCorpusIngest scrapes every active country_source via Firecrawl,
// chunks + embeds each into country_source_documents / country_source_chunks so
// Counsel/dossiers can retrieve with vector similarity.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { callSonar, parseSonarJson, type SonarCitation, type SonarModel } from "./perplexity.server";

type Stage =
  | "source_registry"
  | "kpi_seed"
  | "sector_dossier"
  | "ministry_deep_dive"
  | "corpus_ingest"
  | "second_brain_seed";

// ============================================================
// Small helpers (duplicated from agents.functions.ts to keep this file standalone)
// ============================================================

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
    .select("code, name, iso3, currency")
    .eq("code", code)
    .maybeSingle();
  if (error || !data) throw new Error(`Country ${code} not found`);
  return data as { code: string; name: string; iso3: string | null; currency: string };
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

async function markDraftCommitted(admin: any, draftId: string, runId: string) {
  await admin.from("onboarding_drafts")
    .update({ committed_at: new Date().toISOString(), needs_review: false })
    .eq("id", draftId);
  await admin.from("onboarding_runs").update({ status: "committed" }).eq("id", runId);
  await admin.from("audit_log").insert({
    action: "onboarding.commit",
    target_type: "draft",
    target_id: draftId,
  });
}

const CommitInput = z.object({
  draftId: z.string().uuid(),
  editedPayload: z.any().optional(),
});

// ============================================================
// Stage 6: Source registry
// ============================================================

const SourceRegistrySchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    sources: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          kind: { type: "string", enum: ["gov", "regional", "multilateral", "advisory", "ngo", "media", "summit", "other"] },
          org: { type: "string" },
          title: { type: "string" },
          url: { type: "string" },
          quality_score: { type: "integer", minimum: 1, maximum: 5 },
          tags: { type: "array", items: { type: "string" } },
          rationale: { type: "string" },
        },
        required: ["kind", "org", "title", "url", "quality_score", "tags", "rationale"],
      },
    },
  },
  required: ["sources"],
} as const;

export const runSourceRegistryAgent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ countryCode: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const country = await loadCountry(supabaseAdmin, data.countryCode);

    const model: SonarModel = "sonar-reasoning-pro";
    const runId = await openRun(supabaseAdmin, {
      country_code: data.countryCode,
      stage: "source_registry",
      userId: context.userId,
      model_stack: { perplexity: model },
    });

    try {
      const result = await callSonar({
        model,
        system:
          "You are a sovereign-intelligence librarian. Assemble a canonical, non-duplicative registry of the most authoritative URLs to monitor a country. Group by kind: gov (national ministries, statistics office, central bank, invest agencies, CBI/citizenship units), regional (ECCB, CDB, OECS, CARICOM), multilateral (IMF, World Bank, UN, PAHO, ECLAC, EU), advisory (industry advisory firms), ngo (research NGOs, foundations), media (recognised outlets covering the country), summit (relevant sector summits). Prefer official/institutional URLs over blog posts. quality_score: 5=official primary, 4=multilateral secondary, 3=recognised NGO/media, 2=advisory, 1=general. Return 20-40 sources.",
        user: `Country: ${country.name} (${country.iso3 ?? country.code}). Return a canonical source registry for monitoring this country's economy, governance, and communications environment. Include the country's own ministries, statistics office, central bank, invest agency, CBI unit if any, plus regional (ECCB/CDB/CARICOM/OECS if applicable), multilateral (IMF, WB, UN, PAHO), and recognised media/NGOs.`,
        responseSchema: SourceRegistrySchema as unknown as Record<string, unknown>,
      });

      const parsed = parseSonarJson<{ sources: any[] }>(result.content);
      if (!parsed?.sources?.length) throw new Error("Perplexity returned no sources");

      const draftId = await saveDraft(supabaseAdmin, {
        run_id: runId,
        country_code: data.countryCode,
        stage: "source_registry",
        target_table: "country_sources",
        payload: parsed,
        confidence: parsed.sources.length >= 15 && result.citations.length >= 2 ? "high" : "medium",
        citations: result.citations,
      });

      await finishRun(supabaseAdmin, runId, { status: "ready" });
      return { runId, draftId, count: parsed.sources.length, citations: result.citations };
    } catch (err) {
      await finishRun(supabaseAdmin, runId, { status: "failed", error: (err as Error).message });
      throw err;
    }
  });

export const commitSourceRegistry = createServerFn({ method: "POST" })
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
    const payload = (data.editedPayload ?? draft.payload) as { sources: Array<any> };

    let inserted = 0;
    for (const s of payload.sources) {
      let tld: string | null = null;
      try {
        tld = new URL(s.url).hostname.replace(/^www\./, "");
      } catch {
        /* skip invalid */
      }
      const { error: upErr } = await supabaseAdmin
        .from("country_sources")
        .upsert(
          {
            country_code: draft.country_code,
            kind: s.kind,
            org: s.org,
            title: s.title,
            url: s.url,
            tld,
            tags: Array.isArray(s.tags) ? s.tags : [],
            quality_score: Number(s.quality_score) || 3,
            active: true,
            created_by: context.userId,
          },
          { onConflict: "country_code,url", ignoreDuplicates: false },
        );
      if (!upErr) inserted++;
    }
    await markDraftCommitted(supabaseAdmin, draft.id, draft.run_id);
    return { ok: true, inserted };
  });

// ============================================================
// Stage 7: KPI seed
// ============================================================

const KpiSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    kpis: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          kpi_code: { type: "string", description: "snake_case, e.g. gdp_growth, cpi_yoy, debt_gdp" },
          label: { type: "string" },
          unit: { type: "string" },
          direction: { type: "string", enum: ["up", "down", "flat"] },
          category: { type: "string", enum: ["macro", "fiscal", "social", "external", "climate"] },
          latest_value: { type: ["number", "null"] },
          latest_period: { type: ["string", "null"] },
          target: { type: ["number", "null"] },
          source_url: { type: ["string", "null"] },
          notes: { type: "string" },
        },
        required: ["kpi_code", "label", "unit", "direction", "category", "latest_value", "latest_period", "notes"],
      },
    },
  },
  required: ["kpis"],
} as const;

export const runKpiSeedAgent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ countryCode: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const country = await loadCountry(supabaseAdmin, data.countryCode);

    const model: SonarModel = "sonar-pro";
    const runId = await openRun(supabaseAdmin, {
      country_code: data.countryCode,
      stage: "kpi_seed",
      userId: context.userId,
      model_stack: { perplexity: model },
    });

    try {
      const result = await callSonar({
        model,
        system:
          "You are a national KPI analyst. Return the canonical macro/fiscal/social/external/climate KPIs for a country with the most recent value from an authoritative source (WB, IMF, national CSO, central bank). Include at minimum: real GDP growth, CPI YoY, unemployment, debt/GDP, primary balance/GDP, current account/GDP, tourism arrivals, HDI. Use snake_case kpi_code. Set direction to up (higher is better), down (lower is better), or flat.",
        user: `Country: ${country.name} (${country.iso3 ?? country.code}). Return 10-15 canonical KPIs with the latest value and period.`,
        responseSchema: KpiSchema as unknown as Record<string, unknown>,
        recency: "year",
      });

      const parsed = parseSonarJson<{ kpis: any[] }>(result.content);
      if (!parsed?.kpis?.length) throw new Error("Perplexity returned no KPIs");

      const draftId = await saveDraft(supabaseAdmin, {
        run_id: runId,
        country_code: data.countryCode,
        stage: "kpi_seed",
        target_table: "country_kpis",
        payload: parsed,
        confidence: result.citations.length >= 2 ? "high" : "medium",
        citations: result.citations,
      });

      await finishRun(supabaseAdmin, runId, { status: "ready" });
      return { runId, draftId, count: parsed.kpis.length, citations: result.citations };
    } catch (err) {
      await finishRun(supabaseAdmin, runId, { status: "failed", error: (err as Error).message });
      throw err;
    }
  });

export const commitKpis = createServerFn({ method: "POST" })
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
    const payload = (data.editedPayload ?? draft.payload) as { kpis: Array<any> };

    // Try to link each KPI's source_url to an existing country_source
    const { data: sources } = await supabaseAdmin
      .from("country_sources")
      .select("id, url")
      .eq("country_code", draft.country_code);
    const byUrl = new Map((sources ?? []).map((s: any) => [s.url as string, s.id as string]));

    let upserted = 0;
    for (const k of payload.kpis) {
      const source_id = k.source_url ? byUrl.get(k.source_url) ?? null : null;
      const { error: upErr } = await supabaseAdmin.from("country_kpis").upsert(
        {
          country_code: draft.country_code,
          kpi_code: k.kpi_code,
          label: k.label,
          unit: k.unit,
          direction: k.direction || "up",
          category: k.category || "macro",
          source_id,
          latest_value: k.latest_value,
          latest_period: k.latest_period,
          target: k.target ?? null,
          notes: k.notes ?? null,
        },
        { onConflict: "country_code,kpi_code" },
      );
      if (!upErr) upserted++;
    }
    await markDraftCommitted(supabaseAdmin, draft.id, draft.run_id);
    return { ok: true, upserted };
  });

// ============================================================
// Stage 8: Sector dossiers (policy + comms + oecs per sector)
// ============================================================

const SectorDossierSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    dossiers: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          sector_code: { type: "string" },
          policy: {
            type: "object",
            additionalProperties: false,
            properties: {
              statutes: { type: "array", items: { type: "string" } },
              institutions: { type: "array", items: { type: "string" } },
              national_plans: { type: "array", items: { type: "string" } },
              regulatory_instruments: { type: "array", items: { type: "string" } },
            },
            required: ["statutes", "institutions", "national_plans", "regulatory_instruments"],
          },
          comms: {
            type: "object",
            additionalProperties: false,
            properties: {
              channels: { type: "array", items: { type: "string" } },
              spokespeople: { type: "array", items: { type: "string" } },
              narratives: { type: "array", items: { type: "string" } },
              reputation_risks: { type: "array", items: { type: "string" } },
            },
            required: ["channels", "spokespeople", "narratives", "reputation_risks"],
          },
          regional_benchmark: {
            type: "object",
            additionalProperties: false,
            properties: {
              peers: { type: "array", items: { type: "string" } },
              position: { type: "string", enum: ["leader", "average", "laggard"] },
              rationale: { type: "string" },
            },
            required: ["peers", "position", "rationale"],
          },
        },
        required: ["sector_code", "policy", "comms", "regional_benchmark"],
      },
    },
  },
  required: ["dossiers"],
} as const;

export const runSectorDossierAgent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ countryCode: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const country = await loadCountry(supabaseAdmin, data.countryCode);
    const { data: sectors } = await supabaseAdmin
      .from("country_sectors")
      .select("sector_code")
      .eq("country_code", data.countryCode);
    const sectorCodes = (sectors ?? []).map((s: any) => s.sector_code);
    if (!sectorCodes.length) throw new Error("Commit sector composition first — no country_sectors rows");

    const model: SonarModel = "sonar-reasoning-pro";
    const runId = await openRun(supabaseAdmin, {
      country_code: data.countryCode,
      stage: "sector_dossier",
      userId: context.userId,
      model_stack: { perplexity: model },
    });

    try {
      const result = await callSonar({
        model,
        system:
          "You are a sovereign sector analyst. For each sector code, return a policy stack (statutes, institutions, national plans, regulatory instruments), a comms stack (channels, spokespeople, dominant narratives, reputation risks), and a regional benchmark (peer countries, leader/average/laggard, rationale). Be concrete — use real institution and statute names.",
        user: `Country: ${country.name} (${country.iso3 ?? country.code}). Sector codes to profile: ${sectorCodes.join(", ")}. Return one dossier per sector code.`,
        responseSchema: SectorDossierSchema as unknown as Record<string, unknown>,
      });

      const parsed = parseSonarJson<{ dossiers: any[] }>(result.content);
      if (!parsed?.dossiers?.length) throw new Error("Perplexity returned no dossiers");

      const draftId = await saveDraft(supabaseAdmin, {
        run_id: runId,
        country_code: data.countryCode,
        stage: "sector_dossier",
        target_table: "sector_dossiers",
        payload: parsed,
        confidence: result.citations.length >= 2 ? "high" : "medium",
        citations: result.citations,
      });

      await finishRun(supabaseAdmin, runId, { status: "ready" });
      return { runId, draftId, count: parsed.dossiers.length, citations: result.citations };
    } catch (err) {
      await finishRun(supabaseAdmin, runId, { status: "failed", error: (err as Error).message });
      throw err;
    }
  });

export const commitSectorDossiers = createServerFn({ method: "POST" })
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
    const payload = (data.editedPayload ?? draft.payload) as { dossiers: Array<any> };

    let upserted = 0;
    for (const d of payload.dossiers) {
      for (const kind of ["policy", "comms", "oecs"] as const) {
        const kindPayload = kind === "oecs" ? d.regional_benchmark : d[kind];
        if (!kindPayload) continue;
        const { error: upErr } = await supabaseAdmin.from("sector_dossiers").upsert(
          {
            country_code: draft.country_code,
            sector_code: d.sector_code,
            kind,
            payload: kindPayload as any,
            source_ids: [],
            confidence: "medium",
          },
          { onConflict: "country_code,sector_code,kind" },
        );
        if (!upErr) upserted++;
      }
    }
    await markDraftCommitted(supabaseAdmin, draft.id, draft.run_id);
    return { ok: true, upserted };
  });

// ============================================================
// Stage 9: Ministry deep-dive
// ============================================================

const MinistryDeepDiveSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    ministries: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          ministry_slug: { type: "string" },
          minister: { type: ["string", "null"] },
          mandate: { type: "string" },
          programmes: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                name: { type: "string" },
                objective: { type: "string" },
                status: { type: "string" },
              },
              required: ["name", "objective", "status"],
            },
          },
        },
        required: ["ministry_slug", "mandate", "programmes"],
      },
    },
  },
  required: ["ministries"],
} as const;

export const runMinistryDeepDiveAgent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ countryCode: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const country = await loadCountry(supabaseAdmin, data.countryCode);
    const { data: ministries } = await supabaseAdmin
      .from("ministries")
      .select("slug, name")
      .eq("country_code", data.countryCode);
    if (!ministries?.length) throw new Error("Commit ministries first — none exist for this country");

    const model: SonarModel = "sonar-pro";
    const runId = await openRun(supabaseAdmin, {
      country_code: data.countryCode,
      stage: "ministry_deep_dive",
      userId: context.userId,
      model_stack: { perplexity: model },
    });

    try {
      const list = ministries.map((m: any) => `${m.slug} (${m.name})`).join("\n- ");
      const result = await callSonar({
        model,
        system:
          "You are a governance analyst. For each ministry, return the current minister (if known), a concrete mandate paragraph, and 2-5 flagship programmes with objective and status (active/planned/completed).",
        user: `Country: ${country.name}. Ministries:\n- ${list}\n\nReturn one entry per ministry_slug.`,
        responseSchema: MinistryDeepDiveSchema as unknown as Record<string, unknown>,
        recency: "year",
      });

      const parsed = parseSonarJson<{ ministries: any[] }>(result.content);
      if (!parsed?.ministries?.length) throw new Error("Perplexity returned no ministry entries");

      const draftId = await saveDraft(supabaseAdmin, {
        run_id: runId,
        country_code: data.countryCode,
        stage: "ministry_deep_dive",
        target_table: "ministry_profiles",
        payload: parsed,
        confidence: result.citations.length >= 1 ? "medium" : "low",
        citations: result.citations,
      });

      await finishRun(supabaseAdmin, runId, { status: "ready" });
      return { runId, draftId, count: parsed.ministries.length, citations: result.citations };
    } catch (err) {
      await finishRun(supabaseAdmin, runId, { status: "failed", error: (err as Error).message });
      throw err;
    }
  });

export const commitMinistryDeepDive = createServerFn({ method: "POST" })
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
    const payload = (data.editedPayload ?? draft.payload) as { ministries: Array<any> };

    let upserted = 0;
    for (const m of payload.ministries) {
      const { error: upErr } = await supabaseAdmin.from("ministry_profiles").upsert(
        {
          country_code: draft.country_code,
          ministry_slug: m.ministry_slug,
          minister: m.minister ?? null,
          mandate: m.mandate,
          programmes: m.programmes ?? [],
          source_ids: [],
        },
        { onConflict: "country_code,ministry_slug" },
      );
      if (!upErr) upserted++;
    }
    await markDraftCommitted(supabaseAdmin, draft.id, draft.run_id);
    return { ok: true, upserted };
  });

// ============================================================
// Stage 10: Corpus ingest — scrape + chunk + embed every active source
// ============================================================

export const runCorpusIngest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ countryCode: z.string(), limit: z.number().int().min(1).max(50).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { fetchFirecrawl, chunkText, embedBatch } = await import("./ingest.server");

    const { data: sources, error: sErr } = await supabaseAdmin
      .from("country_sources")
      .select("id, url, title, last_fetched_at")
      .eq("country_code", data.countryCode)
      .eq("active", true)
      .order("quality_score", { ascending: false })
      .limit(data.limit ?? 25);
    if (sErr) throw sErr;
    if (!sources?.length) throw new Error("Commit source registry first — no active sources");

    const runId = await openRun(supabaseAdmin, {
      country_code: data.countryCode,
      stage: "corpus_ingest",
      userId: context.userId,
      model_stack: { firecrawl: "v2", embeddings: "openai/text-embedding-3-small" },
    });

    const results: Array<{ source_id: string; url: string; ok: boolean; chunks?: number; error?: string }> = [];
    let totalChunks = 0;

    try {
      for (const src of sources) {
        try {
          // Skip if already have a document for this source in the last 24h
          const { data: existing } = await supabaseAdmin
            .from("country_source_documents")
            .select("id, fetched_at")
            .eq("country_source_id", src.id)
            .order("fetched_at", { ascending: false })
            .limit(1);
          if (existing?.[0]) {
            const ageMs = Date.now() - new Date(existing[0].fetched_at).getTime();
            if (ageMs < 24 * 60 * 60 * 1000) {
              results.push({ source_id: src.id, url: src.url, ok: true, chunks: 0 });
              continue;
            }
          }

          const doc = await fetchFirecrawl(src.url);
          if (!doc.markdown || doc.markdown.length < 200) {
            throw new Error(`too short: ${doc.markdown.length} chars`);
          }
          const chunks = chunkText(doc.markdown);
          if (!chunks.length) throw new Error("no chunks after split");

          // Insert document
          const { data: docRow, error: dErr } = await supabaseAdmin
            .from("country_source_documents")
            .insert({
              country_source_id: src.id,
              raw_text: doc.markdown,
              char_count: doc.markdown.length,
              chunk_count: chunks.length,
            })
            .select("id")
            .single();
          if (dErr || !docRow) throw new Error(dErr?.message ?? "doc insert failed");

          // Embed in batches of 64
          const vectors: number[][] = [];
          for (let i = 0; i < chunks.length; i += 64) {
            const batch = chunks.slice(i, i + 64);
            const embs = await embedBatch(batch);
            vectors.push(...embs);
          }

          const rows = chunks.map((c, idx) => ({
            document_id: docRow.id,
            country_code: data.countryCode,
            chunk_index: idx,
            content: c,
            // pgvector accepts a JSON-style array literal
            embedding: `[${vectors[idx].join(",")}]`,
          }));
          for (let i = 0; i < rows.length; i += 100) {
            const { error: cErr } = await supabaseAdmin.from("country_source_chunks").insert(rows.slice(i, i + 100));
            if (cErr) throw new Error(cErr.message);
          }

          await supabaseAdmin
            .from("country_sources")
            .update({ last_fetched_at: new Date().toISOString(), fetch_status: "ok", fetch_error: null })
            .eq("id", src.id);

          results.push({ source_id: src.id, url: src.url, ok: true, chunks: chunks.length });
          totalChunks += chunks.length;
        } catch (e: any) {
          const msg = e?.message ?? String(e);
          await supabaseAdmin
            .from("country_sources")
            .update({ last_fetched_at: new Date().toISOString(), fetch_status: "failed", fetch_error: msg.slice(0, 500) })
            .eq("id", src.id);
          results.push({ source_id: src.id, url: src.url, ok: false, error: msg });
        }
      }

      const okCount = results.filter((r) => r.ok).length;
      const failCount = results.length - okCount;

      // Save a summary draft so it appears in the wizard
      const draftId = await saveDraft(supabaseAdmin, {
        run_id: runId,
        country_code: data.countryCode,
        stage: "corpus_ingest",
        target_table: "country_source_chunks",
        payload: { results, totalChunks, okCount, failCount },
        confidence: failCount === 0 ? "high" : okCount > failCount ? "medium" : "low",
        citations: [],
      });
      // Auto-commit corpus ingest — nothing further for the user to edit
      await markDraftCommitted(supabaseAdmin, draftId, runId);

      return { ok: true, totalChunks, okCount, failCount, results };
    } catch (err) {
      await finishRun(supabaseAdmin, runId, { status: "failed", error: (err as Error).message });
      throw err;
    }
  });

// ============================================================
// Stage 11: Second-brain seed — memory_objects from committed sources
// ============================================================

const SecondBrainSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    memories: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          kind: { type: "string", enum: ["position", "audience", "outlet", "fact", "risk"] },
          title: { type: "string" },
          body: { type: "string" },
          sector_code: { type: "string" },
          weight: { type: "integer", minimum: 1, maximum: 5 },
        },
        required: ["kind", "title", "body", "sector_code", "weight"],
      },
    },
  },
  required: ["memories"],
} as const;

export const runSecondBrainSeedAgent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ countryCode: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const country = await loadCountry(supabaseAdmin, data.countryCode);
    const { data: sectors } = await supabaseAdmin
      .from("country_sectors")
      .select("sector_code")
      .eq("country_code", data.countryCode);
    const sectorCodes = (sectors ?? []).map((s: any) => s.sector_code);

    const model: SonarModel = "sonar-reasoning-pro";
    const runId = await openRun(supabaseAdmin, {
      country_code: data.countryCode,
      stage: "second_brain_seed",
      userId: context.userId,
      model_stack: { perplexity: model },
    });

    try {
      const result = await callSonar({
        model,
        system:
          "You are seeding an executive second-brain memory. Return 12-25 memory objects that anchor how the cabinet talks, decides, and defends its record. Kinds: position (settled policy stance), audience (internal or external audience with register), outlet (primary distribution channel), fact (durable statistic), risk (persistent reputational or fiscal risk). Weight 1-5 with 5 = load-bearing.",
        user: `Country: ${country.name}. Sectors: ${sectorCodes.join(", ") || "cross_cutting"}. Seed the second brain with cabinet positions, key audiences, communication outlets, durable facts, and standing risks.`,
        responseSchema: SecondBrainSchema as unknown as Record<string, unknown>,
      });

      const parsed = parseSonarJson<{ memories: any[] }>(result.content);
      if (!parsed?.memories?.length) throw new Error("Perplexity returned no memories");

      const draftId = await saveDraft(supabaseAdmin, {
        run_id: runId,
        country_code: data.countryCode,
        stage: "second_brain_seed",
        target_table: "memory_objects",
        payload: parsed,
        confidence: result.citations.length >= 2 ? "high" : "medium",
        citations: result.citations,
      });

      await finishRun(supabaseAdmin, runId, { status: "ready" });
      return { runId, draftId, count: parsed.memories.length, citations: result.citations };
    } catch (err) {
      await finishRun(supabaseAdmin, runId, { status: "failed", error: (err as Error).message });
      throw err;
    }
  });

export const commitSecondBrainSeed = createServerFn({ method: "POST" })
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
    const payload = (data.editedPayload ?? draft.payload) as { memories: Array<any> };

    let inserted = 0;
    for (const m of payload.memories) {
      const { data: existing } = await supabaseAdmin
        .from("memory_objects")
        .select("id")
        .eq("scope_key", draft.country_code)
        .eq("sector_code", m.sector_code)
        .eq("title", m.title)
        .maybeSingle();
      if (existing) continue;
      const { error: insErr } = await supabaseAdmin.from("memory_objects").insert({
        scope_key: draft.country_code,
        sector_code: m.sector_code,
        kind: m.kind,
        title: m.title,
        payload: { body: m.body } as any,
        weight: m.weight,
        verified: false,
        created_by: context.userId,
      });
      if (!insErr) inserted++;
    }
    await markDraftCommitted(supabaseAdmin, draft.id, draft.run_id);
    return { ok: true, inserted };
  });

// ============================================================
// Utility: connector / key status
// ============================================================

export const getIngestKeysStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    return {
      perplexity: Boolean(process.env.PERPLEXITY_API_KEY),
      firecrawl: Boolean(process.env.FIRECRAWL_API_KEY),
      lovable_ai: Boolean(process.env.LOVABLE_API_KEY),
    };
  });
