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
import { generateText } from "ai";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { callSonar, parseSonarJson, type SonarCitation, type SonarModel } from "./perplexity.server";
import { SUMMARY_SCHEMA_FRAGMENT, SUMMARY_SYSTEM_SUFFIX, extractInlineSummary } from "./summary-inline";
import { normalizeMemoryTitle, isUniqueViolation } from "./memory-dedup";
import { buildCapitalFlowsDraft } from "./capital-flows.server";

type Stage =
  | "source_registry"
  | "kpi_seed"
  | "sector_dossier"
  | "ministry_deep_dive"
  | "corpus_ingest"
  | "second_brain_seed"
  | "capital_flows";

// ============================================================
// Small helpers (duplicated from agents.functions.ts to keep this file standalone)
// ============================================================

export function isValidHttpUrl(raw: unknown): raw is string {
  if (typeof raw !== "string") return false;
  const s = raw.trim();
  if (!s || s.includes("(search:") || s.includes(" ")) return false;
  try {
    const u = new URL(s);
    if (u.protocol !== "http:" && u.protocol !== "https:") return false;
    if (!u.hostname.includes(".")) return false;
    return true;
  } catch {
    return false;
  }
}


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
    .select("code, name, iso3, currency, gdp_current_usd")
    .eq("code", code)
    .maybeSingle();
  if (error || !data) throw new Error(`Country ${code} not found`);
  return data as { code: string; name: string; iso3: string | null; currency: string; gdp_current_usd: number | null };
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
  if (error) {
    if ((error as any).code === "23505") {
      throw new Error(
        `A ${params.stage} run is already in progress for ${params.country_code}. Refresh to see live progress; stale runs auto-clear when their heartbeat is quiet for 45 minutes.`,
      );
    }
    throw error;
  }
  return data.id as string;
}

async function finishRun(admin: any, runId: string, patch: Record<string, unknown>) {
  await admin
    .from("onboarding_runs")
    .update({ ...patch, finished_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", runId);
}

async function updateRunPlan(admin: any, runId: string | null, plan: Record<string, unknown>) {
  if (!runId) return;
  try {
    await admin.from("onboarding_runs").update({ plan, updated_at: new Date().toISOString() }).eq("id", runId);
  } catch {
    /* heartbeat/progress is best-effort */
  }
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
  // One live uncommitted draft is allowed per (country, stage). Re-runs update
  // that live draft instead of tripping the unique index; committed drafts stay
  // immutable audit history.
  const patch = {
    run_id: args.run_id,
    country_code: args.country_code,
    stage: args.stage,
    target_table: args.target_table,
    payload: args.payload as any,
    confidence: args.confidence,
    needs_review: true,
    summary_md: args.summary_md ?? null,
    summary_highlights: (args.summary_highlights ?? []) as any,
    updated_at: new Date().toISOString(),
  };

  const { data: existing, error: existingError } = await admin
    .from("onboarding_drafts")
    .select("id")
    .eq("country_code", args.country_code)
    .eq("stage", args.stage)
    .is("committed_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existingError) throw existingError;

  let draftResult = existing?.id
    ? await admin
        .from("onboarding_drafts")
        .update(patch)
        .eq("id", existing.id)
        .select("id")
        .single()
    : await admin
        .from("onboarding_drafts")
        .insert(patch)
        .select("id")
        .single();
  if (draftResult.error && (draftResult.error as any).code === "23505") {
    const { data: racedExisting, error: racedExistingError } = await admin
      .from("onboarding_drafts")
      .select("id")
      .eq("country_code", args.country_code)
      .eq("stage", args.stage)
      .is("committed_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (racedExistingError) throw racedExistingError;
    if (racedExisting?.id) {
      draftResult = await admin
        .from("onboarding_drafts")
        .update(patch)
        .eq("id", racedExisting.id)
        .select("id")
        .single();
    }
  }
  if (draftResult.error) throw draftResult.error;
  const draft = draftResult.data;
  await admin.from("onboarding_citations").delete().eq("draft_id", draft.id);
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
  // Prefer the inline summary the agent already produced. Only fall back to a
  // second AI call if this draft never carried one (legacy or multi-call stages).
  try {
    const { data: d } = await admin
      .from("onboarding_drafts")
      .select("country_code, stage, summary_md, summary_highlights")
      .eq("id", draftId)
      .maybeSingle();
    if (!d?.country_code || !d?.stage) return;

    if (d.summary_md && String(d.summary_md).trim().length > 0) {
      await admin
        .from("onboarding_summaries")
        .upsert(
          {
            country_code: d.country_code,
            stage: d.stage,
            summary_md: d.summary_md,
            highlights: Array.isArray(d.summary_highlights) ? d.summary_highlights : [],
            model: "inline-agent",
            source_run_id: runId,
            generated_at: new Date().toISOString(),
          },
          { onConflict: "country_code,stage" },
        );
      return;
    }

    const { generateSummaryForStage } = await import("./summaries.functions");
    generateSummaryForStage(admin, d.country_code, d.stage as any, runId).catch((e) => {
      console.error("[onboarding] summary generation failed", d.stage, e);
    });
  } catch (e) {
    console.error("[onboarding] summary hook lookup failed", e);
  }
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
          url: { type: "string", format: "uri", pattern: "^https?://", minLength: 8 },
          quality_score: { type: "integer", minimum: 1, maximum: 5 },
          tags: { type: "array", items: { type: "string" } },
          rationale: { type: "string" },
        },
        required: ["kind", "org", "title", "url", "quality_score", "tags", "rationale"],
      },
    },
    ...SUMMARY_SCHEMA_FRAGMENT,
  },
  required: ["sources", "summary_md", "summary_highlights"],
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
      const runAttempt = async (model: SonarModel, noDomainFilter = false) =>
        callSonar({
          model,
          system:
            "You are a sovereign-intelligence librarian. Assemble a canonical, non-duplicative registry of the most authoritative URLs to monitor a country. Group by kind: gov (national ministries, statistics office, central bank, invest agencies, CBI/citizenship units), regional (ECCB, CDB, OECS, CARICOM), multilateral (IMF, World Bank, UN, PAHO, ECLAC, EU), advisory (industry advisory firms), ngo (research NGOs, foundations), media (recognised outlets covering the country), summit (relevant sector summits). Prefer official/institutional URLs over blog posts. quality_score: 5=official primary, 4=multilateral secondary, 3=recognised NGO/media, 2=advisory, 1=general. Return 20-40 sources. CRITICAL: Every source MUST include a working absolute https:// URL to the organisation's homepage or the specific resource. NEVER return an empty url, a placeholder, or a relative path. If you cannot find a working URL for a candidate, DROP that candidate entirely — do not include it in the response." +
            SUMMARY_SYSTEM_SUFFIX,
          user: `Country: ${country.name} (${country.iso3 ?? country.code}). Return a canonical source registry for monitoring this country's economy, governance, and communications environment. Include the country's own ministries, statistics office, central bank, invest agency, CBI unit if any, plus regional (ECCB/CDB/CARICOM/OECS if applicable), multilateral (IMF, WB, UN, PAHO), and recognised media/NGOs. Every entry MUST have a working https:// url.`,
          responseSchema: SourceRegistrySchema as unknown as Record<string, unknown>,
          noDomainFilter,
        });

      let result = await runAttempt(model);
      let parsed = parseSonarJson<{ sources: any[] }>(result.content);
      let validSources = (parsed?.sources ?? []).filter((s) => isValidHttpUrl(s?.url));

      // Retry Tier 2 (sonar-pro, open web) when the extraction produced too few real URLs.
      if (validSources.length < 10) {
        const retry = await runAttempt("sonar-pro", true);
        const retryParsed = parseSonarJson<{ sources: any[] }>(retry.content);
        const retryValid = (retryParsed?.sources ?? []).filter((s) => isValidHttpUrl(s?.url));
        if (retryValid.length > validSources.length) {
          result = retry;
          parsed = retryParsed;
          validSources = retryValid;
        }
      }

      if (!parsed || !validSources.length) throw new Error("Perplexity returned no sources with valid URLs");
      parsed.sources = validSources;
      const inline = extractInlineSummary(parsed);

      const draftId = await saveDraft(supabaseAdmin, {
        run_id: runId,
        country_code: data.countryCode,
        stage: "source_registry",
        target_table: "country_sources",
        payload: parsed,
        confidence: validSources.length >= 15 && result.citations.length >= 2 ? "high" : "medium",
        citations: result.citations,
        summary_md: inline.summary_md,
        summary_highlights: inline.summary_highlights,
      });

      await finishRun(supabaseAdmin, runId, { status: "ready" });
      return { runId, draftId, count: validSources.length, citations: result.citations };
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

    const { upsertCountrySource } = await import("@/lib/country-data/sources.server");
    let inserted = 0;
    const rejected: Array<{ url: string; title: string; reason: string }> = [];
    for (const s of payload.sources) {
      if (!isValidHttpUrl(s?.url)) {
        rejected.push({ url: String(s?.url ?? ""), title: String(s?.title ?? ""), reason: "not a valid http(s) URL" });
        continue;
      }
      const res = await upsertCountrySource(supabaseAdmin, {
        country_code: draft.country_code,
        url: s.url,
        title: s.title,
        org: s.org,
        kind: s.kind,
        tags: Array.isArray(s.tags) ? s.tags : [],
        quality_score: Number(s.quality_score) || 3,
        active: true,
        created_by: context.userId,
      });
      if (res) {
        inserted++;
      } else {
        rejected.push({ url: String(s.url ?? ""), title: String(s?.title ?? ""), reason: "source upsert failed" });
      }
    }

    if (inserted === 0) {
      const sample = rejected.slice(0, 3).map((r) => `${r.url || "(empty)"} — ${r.reason}`).join("; ");
      throw new Error(
        `Commit rejected: 0 valid sources inserted. ${rejected.length} row(s) rejected. Sample: ${sample}`,
      );
    }

    await markDraftCommitted(supabaseAdmin, draft.id, draft.run_id);
    return { ok: true, inserted, rejected };
  });

// Admin-only cleanup: deactivate country_sources rows whose url isn't a valid http(s) URL.
export const cleanInvalidCountrySources = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ countryCode: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("country_sources")
      .select("id, url, title")
      .eq("country_code", data.countryCode)
      .eq("active", true);
    if (error) throw error;
    const bad = (rows ?? []).filter((r: any) => !isValidHttpUrl(r.url));
    if (!bad.length) return { deactivated: 0, examples: [] as Array<{ id: string; url: string; title: string }> };
    const ids = bad.map((r: any) => r.id as string);
    const { error: uErr } = await supabaseAdmin
      .from("country_sources")
      .update({ active: false, fetch_status: "invalid_url", fetch_error: "URL not http(s) parseable" })
      .in("id", ids);
    if (uErr) throw uErr;
    const examples = bad.slice(0, 5).map((r: any) => ({
      id: String(r.id),
      url: String(r.url ?? ""),
      title: String(r.title ?? ""),
    }));
    return { deactivated: bad.length, examples };
  });

// Lightweight poll target for the wizard's run banner.
export const getRunProgress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    runId: z.string().uuid().optional(),
    countryCode: z.string().optional(),
    stage: z.string().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let query = supabaseAdmin
      .from("onboarding_runs")
      .select("id, country_code, stage, status, plan, started_at, updated_at, finished_at, error");
    if (data.runId) {
      query = query.eq("id", data.runId).limit(1);
    } else if (data.countryCode && data.stage) {
      query = query
        .eq("country_code", data.countryCode)
        .eq("stage", data.stage)
        .in("status", ["planning", "ready", "needs_review", "failed"])
        .order("started_at", { ascending: false })
        .limit(1);
    } else {
      throw new Error("runId or countryCode+stage is required");
    }
    const { data: rows, error } = await query;
    if (error) throw error;
    return Array.isArray(rows) ? rows[0] ?? null : rows ?? null;
  });


// ============================================================
// Stage 7: KPI seed — agentic multi-pass loop
// ============================================================

async function recordAttempts(
  admin: any,
  runId: string,
  countryCode: string,
  attempts: Array<import("./kpi-research.server").AttemptRecord>,
) {
  if (!attempts.length) return;
  const rows = attempts.map((a) => ({
    run_id: runId,
    country_code: countryCode,
    kpi_code: a.kpi_code,
    pass: a.pass,
    provider: a.provider,
    model: a.model ?? null,
    ok: a.ok,
    value: a.value,
    period: a.period,
    source_url: a.source_url,
    error: a.error,
  }));
  // Best-effort — never fail the loop because logging failed.
  try {
    await admin.from("kpi_research_attempts").insert(rows);
  } catch (err) {
    console.error("[kpi_seed] attempt logging failed", err);
  }
}

type KpiProgressState = {
  phase: string;
  processed: number;
  total: number;
  okCount: number;
  failCount: number;
  currentKpi?: string | null;
  filled?: number;
  missing?: number;
};

async function runAgenticKpiLoop(args: {
  admin: any;
  runId: string | null;
  country: { code: string; name: string; iso3: string | null };
  countryTld?: string;
  runInference?: boolean;
}) {
  const { registryFor, findRegistryEntry } = await import("./kpi-registry");
  const research = await import("./kpi-research.server");
  const registry = registryFor(["all"]);
  const values = new Map<string, import("./kpi-research.server").ResearchedValue>();
  const allAttempts: Array<import("./kpi-research.server").AttemptRecord> = [];
  const progress: KpiProgressState = {
    phase: "initializing",
    processed: 0,
    total: registry.length,
    okCount: 0,
    failCount: 0,
    currentKpi: null,
  };
  const writeProgress = async (patch: Partial<KpiProgressState> = {}) => {
    Object.assign(progress, patch);
    const coverageNow = research.coverageOf(registry, values);
    await updateRunPlan(args.admin, args.runId, {
      kind: "kpi_seed_progress",
      ...progress,
      filled: coverageNow.filled,
      missing: coverageNow.missing.length,
      missingKpis: coverageNow.missing,
      updatedAt: new Date().toISOString(),
    });
  };
  const persistAttempts = async (attempts: Array<import("./kpi-research.server").AttemptRecord>) => {
    if (!attempts.length) return;
    allAttempts.push(...attempts);
    progress.okCount += attempts.filter((a) => a.ok).length;
    progress.failCount += attempts.filter((a) => !a.ok).length;
    if (args.runId) await recordAttempts(args.admin, args.runId, args.country.code, attempts);
  };

  await writeProgress({ phase: "sweep", processed: 0, total: registry.length });

  // Pass A — broad sweep
  const sweep = await research.sweepPerplexity({
    country: args.country,
    registry,
    countryTld: args.countryTld,
  });
  for (const v of sweep.values) research.mergeInto(values, research.normalizeValue(v));
  await persistAttempts(sweep.attempts);
  await writeProgress({ phase: "worldbank", processed: 0, total: registry.length, currentKpi: null });

  // Pass B — World Bank backfill
  const missingAfterA = registry.filter(
    (k) => !values.get(k.kpi_code) || values.get(k.kpi_code)!.value == null,
  );
  const iso3 = args.country.iso3 ?? args.country.code;
  for (let i = 0; i < missingAfterA.length; i++) {
    const k = missingAfterA[i];
    await writeProgress({ phase: "worldbank", processed: i, total: missingAfterA.length, currentKpi: k.kpi_code });
    const { value, attempt } = await research.backfillWorldBank(iso3, k);
    await persistAttempts([attempt]);
    if (value) research.mergeInto(values, research.normalizeValue(value));
  }
  await writeProgress({ phase: "imf", processed: 0, currentKpi: null });

  // Pass C — IMF backfill
  const missingAfterB = registry.filter(
    (k) => !values.get(k.kpi_code) || values.get(k.kpi_code)!.value == null,
  );
  for (let i = 0; i < missingAfterB.length; i++) {
    const k = missingAfterB[i];
    await writeProgress({ phase: "imf", processed: i, total: missingAfterB.length, currentKpi: k.kpi_code });
    const { value, attempt } = await research.backfillImf(iso3, k);
    await persistAttempts([attempt]);
    if (value) research.mergeInto(values, research.normalizeValue(value));
  }
  await writeProgress({ phase: "targeted", processed: 0, currentKpi: null });

  // Pass D — targeted Perplexity
  const missingAfterC = registry.filter(
    (k) => !values.get(k.kpi_code) || values.get(k.kpi_code)!.value == null,
  );
  for (let i = 0; i < missingAfterC.length; i++) {
    const k = missingAfterC[i];
    await writeProgress({ phase: "targeted", processed: i, total: missingAfterC.length, currentKpi: k.kpi_code });
    const { value, attempt } = await research.targetedPerplexity({
      country: args.country,
      kpi: k,
      countryTld: args.countryTld,
    });
    await persistAttempts([attempt]);
    if (value) research.mergeInto(values, research.normalizeValue(value));
  }
  await writeProgress({ phase: "escalation", processed: 0, currentKpi: null });

  // Pass E — Gemini escalation
  const missingAfterD = registry.filter(
    (k) => !values.get(k.kpi_code) || values.get(k.kpi_code)!.value == null,
  );
  for (let i = 0; i < missingAfterD.length; i++) {
    const k = missingAfterD[i];
    await writeProgress({ phase: "escalation", processed: i, total: missingAfterD.length, currentKpi: k.kpi_code });
    const { value, attempt } = await research.escalateGemini({
      country: args.country,
      kpi: k,
    });
    await persistAttempts([attempt]);
    if (value) research.mergeInto(values, research.normalizeValue(value));
  }
  await writeProgress({ phase: "inference", processed: 0, currentKpi: null });

  // Pass F — AI inference for whatever is still null.
  const inferred = new Map<string, import("./kpi-inference.server").InferenceResult>();
  if (args.runInference !== false) {
    const inferMod = await import("./kpi-inference.server");
    const missingAfterE = registry.filter(
      (k) => !values.get(k.kpi_code) || values.get(k.kpi_code)!.value == null,
    );
    for (let i = 0; i < missingAfterE.length; i++) {
      const k = missingAfterE[i];
      await writeProgress({ phase: "inference", processed: i, total: missingAfterE.length, currentKpi: k.kpi_code });
      const { result, attempt } = await inferMod.inferOneKpi({
        admin: args.admin,
        country: args.country,
        kpi: k,
      });
      await persistAttempts([{
        kpi_code: attempt.kpi_code,
        pass: "escalation", // reuse enum: dedicated 'inference' would need a migration
        provider: "lovable-ai",
        model: attempt.model,
        ok: attempt.ok,
        value: attempt.value,
        period: attempt.period,
        source_url: attempt.source_url,
        error: attempt.error ? `inference: ${attempt.error}` : null,
      }]);
      if (result) {
        inferred.set(k.kpi_code, result);
        research.mergeInto(values, {
          kpi_code: result.kpi_code,
          value: result.value,
          period: result.period,
          source_url: result.source_url,
          source_org: result.source_org,
          notes: `Inferred (${result.confidence}) via ${result.model}`,
        });
      }
    }
  }

  // Ensure every registry entry is represented (even if still null).
  for (const k of registry) {
    if (!values.has(k.kpi_code)) {
      values.set(k.kpi_code, {
        kpi_code: k.kpi_code,
        value: null,
        period: null,
        source_url: null,
        source_org: null,
        notes: "not found after research + inference",
      });
    }
  }

  const coverage = research.coverageOf(registry, values);
  await writeProgress({ phase: "drafting", processed: registry.length, total: registry.length, currentKpi: null });
  const enriched = registry.map((k) => {
    const v = values.get(k.kpi_code)!;
    const inf = inferred.get(k.kpi_code);
    return {
      kpi_code: k.kpi_code,
      label: k.label,
      unit: k.unit,
      direction: k.direction,
      category: k.category,
      latest_value: v.value,
      latest_period: v.period,
      target: null,
      source_url: v.source_url,
      source_org: v.source_org,
      notes: v.notes,
      required: k.required,
      inference: inf ?? null,
    };
  });
  // Silence unused import warning — findRegistryEntry kept for future use.
  void findRegistryEntry;

  return { enriched, coverage, attempts: allAttempts, inferredCount: inferred.size };
}

export const runKpiSeedAgent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ countryCode: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const country = await loadCountry(supabaseAdmin, data.countryCode);

    const runId = await openRun(supabaseAdmin, {
      country_code: data.countryCode,
      stage: "kpi_seed",
      userId: context.userId,
      model_stack: {
        perplexity: "sonar-pro",
        lovable_ai: "google/gemini-2.5-pro",
        worldbank: "wdi-api",
        imf: "datamapper-api",
      },
    });

    try {
      const { runKpiSeedResearch } = await import("./kpi-seed.server");
      return await runKpiSeedResearch({
        admin: supabaseAdmin,
        runId,
        country: { code: country.code, name: country.name, iso3: country.iso3 },
        userId: context.userId,
      });
    } catch (err) {
      await finishRun(supabaseAdmin, runId, { status: "failed", error: (err as Error).message });
      throw err;
    }
  });

// ============================================================
// Source auto-attach + upsert (used by commit, backfill, re-verify)
// ============================================================

const ORG_QUALITY: Record<string, number> = {
  "World Bank": 5,
  "IMF WEO": 5,
  "IMF": 5,
  "UN": 5,
  "UNDP": 5,
  "WHO": 5,
  "ILO": 5,
  "OECS": 4,
  "CDB": 4,
  "ECCB": 4,
  "CARICOM": 4,
};

async function attachOrCreateSource(
  admin: any,
  countryCode: string,
  sourceUrl: string | null,
  sourceOrg: string | null,
  userId: string,
): Promise<string | null> {
  if (!sourceUrl) return null;
  const { upsertCountrySource, resolveKpiProvider, hostOf } = await import("@/lib/country-data/sources.server");
  const canon = resolveKpiProvider(countryCode, sourceUrl);
  const org = canon?.org ?? sourceOrg ?? hostOf(sourceUrl) ?? "Auto";
  const quality = canon?.quality ?? ORG_QUALITY[org] ?? 3;
  const res = await upsertCountrySource(admin, {
    country_code: countryCode,
    url: sourceUrl,
    title: canon?.title ?? `${org} — KPI source`,
    org,
    kind: "kpi_source",
    tags: ["auto", "kpi"],
    quality_score: quality,
    active: true,
    created_by: userId,
  });
  return res?.id ?? null;
}


async function upsertResolvedKpi(
  admin: any,
  countryCode: string,
  userId: string,
  k: {
    kpi_code: string;
    label: string;
    unit: string;
    direction: string;
    category: string;
    latest_value: number | null;
    latest_period: string | null;
    target?: number | null;
    source_url: string | null;
    source_org: string | null;
    notes?: string | null;
    inference?: import("./kpi-inference.server").InferenceResult | null;
  },
) {
  const source_id = await attachOrCreateSource(
    admin,
    countryCode,
    k.source_url,
    k.source_org,
    userId,
  );
  const isInferred = !!k.inference && k.latest_value != null;
  const freshness_status = k.latest_value == null ? "missing" : "fresh";
  const provenance = isInferred ? "inferred" : "verified";

  // Preserve inference_history: append prior inference when overwriting.
  let inferenceHistory: unknown[] | undefined;
  if (isInferred) {
    const { data: prior } = await admin
      .from("country_kpis")
      .select("inference_history, provenance, inference_rationale, inference_model, latest_value, inferred_at")
      .eq("country_code", countryCode)
      .eq("kpi_code", k.kpi_code)
      .maybeSingle();
    const hist = Array.isArray(prior?.inference_history) ? (prior!.inference_history as unknown[]) : [];
    if (prior?.provenance === "inferred" && prior.latest_value != null) {
      hist.push({
        value: prior.latest_value,
        model: prior.inference_model,
        rationale: prior.inference_rationale,
        inferred_at: prior.inferred_at,
      });
    }
    inferenceHistory = hist.slice(-10); // keep last 10
  }

  const row: Record<string, unknown> = {
    country_code: countryCode,
    kpi_code: k.kpi_code,
    label: k.label,
    unit: k.unit,
    direction: k.direction || "up",
    category: k.category || "macro",
    source_id,
    source_url: k.source_url ?? null,

    latest_value: k.latest_value,
    latest_period: k.latest_period,
    target: k.target ?? null,
    notes: k.notes ?? null,
    freshness_status,
    last_verified_at: new Date().toISOString(),
    research_notes: k.notes ?? null,
    provenance,
  };
  if (isInferred && k.inference) {
    row.confidence = k.inference.confidence;
    row.inference_rationale = k.inference.rationale;
    row.inference_evidence = {
      assumptions: k.inference.assumptions,
      evidence: k.inference.evidence,
    };
    row.inference_model = k.inference.model;
    row.inferred_at = new Date().toISOString();
    if (inferenceHistory) row.inference_history = inferenceHistory;
    // Clear admin fields so a new inference is reviewable again.
    row.verified_by = null;
    row.verified_at = null;
    row.admin_note = null;
  } else {
    // Clear inference-specific fields on a verified overwrite.
    row.confidence = null;
    row.inference_rationale = null;
    row.inference_evidence = null;
    row.inference_model = null;
    row.inferred_at = null;
  }

  const { error } = await admin.from("country_kpis").upsert(row, { onConflict: "country_code,kpi_code" });
  return { ok: !error, error: error?.message ?? null, source_id };
}

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
    const payload = (data.editedPayload ?? draft.payload) as {
      kpis: Array<{
        kpi_code: string;
        label: string;
        unit: string;
        direction: string;
        category: string;
        latest_value: number | null;
        latest_period: string | null;
        target: number | null;
        source_url: string | null;
        source_org: string | null;
        notes: string | null;
        inference?: import("./kpi-inference.server").InferenceResult | null;
      }>;
    };

    let upserted = 0;
    for (const k of payload.kpis) {
      const { ok } = await upsertResolvedKpi(
        supabaseAdmin,
        draft.country_code,
        context.userId,
        k,
      );
      if (ok) upserted++;
    }
    if (upserted === 0) {
      throw new Error("Commit rejected: KPI draft wrote 0 target rows. Draft remains open.");
    }
    await markDraftCommitted(supabaseAdmin, draft.id, draft.run_id);
    return { ok: true, upserted };
  });

// ============================================================
// On-demand: backfill only KPIs that are still missing / stale
// ============================================================

export const backfillMissingKpis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      countryCode: z.string(),
      staleOlderThanDays: z.number().int().min(1).max(365).default(90),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const country = await loadCountry(supabaseAdmin, data.countryCode);

    const runId = await openRun(supabaseAdmin, {
      country_code: data.countryCode,
      stage: "kpi_seed",
      userId: context.userId,
      model_stack: { mode: "backfill" },
    });

    try {
      const { runKpiSeedResearch } = await import("./kpi-seed.server");
      const res = await runKpiSeedResearch({
        admin: supabaseAdmin,
        runId,
        country: { code: country.code, name: country.name, iso3: country.iso3 },
        userId: context.userId,
        autoCommit: true,
      });
      return { ok: true, touched: res.upserted, coverage: res.coverage };
    } catch (err) {
      await finishRun(supabaseAdmin, runId, { status: "failed", error: (err as Error).message });
      throw err;
    }
  });

export const reverifyAllKpis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ countryCode: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const country = await loadCountry(supabaseAdmin, data.countryCode);
    const runId = await openRun(supabaseAdmin, {
      country_code: data.countryCode,
      stage: "kpi_seed",
      userId: context.userId,
      model_stack: { mode: "reverify" },
    });
    try {
      const { runKpiSeedResearch } = await import("./kpi-seed.server");
      const res = await runKpiSeedResearch({
        admin: supabaseAdmin,
        runId,
        country: { code: country.code, name: country.name, iso3: country.iso3 },
        userId: context.userId,
        autoCommit: true,
      });
      return { ok: true, touched: res.upserted, coverage: res.coverage };
    } catch (err) {
      await finishRun(supabaseAdmin, runId, { status: "failed", error: (err as Error).message });
      throw err;
    }
  });

export const listKpiCoverage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ countryCode: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { registryFor } = await import("./kpi-registry");
    const registry = registryFor(["all"]);
    const { data: rows } = await supabaseAdmin
      .from("country_kpis")
      .select("kpi_code, latest_value, last_verified_at, freshness_status, research_notes, provenance, confidence")
      .eq("country_code", data.countryCode);
    const byCode = new Map((rows ?? []).map((r: any) => [r.kpi_code as string, r]));

    // Latest attempt error per KPI for the UI.
    const { data: attempts } = await supabaseAdmin
      .from("kpi_research_attempts")
      .select("kpi_code, pass, provider, ok, error, created_at")
      .eq("country_code", data.countryCode)
      .order("created_at", { ascending: false })
      .limit(500);
    const latestAttempt = new Map<string, any>();
    for (const a of attempts ?? []) {
      if (!latestAttempt.has(a.kpi_code)) latestAttempt.set(a.kpi_code, a);
    }

    const required = registry.filter((k) => k.required);
    const verifiedRequired = required.filter((k) => {
      const r: any = byCode.get(k.kpi_code);
      return r?.latest_value != null && r?.provenance !== "inferred";
    });
    const inferredRequired = required.filter((k) => {
      const r: any = byCode.get(k.kpi_code);
      return r?.latest_value != null && r?.provenance === "inferred";
    });
    const filled = required.filter((k) => byCode.get(k.kpi_code)?.latest_value != null);
    const summary = {
      required_total: required.length,
      required_filled: filled.length,
      required_verified: verifiedRequired.length,
      required_inferred: inferredRequired.length,
      required_missing: required.length - filled.length,
      registry_total: registry.length,
      last_verified_at: (rows ?? [])
        .map((r: any) => r.last_verified_at)
        .filter(Boolean)
        .sort()
        .slice(-1)[0] ?? null,
    };
    const perKpi = registry.map((k) => {
      const row: any = byCode.get(k.kpi_code);
      const att = latestAttempt.get(k.kpi_code);
      return {
        kpi_code: k.kpi_code,
        label: k.label,
        required: k.required,
        category: k.category,
        latest_value: row?.latest_value ?? null,
        freshness_status: row?.freshness_status ?? "missing",
        provenance: row?.provenance ?? null,
        confidence: row?.confidence ?? null,
        last_verified_at: row?.last_verified_at ?? null,
        last_attempt_pass: att?.pass ?? null,
        last_attempt_error: att?.error ?? null,
      };
    });
    return { summary, perKpi };
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
    ...SUMMARY_SCHEMA_FRAGMENT,
  },
  required: ["dossiers", "summary_md", "summary_highlights"],
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

    const model: SonarModel = "sonar-pro";
    const runId = await openRun(supabaseAdmin, {
      country_code: data.countryCode,
      stage: "sector_dossier",
      userId: context.userId,
      model_stack: { perplexity: model },
    });

    try {
      const perSectorSchema = {
        type: "object",
        additionalProperties: false,
        properties: {
          dossier: (SectorDossierSchema as any).properties.dossiers.items,
        },
        required: ["dossier"],
      } as const;
      const allCitations: SonarCitation[] = [];
      const seenCitationUrls = new Set<string>();
      const dossiers: any[] = [];
      const errors: string[] = [];
      const batchSize = 3;

      for (let i = 0; i < sectorCodes.length; i += batchSize) {
        const batch = sectorCodes.slice(i, i + batchSize);
        await updateRunPlan(supabaseAdmin, runId, {
          phase: "sector_dossier",
          processed: i,
          total: sectorCodes.length,
          currentSectors: batch,
          errors,
          updatedAt: new Date().toISOString(),
        });
        const results = await Promise.all(batch.map(async (sectorCode) => {
          try {
            const result = await callSonar({
              model,
              system:
                "You are a sovereign sector analyst. Return one JSON object for the requested sector code. Include a policy stack (statutes, institutions, national plans, regulatory instruments), a comms stack (channels, spokespeople, dominant narratives, reputation risks), and a regional benchmark (peer countries, leader/average/laggard, rationale). Be concrete — use real institution and statute names.",
              user: `Country: ${country.name} (${country.iso3 ?? country.code}). Sector code to profile: ${sectorCode}. Return exactly one dossier for sector_code=${sectorCode}.`,
              responseSchema: perSectorSchema as unknown as Record<string, unknown>,
              noDomainFilter: true,
            });
            const parsedOne = parseSonarJson<{ dossier: any }>(result.content);
            if (!parsedOne?.dossier) throw new Error("empty dossier");
            parsedOne.dossier.sector_code = sectorCode;
            return { dossier: parsedOne.dossier, citations: result.citations };
          } catch (e) {
            errors.push(`${sectorCode}: ${(e as Error).message.slice(0, 160)}`);
            return null;
          }
        }));
        for (const r of results) {
          if (!r) continue;
          dossiers.push(r.dossier);
          for (const c of r.citations) {
            if (seenCitationUrls.has(c.url)) continue;
            seenCitationUrls.add(c.url);
            allCitations.push(c);
          }
        }
        await updateRunPlan(supabaseAdmin, runId, {
          phase: "sector_dossier",
          processed: Math.min(i + batch.length, sectorCodes.length),
          total: sectorCodes.length,
          okCount: dossiers.length,
          failCount: errors.length,
          errors,
          updatedAt: new Date().toISOString(),
        });
      }

      if (!dossiers.length) throw new Error(`Perplexity returned no dossiers. ${errors.slice(0, 3).join("; ")}`);
      const parsed = {
        dossiers,
        summary_md: `Prepared ${dossiers.length}/${sectorCodes.length} sector dossier(s) for ${country.name}. ${errors.length ? `Unresolved sectors: ${errors.join("; ")}` : "All requested sectors returned policy, communications, and benchmark coverage."}`,
        summary_highlights: [
          { label: "Sectors profiled", value: `${dossiers.length}/${sectorCodes.length}` },
          { label: "Research failures", value: String(errors.length) },
        ],
      };
      const inline = extractInlineSummary(parsed);

      const draftId = await saveDraft(supabaseAdmin, {
        run_id: runId,
        country_code: data.countryCode,
        stage: "sector_dossier",
        target_table: "sector_dossiers",
        payload: parsed,
        confidence: dossiers.length === sectorCodes.length && allCitations.length >= 2 ? "high" : "medium",
        citations: allCitations,
        summary_md: inline.summary_md,
        summary_highlights: inline.summary_highlights,
      });

      await finishRun(supabaseAdmin, runId, { status: "ready" });
      return { runId, draftId, count: parsed.dossiers.length, citations: allCitations, errors: errors.length ? errors : undefined };
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

    // Snapshot ordered Perplexity citations for the draft. The [N] markers in
    // dossier prose are 1-indexed into this array.
    const { data: citeRows } = await supabaseAdmin
      .from("onboarding_citations")
      .select("url,title,domain,quote,published_at,created_at,id")
      .eq("draft_id", draft.id)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true });
    const citations = (citeRows ?? []).map((c) => ({
      url: c.url,
      title: c.title,
      domain: c.domain,
      quote: c.quote,
      published_at: c.published_at,
    }));

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
            citations: citations as any,
            confidence: "medium",
          },
          { onConflict: "country_code,sector_code,kind" },
        );
        if (!upErr) upserted++;
      }
    }
    if (upserted === 0) {
      throw new Error("Commit rejected: sector-dossier draft wrote 0 target rows. Draft remains open.");
    }
    await markDraftCommitted(supabaseAdmin, draft.id, draft.run_id);
    return { ok: true, upserted };
  });

// ============================================================
// Stage 9: Ministry deep-dive
// ============================================================

const MinisterProfileSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    name: { type: ["string", "null"] },
    title: { type: ["string", "null"] },
    party: { type: ["string", "null"] },
    appointed_at: { type: ["string", "null"] },
    bio: { type: ["string", "null"] },
    birth_date: { type: ["string", "null"] },
    education: { type: "array", items: { type: "string" } },
    career: { type: "array", items: { type: "string" } },
    contact: {
      type: "object",
      additionalProperties: false,
      properties: {
        office_phone: { type: ["string", "null"] },
        email: { type: ["string", "null"] },
        office_address: { type: ["string", "null"] },
        website: { type: ["string", "null"] },
      },
    },
    socials: {
      type: "object",
      additionalProperties: false,
      properties: {
        twitter: { type: ["string", "null"] },
        facebook: { type: ["string", "null"] },
        linkedin: { type: ["string", "null"] },
        instagram: { type: ["string", "null"] },
      },
    },
    portrait_url: { type: ["string", "null"] },
  },
} as const;

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
          minister_profile: MinisterProfileSchema,
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
      // Research each ministry independently so a single officeholder can't
      // dominate the result set. Domain filter is disabled so Perplexity can
      // reach the actual ministry / gov websites, press releases, and
      // Wikipedia infoboxes that name the current minister.
      const perMinistrySchema = {
        type: "object",
        additionalProperties: false,
        properties: {
          ministry_slug: { type: "string" },
          minister: { type: ["string", "null"] },
          minister_profile: MinisterProfileSchema,
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
      } as const;

      const allCitations: SonarCitation[] = [];
      const seenCiteUrls = new Set<string>();
      const ministryEntries: any[] = [];
      const errors: string[] = [];

      for (const m of ministries as Array<{ slug: string; name: string }>) {
        try {
          const perRes = await callSonar({
            model,
            system:
              "You are a governance analyst. Research the SPECIFIC ministry named by the user and return ONE JSON object matching the schema. `minister_profile.name` must be the CURRENT officeholder of THIS ministry — do NOT default to the head of government unless they personally hold this portfolio. If you cannot verify the current minister from an official ministry website, government gazette, parliamentary record, or a current Wikipedia infobox, set minister and minister_profile.name to null. Include title, party, appointment date (ISO), a <=400 char bio, education, career highlights, contact block (office_phone, email, office_address, website), verified official socials, and portrait_url when publicly available. Provide a concrete mandate paragraph and 2-5 flagship programmes (name/objective/status). Return null for any field you cannot verify — never guess.",
            user: `Country: ${country.name}.\nMinistry slug: ${m.slug}\nMinistry name: ${m.name}\n\nReturn a single object with ministry_slug="${m.slug}".`,
            responseSchema: perMinistrySchema as unknown as Record<string, unknown>,
            noDomainFilter: true,
          });
          const parsedOne = parseSonarJson<any>(perRes.content);
          if (parsedOne && typeof parsedOne === "object") {
            parsedOne.ministry_slug = m.slug; // enforce
            ministryEntries.push(parsedOne);
          } else {
            errors.push(`${m.slug}: empty response`);
          }
          for (const c of perRes.citations) {
            if (!seenCiteUrls.has(c.url)) {
              seenCiteUrls.add(c.url);
              allCitations.push(c);
            }
          }
        } catch (e) {
          errors.push(`${m.slug}: ${(e as Error).message}`);
        }
      }

      if (!ministryEntries.length) {
        throw new Error(`Perplexity returned no ministry entries. ${errors.slice(0, 3).join("; ")}`);
      }

      const parsed = { ministries: ministryEntries };

      const draftId = await saveDraft(supabaseAdmin, {
        run_id: runId,
        country_code: data.countryCode,
        stage: "ministry_deep_dive",
        target_table: "ministry_profiles",
        payload: parsed,
        confidence: allCitations.length >= ministries.length ? "medium" : "low",
        citations: allCitations,
      });

      await finishRun(supabaseAdmin, runId, { status: "ready" });
      return {
        runId,
        draftId,
        count: parsed.ministries.length,
        citations: allCitations,
        errors: errors.length ? errors : undefined,
      };
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

    const citations = Array.isArray((draft as any).citations) ? (draft as any).citations : [];
    let upserted = 0;
    for (const m of payload.ministries) {
      const profile = (m.minister_profile && typeof m.minister_profile === "object") ? m.minister_profile : {};
      const resolvedName = profile.name ?? m.minister ?? null;
      const { error: upErr } = await supabaseAdmin.from("ministry_profiles").upsert(
        {
          country_code: draft.country_code,
          ministry_slug: m.ministry_slug,
          minister: resolvedName,
          minister_profile: { ...profile, name: resolvedName },
          mandate: m.mandate,
          programmes: m.programmes ?? [],
          source_ids: [],
          citations,
        },
        { onConflict: "country_code,ministry_slug" },
      );
      if (!upErr) upserted++;
    }
    if (upserted === 0) {
      throw new Error("Commit rejected: ministry deep-dive draft wrote 0 target rows. Draft remains open.");
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
      .limit(data.limit ?? 8);
    if (sErr) throw sErr;
    if (!sources?.length) throw new Error("Commit source registry first — no active sources");

    // Pre-flight: auto-deactivate rows whose url isn't a valid http(s) URL,
    // so Firecrawl doesn't 400 on agent-written search hints every run.
    const invalid = sources.filter((s) => !isValidHttpUrl(s.url));
    const valid = sources.filter((s) => isValidHttpUrl(s.url));
    if (invalid.length) {
      await supabaseAdmin
        .from("country_sources")
        .update({ active: false, fetch_status: "invalid_url", fetch_error: "not a valid http(s) URL" })
        .in("id", invalid.map((s) => s.id));
    }

    const runId = await openRun(supabaseAdmin, {
      country_code: data.countryCode,
      stage: "corpus_ingest",
      userId: context.userId,
      model_stack: { firecrawl: "v2", embeddings: "openai/text-embedding-3-small" },
    });

    const results: Array<{ source_id: string; url: string; ok: boolean; chunks?: number; error?: string }> = [];
    for (const s of invalid) {
      results.push({ source_id: s.id, url: s.url, ok: false, error: "invalid url (auto-deactivated)" });
    }
    let totalChunks = 0;
    const total = valid.length;

    const writeProgress = async (processed: number, lastUrl: string | null) => {
      const okC = results.filter((r) => r.ok).length;
      const failC = results.length - okC;
      // Best-effort heartbeat — never fail the ingest if this write fails.
      try {
        await supabaseAdmin
          .from("onboarding_runs")
          .update({ plan: { phase: "corpus_ingest", processed, total, lastUrl, okCount: okC, failCount: failC, totalChunks, updatedAt: new Date().toISOString() }, updated_at: new Date().toISOString() })
          .eq("id", runId);
      } catch { /* ignore */ }
    };

    try {
      await writeProgress(0, null);
      for (let idx = 0; idx < valid.length; idx++) {
        const src = valid[idx];
        try {
          const doc = await fetchFirecrawl(src.url);
          if (!doc.markdown || doc.markdown.length < 200) {
            throw new Error(`too short: ${doc.markdown.length} chars`);
          }
          const { contentHash } = await import("./memory-dedup.server");
          const hash = contentHash(doc.markdown);

          // Dedup: if we already have a document for this source with the
          // same content_hash, skip re-embedding entirely — no new document,
          // no new chunks. This is the corpus's "no duplicates" guard.
          const { data: existing } = await supabaseAdmin
            .from("country_source_documents")
            .select("id")
            .eq("country_source_id", src.id)
            .eq("content_hash", hash)
            .maybeSingle();
          if (existing) {
            await supabaseAdmin
              .from("country_sources")
              .update({ last_fetched_at: new Date().toISOString(), fetch_status: "ok", fetch_error: null })
              .eq("id", src.id);
            results.push({ source_id: src.id, url: src.url, ok: true, chunks: 0 });
            await writeProgress(idx + 1, src.url);
            continue;
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
              content_hash: hash,
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
        await writeProgress(idx + 1, src.url);
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
      // Write the final report into the run's plan too, so the wizard can
      // render a "last ingest report" even after auto-commit clears the draft.
      try {
        await supabaseAdmin
          .from("onboarding_runs")
          .update({ plan: { phase: "corpus_ingest", processed: total, total, okCount, failCount, totalChunks, results, updatedAt: new Date().toISOString() }, updated_at: new Date().toISOString() })
          .eq("id", runId);
      } catch { /* best effort */ }
      // Auto-commit only when we actually landed useful data. Otherwise leave the
      // draft in `ready` state with a clear error so the admin can retry.
      if (okCount >= 1 && totalChunks > 0) {
        await markDraftCommitted(supabaseAdmin, draftId, runId);
        await finishRun(supabaseAdmin, runId, { status: "committed" });
      } else {
        await finishRun(supabaseAdmin, runId, {
          status: "ready",
          error: `ingest produced no usable chunks (ok=${okCount}, chunks=${totalChunks}). Review the per-source errors.`,
        });
      }

      return { ok: true, runId, totalChunks, okCount, failCount, results };

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
    ...SUMMARY_SCHEMA_FRAGMENT,
  },
  required: ["memories", "summary_md", "summary_highlights"],
} as const;

function compactJson(value: unknown, maxChars = 14_000): string {
  const text = JSON.stringify(value ?? {}, null, 2);
  return text.length <= maxChars ? text : `${text.slice(0, maxChars)}\n… truncated ${text.length - maxChars} chars`;
}

async function loadSecondBrainGrounding(admin: any, countryCode: string) {
  const [country, sectors, kpis, sources, dossiers, ministries, chunks] = await Promise.all([
    admin
      .from("countries")
      .select("code,name,iso3,currency,fiscal_year_start_month,gdp_current_usd,gdp_year,country_pack")
      .eq("code", countryCode)
      .maybeSingle(),
    admin
      .from("country_sectors")
      .select("sector_code,share_pct,confidence_grade,source_ref")
      .eq("country_code", countryCode)
      .order("share_pct", { ascending: false }),
    admin
      .from("country_kpis")
      .select("kpi_code,label,unit,category,latest_value,latest_period,source_url,provenance,confidence")
      .eq("country_code", countryCode)
      .order("category"),
    admin
      .from("country_sources")
      .select("id,url,title,org,kind,quality_score,tags")
      .eq("country_code", countryCode)
      .eq("active", true)
      .order("quality_score", { ascending: false })
      .limit(30),
    admin
      .from("sector_dossiers")
      .select("sector_code,kind,payload,citations,confidence")
      .eq("country_code", countryCode)
      .limit(60),
    admin
      .from("ministry_profiles")
      .select("ministry_slug,minister,minister_profile,mandate,programmes,citations")
      .eq("country_code", countryCode)
      .limit(40),
    admin
      .from("country_source_chunks")
      .select("content, source:country_source_documents(country_source_id, country_sources(url,title,org))")
      .eq("country_code", countryCode)
      .limit(18),
  ]);
  if (country.error || !country.data) throw new Error(`Country ${countryCode} not found`);
  for (const [name, r] of [["sectors", sectors], ["kpis", kpis], ["sources", sources], ["dossiers", dossiers], ["ministries", ministries], ["chunks", chunks]] as const) {
    if ((r as any).error) throw new Error(`grounding.${name} query failed: ${(r as any).error.message}`);
  }
  return {
    country: country.data,
    sectors: sectors.data ?? [],
    kpis: kpis.data ?? [],
    sources: sources.data ?? [],
    dossiers: dossiers.data ?? [],
    ministries: ministries.data ?? [],
    corpusExcerpts: (chunks.data ?? []).map((c: any) => ({
      text: String(c.content ?? "").slice(0, 900),
      url: c.source?.country_sources?.url ?? null,
      title: c.source?.country_sources?.title ?? null,
      org: c.source?.country_sources?.org ?? null,
    })),
  };
}

function citationsFromGrounding(grounding: Awaited<ReturnType<typeof loadSecondBrainGrounding>>): SonarCitation[] {
  const seen = new Set<string>();
  const out: SonarCitation[] = [];
  const push = (url: unknown, title?: unknown) => {
    if (typeof url !== "string" || !isValidHttpUrl(url) || seen.has(url)) return;
    seen.add(url);
    let domain: string | undefined;
    try { domain = new URL(url).hostname.replace(/^www\./, ""); } catch { /* ignore */ }
    out.push({ url, title: typeof title === "string" ? title : undefined, domain });
  };
  for (const s of grounding.sources) push((s as any).url, (s as any).title ?? (s as any).org);
  for (const k of grounding.kpis) push((k as any).source_url, (k as any).source_org ?? (k as any).label);
  for (const c of grounding.corpusExcerpts) push((c as any).url, (c as any).title ?? (c as any).org);
  for (const row of [...grounding.dossiers, ...grounding.ministries]) {
    const cites = Array.isArray((row as any).citations) ? (row as any).citations : [];
    for (const c of cites) push(c?.url, c?.title ?? c?.domain);
  }
  return out.slice(0, 40);
}

export const runSecondBrainSeedAgent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ countryCode: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const country = await loadCountry(supabaseAdmin, data.countryCode);
    const grounding = await loadSecondBrainGrounding(supabaseAdmin, data.countryCode);
    const sectorCodes = grounding.sectors.map((s: any) => s.sector_code);
    if (!grounding.sources.length) throw new Error("Commit source registry first — no active sources for second-brain grounding");
    if (!grounding.kpis.length) throw new Error("Commit KPI seed first — no country KPI rows for second-brain grounding");

    const model: SonarModel = "sonar-reasoning-pro";
    const runId = await openRun(supabaseAdmin, {
      country_code: data.countryCode,
      stage: "second_brain_seed",
      userId: context.userId,
      model_stack: { perplexity: model },
    });

    try {
      const citations = citationsFromGrounding(grounding);
      const system =
        "You are seeding an executive second-brain memory from already-committed country onboarding data. Return ONLY a JSON object matching the schema. Create concrete, durable, cabinet-grade memory objects grounded in the supplied KPIs, sources, dossiers, ministry profiles, and corpus excerpts. Kinds: position, audience, outlet, fact, risk. Use sector_code values from the committed sectors. Do not invent facts not supported by the grounding." +
        SUMMARY_SYSTEM_SUFFIX;
      const user = `Country: ${country.name} (${country.iso3 ?? country.code}).\nSectors: ${sectorCodes.join(", ") || "cross_cutting"}.\n\nCOMMITTED GROUNDING:\n${compactJson(grounding)}\n\nReturn 12-25 balanced memories with at least one position, audience, outlet, fact, and risk when supported.`;

      let parsed: { memories: any[]; summary_md?: string; summary_highlights?: any[] } | null = null;
      try {
        const key = process.env.LOVABLE_API_KEY;
        if (!key) throw new Error("Missing LOVABLE_API_KEY");
        const { createLovableAiGatewayProvider } = await import("@/lib/ai-gateway.server");
        const gateway = createLovableAiGatewayProvider(key);
        const ai = await generateText({
          model: gateway("openai/gpt-5.5"),
          system,
          prompt: `${user}\n\nSCHEMA:\n${compactJson(SecondBrainSchema)}\n\nReturn json only.`,
        });
        parsed = parseSonarJson<{ memories: any[]; summary_md?: string; summary_highlights?: any[] }>(ai.text ?? "");
      } catch (e) {
        console.error("[second_brain_seed] Lovable AI synthesis failed; falling back to grounded search", e);
      }

      if (!parsed?.memories?.length) {
        const result = await callSonar({
          model,
          system,
          user,
          responseSchema: SecondBrainSchema as unknown as Record<string, unknown>,
        });
        parsed = parseSonarJson<{ memories: any[]; summary_md?: string; summary_highlights?: any[] }>(result.content);
        for (const c of result.citations) if (!citations.some((x) => x.url === c.url)) citations.push(c);
      }

      if (!parsed?.memories?.length) throw new Error("Second-brain synthesis returned no memories");
      const requiredKinds = new Set(["position", "audience", "outlet", "fact", "risk"]);
      const returnedKinds = new Set(parsed.memories.map((m: any) => m.kind));
      const missingKinds = [...requiredKinds].filter((k) => !returnedKinds.has(k));
      if (parsed.memories.length < 8 || missingKinds.length > 2) {
        throw new Error(`Second-brain draft failed quality gate: ${parsed.memories.length} memories, missing ${missingKinds.join(", ") || "none"}`);
      }
      const inline = extractInlineSummary(parsed);

      const draftId = await saveDraft(supabaseAdmin, {
        run_id: runId,
        country_code: data.countryCode,
        stage: "second_brain_seed",
        target_table: "memory_objects",
        payload: parsed,
        confidence: citations.length >= 5 ? "high" : "medium",
        citations,
        summary_md: inline.summary_md,
        summary_highlights: inline.summary_highlights,
      });

      await finishRun(supabaseAdmin, runId, { status: "ready" });
      return { runId, draftId, count: parsed.memories.length, citations };
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

    // Pull existing memories once and dedupe by normalized title in JS
    // (matches the DB unique index memory_objects_dedup_idx).
    const { data: existingRows } = await supabaseAdmin
      .from("memory_objects")
      .select("id, sector_code, kind, title")
      .eq("scope_key", draft.country_code);
    let inserted = 0;
    let updated = 0;
    let skipped = 0;
    for (const m of payload.memories) {
      const key = `${m.sector_code}|${m.kind}|${normalizeMemoryTitle(m.title)}`;
      const existing = (existingRows ?? []).find(
        (r: any) => `${r.sector_code}|${r.kind}|${normalizeMemoryTitle(r.title ?? "")}` === key,
      );
      if (existing) {
        const { data: current } = await supabaseAdmin
          .from("memory_objects")
          .select("verified")
          .eq("id", existing.id)
          .maybeSingle();
        if (current?.verified) { skipped++; continue; }
        const { error: upErr } = await supabaseAdmin
          .from("memory_objects")
          .update({
            payload: { body: m.body } as any,
            weight: m.weight,
          })
          .eq("id", existing.id);
        if (upErr) throw upErr;
        updated++;
        continue;
      }
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
      if (!insErr) {
        inserted++;
      } else if (isUniqueViolation(insErr)) {
        skipped++;
      } else {
        throw insErr;
      }
    }
    if (inserted + updated + skipped === 0) {
      throw new Error("Commit rejected: second-brain draft wrote 0 target rows. Draft remains open.");
    }
    await markDraftCommitted(supabaseAdmin, draft.id, draft.run_id);
    return { ok: true, inserted, updated, skipped };
  });



// ============================================================
// Stage 12: Capital Flows — Sovereign Sankey ledger (USD $M)
// ============================================================
export const runCapitalFlowsAgent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ countryCode: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const country = await loadCountry(supabaseAdmin, data.countryCode);

    const [sectorsC, kpisC, sourcesC, chunksC, memoryC] = await Promise.all([
      supabaseAdmin.from("country_sectors").select("*", { count: "exact", head: true }).eq("country_code", data.countryCode),
      supabaseAdmin.from("country_kpis").select("*", { count: "exact", head: true }).eq("country_code", data.countryCode),
      supabaseAdmin.from("country_sources").select("*", { count: "exact", head: true }).eq("country_code", data.countryCode).eq("active", true),
      supabaseAdmin.from("country_source_chunks").select("*", { count: "exact", head: true }).eq("country_code", data.countryCode),
      supabaseAdmin.from("memory_objects").select("*", { count: "exact", head: true }).eq("scope_key", data.countryCode),
    ]);
    const missingPreflight: string[] = [];
    if (!country.gdp_current_usd || Number(country.gdp_current_usd) <= 0) missingPreflight.push("GDP");
    if ((sectorsC.count ?? 0) <= 0) missingPreflight.push("sector composition");
    if ((kpisC.count ?? 0) <= 0) missingPreflight.push("KPI seed");
    if ((sourcesC.count ?? 0) <= 0) missingPreflight.push("source registry");
    if ((memoryC.count ?? 0) <= 0) missingPreflight.push("second-brain memory");
    if ((chunksC.count ?? 0) <= 0) missingPreflight.push("corpus chunks");
    if (missingPreflight.length) {
      throw new Error(`Capital flows preflight blocked — commit first: ${missingPreflight.join(", ")}.`);
    }

    const model: SonarModel = "sonar-reasoning-pro";
    const runId = await openRun(supabaseAdmin, {
      country_code: data.countryCode,
      stage: "capital_flows",
      userId: context.userId,
      model_stack: { perplexity: model, strategy: "fan-out-3-pass" },
    });

    try {
    const workbook = await buildCapitalFlowsDraft({
        admin: supabaseAdmin,
        country,
        runId,
        onProgress: (plan) => updateRunPlan(supabaseAdmin, runId, plan),
      });

      const draftId = await saveDraft(supabaseAdmin, {
        run_id: runId,
        country_code: data.countryCode,
        stage: "capital_flows",
        target_table: "country_capital_flows",
        payload: workbook.payload,
        confidence: workbook.confidence,
        citations: workbook.citations,
        summary_md: workbook.summary_md,
        summary_highlights: workbook.summary_highlights,
      });

      await finishRun(supabaseAdmin, runId, {
        status: workbook.coverageOk ? "ready" : "needs_review",
        error: workbook.coverageOk
          ? null
          : `Coverage insufficient: ${workbook.payload.coverage.inputs.length}/${workbook.payload.coverage.applicableInputs?.length ?? 6} inputs, ${workbook.payload.coverage.outputs.length}/${workbook.payload.coverage.applicableOutputs?.length ?? 6} outputs, ${(workbook.reconciliationPct * 100).toFixed(0)}% residual`,
        plan: {
          strategy: "evidence-workbook-per-node",
          attempts: workbook.attempts,
          coverage: workbook.payload.coverage,
          reconciliation: workbook.payload.reconciliation,
        },
      });
      return { runId, draftId, count: workbook.count, reconciliationPct: workbook.reconciliationPct, coverageOk: workbook.coverageOk, attempts: workbook.attempts };
    } catch (err) {
      await finishRun(supabaseAdmin, runId, { status: "failed", error: (err as Error).message });
      throw err;
    }
  });


export const commitCapitalFlows = createServerFn({ method: "POST" })
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
    const payload = (data.editedPayload ?? draft.payload) as {
      period: string;
      flows: Array<{
        node_key: string;
        value_usd_m: number;
        period?: string;
        method: string;
        confidence_grade: string;
        source_url: string;
        source_org: string;
        source_kind?: string;
        formula?: string;
        notes?: string;
        evidence?: unknown;
        validation?: unknown;
      }>;
    };
    if (!payload?.period || !Array.isArray(payload.flows) || payload.flows.length === 0) {
      throw new Error("Capital-flow draft has no flows to commit");
    }

    // Snapshot ordered citations from onboarding_citations (1-indexed).
    const { data: cites } = await supabaseAdmin
      .from("onboarding_citations")
      .select("url, domain, title")
      .eq("draft_id", draft.id)
      .order("created_at", { ascending: true });
    const orderedCitations = (cites ?? []).map((c: any) => ({ url: c.url, domain: c.domain, title: c.title }));
    if (orderedCitations.length === 0) {
      const seenCitationUrls = new Set<string>();
      for (const f of payload.flows) {
        if (!isValidHttpUrl(f.source_url) || seenCitationUrls.has(f.source_url)) continue;
        seenCitationUrls.add(f.source_url);
        let domain: string | null = null;
        try {
          domain = new URL(f.source_url).hostname.replace(/^www\./, "");
        } catch { /* already validated */ }
        orderedCitations.push({
          url: f.source_url,
          domain,
          title: f.source_org || "Capital-flow source",
        });
      }
    }

    // Auto-attach source per unique source_url so ribbons open the source modal.
    const { upsertCountrySource } = await import("@/lib/country-data/sources.server");
    const seenSources = new Set<string>();
    for (const f of payload.flows) {
      if (!f.source_url || seenSources.has(f.source_url)) continue;
      if (!isValidHttpUrl(f.source_url)) continue;
      seenSources.add(f.source_url);
      await upsertCountrySource(supabaseAdmin, {
        country_code: draft.country_code,
        url: f.source_url,
        title: `${f.source_org} — capital-flow source`,
        org: f.source_org || "Auto",
        kind: "flow_source",
        tags: ["auto", "capital_flow"],
        quality_score: f.confidence_grade === "A" ? 5 : f.confidence_grade === "B" ? 4 : 3,
        active: true,
        created_by: context.userId,
      });
    }

    // Replace this country's prior flow ledger before writing the reviewed
    // workbook. Stage 12 is a coherent Sankey snapshot, so stale node rows from
    // earlier runs or mixed source periods must not remain visible.
    const { error: clearErr } = await supabaseAdmin
      .from("country_capital_flows")
      .delete()
      .eq("country_code", draft.country_code);
    if (clearErr) throw clearErr;

    // Upsert one row per node_key under the draft's ledger period. Individual
    // source periods remain in notes/evidence; the Sankey itself uses one
    // period so the chart can render the complete ledger together.
    let upserted = 0;
    for (const f of payload.flows) {
      const period = payload.period || f.period || "unknown";
      const noteParts = [f.notes ?? null];
      if (f.formula) noteParts.push(`Formula: ${f.formula}`);
      if (f.source_kind) noteParts.push(`Source basis: ${f.source_kind}`);
      const { error: upErr } = await supabaseAdmin
        .from("country_capital_flows")
        .upsert(
          {
            country_code: draft.country_code,
            node_key: f.node_key,
            period,
            value_usd_m: Number(f.value_usd_m),
            method: f.method || "reported",
            confidence_grade: f.confidence_grade || "C",
            notes: noteParts.filter(Boolean).join("\n") || null,
            citations: orderedCitations as any,
          },
          { onConflict: "country_code,node_key,period" },
        );
      if (upErr) throw upErr;
      upserted++;
    }
    if (upserted === 0) {
      throw new Error("Commit rejected: capital-flow draft wrote 0 target rows. Draft remains open.");
    }

    // Reconciliation residual — insert a balancer only when the reviewed
    // payload did not already include the workbook's explicit residual row.
    const { data: registry } = await supabaseAdmin.from("capital_flow_nodes").select("node_key, side");
    const sideByKey = new Map<string, string>();
    for (const r of registry ?? []) sideByKey.set(r.node_key, r.side);
    let sumIn = 0, sumOut = 0;
    const presentKeys = new Set<string>();
    for (const f of payload.flows) {
      presentKeys.add(f.node_key);
      const s = sideByKey.get(f.node_key);
      if (s === "input") sumIn += Number(f.value_usd_m ?? 0);
      else if (s === "output") sumOut += Number(f.value_usd_m ?? 0);
    }
    const residual = sumIn - sumOut;
    if (!presentKeys.has("RECONCILIATION_RESIDUAL") && !presentKeys.has("RECONCILIATION_INFLOW_RESIDUAL") && Math.abs(residual) > 0.01 && sumIn > 0 && Math.abs(residual) / Math.max(sumIn, sumOut) > 0.1) {
      // The residual goes on the side with the smaller total, to balance the diagram.
      const nodeKey = residual > 0 ? "RECONCILIATION_RESIDUAL" : "RECONCILIATION_INFLOW_RESIDUAL";
      const { error: residualErr } = await supabaseAdmin.from("country_capital_flows").upsert(
        {
          country_code: draft.country_code,
          node_key: nodeKey,
          period: payload.period,
          value_usd_m: Math.abs(residual),
          method: "residual",
          confidence_grade: "C",
          notes: residual > 0 ? "Auto-balancer: inputs exceed disclosed outputs" : "Auto-balancer: outputs exceed disclosed inputs; unattributed financing/inflow required to reconcile the ledger",
          citations: orderedCitations as any,
        },
        { onConflict: "country_code,node_key,period" },
      );
      if (residualErr) throw residualErr;
    } else {
      // Clean up any stale residual for this period.
      const { error: deleteResidualErr } = await supabaseAdmin
        .from("country_capital_flows")
        .delete()
        .eq("country_code", draft.country_code)
        .eq("node_key", "RECONCILIATION_RESIDUAL")
        .eq("period", payload.period);
      if (deleteResidualErr) throw deleteResidualErr;
    }

    await markDraftCommitted(supabaseAdmin, draft.id, draft.run_id);
    return { ok: true, upserted, reconciliation: { sumIn, sumOut, residual } };
  });



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
