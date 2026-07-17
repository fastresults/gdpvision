// AI-first country onboarding server functions.
// Each `runXxx` server fn calls Perplexity Sonar (grounded, cited), writes an
// `onboarding_run` + `onboarding_drafts` + `onboarding_citations`, and returns
// the draft rows to the client for review. `commitXxx` writes reviewed drafts
// into the real tables.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { type SonarCitation, type SonarModel } from "./perplexity.server";
import { runWithFallbacks, jsonParser } from "./fallback.server";
import { buildCountryContext } from "./country-context.server";
import { promoteFromCitations } from "./domain-promotion.server";
import type { FallbackResult } from "./fallback.server";
import { seedProfile, seedGdp, seedSectorComposition, seedMinistries, seedMinistrySectorMap } from "./seeds.server";
import { SUMMARY_SCHEMA_FRAGMENT, SUMMARY_SYSTEM_SUFFIX, extractInlineSummary } from "./summary-inline";

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
  if (error) {
    // 23505 = unique_violation from onboarding_runs_one_open_per_stage
    if ((error as any).code === "23505") {
      throw new Error(
        `A ${params.stage} run is already in progress for ${params.country_code}. Wait for it to finish, or refresh the page — stale runs auto-clear after 15 minutes.`,
      );
    }
    throw error;
  }
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
  // One live uncommitted draft is allowed per (country, stage) per the
  // partial unique index `onboarding_drafts_one_live_per_stage`. Re-runs
  // update the live draft instead of tripping the index; committed drafts
  // stay immutable audit history.
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


/** Promote citing domains after a draft is saved. Best-effort; never throws. */
async function promoteAfterDraft(
  admin: any,
  countryCode: string,
  stage: string,
  draftId: string,
  fb: FallbackResult<any>,
): Promise<string[]> {
  try {
    const res = await promoteFromCitations(admin, {
      countryCode,
      stage,
      draftId,
      citations: fb.citations,
      openWeb: fb.openWebWin,
    });
    if (res.promoted.length) fb.notes.push(`Promoted domains: ${res.promoted.join(", ")}`);
    if (res.reference.length) fb.notes.push(`Reference-tier citations: ${res.reference.join(", ")}`);
    if (res.blocked.length) fb.notes.push(`Blocked citations (not promoted): ${res.blocked.join(", ")}`);
    return res.promoted;
  } catch (err) {
    fb.notes.push(`Domain promotion failed: ${(err as Error).message.slice(0, 160)}`);
    return [];
  }
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
        .select("code, name, iso3, gdp_current_usd, gdp_year, membership_tier, profile_committed_at, gdp_committed_at"),
      supabaseAdmin
        .from("onboarding_runs")
        .select("country_code, stage, status")
        .eq("status", "committed"),
    ]);

    if (countriesRes.error) throw countriesRes.error;
    const countries = countriesRes.data ?? [];
    const codes = countries.map((c: any) => c.code);

    // Committed-run stages.
    const stagesByCountry = new Map<string, Set<string>>();
    for (const r of (runsRes.data ?? [])) {
      const s = stagesByCountry.get(r.country_code) ?? new Set<string>();
      s.add(r.stage);
      stagesByCountry.set(r.country_code, s);
    }

    // Data-presence union: a stage counts as complete when the canonical target
    // table has content, even if the onboarding_run row never flipped to
    // `committed` (acceptance-gate misses, aborted retries, etc.). Keeps the
    // dot grid in sync with what the corpus/ledger actually contain.
    const addStage = (cc: string, stage: string) => {
      if (!cc) return;
      const s = stagesByCountry.get(cc) ?? new Set<string>();
      s.add(stage);
      stagesByCountry.set(cc, s);
    };

    // Stages 1 & 2 come straight off the countries row.
    for (const c of countries as any[]) {
      if (c.profile_committed_at) addStage(c.code, "profile");
      if (c.gdp_current_usd != null) addStage(c.code, "gdp");
    }

    const [
      sectorsRes,
      ministriesRes,
      msRes,
      sourcesRes,
      kpisRes,
      dossiersRes,
      minProfRes,
      chunksRes,
      memRes,
      flowsRes,
    ] = await Promise.all([
      supabaseAdmin.from("country_sectors").select("country_code").in("country_code", codes),
      supabaseAdmin.from("ministries").select("country_code").in("country_code", codes),
      supabaseAdmin
        .from("ministry_sectors")
        .select("ministries!inner(country_code)")
        .in("ministries.country_code", codes),
      supabaseAdmin.from("country_sources").select("country_code").in("country_code", codes),
      supabaseAdmin.from("country_kpis").select("country_code").in("country_code", codes).not("latest_value", "is", null),
      supabaseAdmin.from("sector_dossiers").select("country_code").in("country_code", codes),
      supabaseAdmin
        .from("ministry_profiles")
        .select("country_code")
        .in("country_code", codes)
        .not("minister_profile", "is", null),
      supabaseAdmin.from("country_source_chunks").select("country_code").in("country_code", codes),
      supabaseAdmin.from("memory_objects").select("scope_key").in("scope_key", codes),
      supabaseAdmin.from("country_capital_flows").select("country_code").in("country_code", codes),
    ]);

    for (const r of (sectorsRes.data ?? [])) addStage((r as any).country_code, "sector_composition");
    for (const r of (ministriesRes.data ?? [])) addStage((r as any).country_code, "ministries");
    for (const r of (msRes.data ?? [])) addStage((r as any).ministries?.country_code, "ministry_sector_map");
    for (const r of (sourcesRes.data ?? [])) addStage((r as any).country_code, "source_registry");
    for (const r of (kpisRes.data ?? [])) addStage((r as any).country_code, "kpi_seed");
    for (const r of (dossiersRes.data ?? [])) addStage((r as any).country_code, "sector_dossier");
    for (const r of (minProfRes.data ?? [])) addStage((r as any).country_code, "ministry_deep_dive");
    for (const r of (chunksRes.data ?? [])) addStage((r as any).country_code, "corpus_ingest");
    for (const r of (memRes.data ?? [])) addStage((r as any).scope_key, "second_brain_seed");
    for (const r of (flowsRes.data ?? [])) addStage((r as any).country_code, "capital_flows");

    return countries.map((c: any) => ({
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

    const cc = data.countryCode;

    // Auto-reconcile stuck runs by heartbeat, not raw start time. Long model
    // calls can legitimately exceed 15 minutes, but a run whose row has not
    // been touched for 45 minutes is no longer observable/recoverable.
    // BEFORE we snapshot state, so the UI sees a clean picture. Never touches
    // `committed` runs or any target-table rows.
    const staleCutoff = new Date(Date.now() - 45 * 60 * 1000).toISOString();
    const reconcile = await supabaseAdmin
      .from("onboarding_runs")
      .update({ status: "stale", finished_at: new Date().toISOString(), error: "auto-reconciled: no heartbeat >45min" })
      .eq("country_code", cc)
      .in("status", ["planning", "ready"])
      .lt("updated_at", staleCutoff)
      .is("finished_at", null);
    if (reconcile.error) {
      console.error("[getOnboardingStatus] stale reconcile failed:", reconcile.error);
    }


    const loadCommittedTargetData = async () => {
      const [
        countryRow,
        sectors,
        ministries,
        ministrySectors,
        sources,
        kpis,
        dossiers,
        ministryProfiles,
        chunks,
        memories,
        flows,
      ] = await Promise.all([
        supabaseAdmin
          .from("countries")
          .select("code, name, iso3, currency, fiscal_year_start_month, gdp_current_usd, gdp_year, membership_tier, is_caricom, is_oecs, is_cbi_state, country_pack, profile_committed_at, gdp_committed_at")
          .eq("code", cc)
          .maybeSingle(),
        supabaseAdmin
          .from("country_sectors")
          .select("sector_code, share_pct, confidence_grade, source_ref, sectors(label, isic)")
          .eq("country_code", cc)
          .order("share_pct", { ascending: false }),
        supabaseAdmin
          .from("ministries")
          .select("id, slug, name, sort_order, created_at, updated_at")
          .eq("country_code", cc)
          .order("sort_order"),
        supabaseAdmin
          .from("ministry_sectors")
          .select("sector_code, weight, ministries!inner(slug, name, country_code)")
          .eq("ministries.country_code", cc)
          .order("sector_code"),
        supabaseAdmin
          .from("country_sources")
          .select("id, title, org, kind, url, active, quality_score, fetch_status, fetch_error, last_fetched_at, tags, summary")
          .eq("country_code", cc)
          .order("quality_score", { ascending: false }),
        supabaseAdmin
          .from("country_kpis")
          .select("kpi_code, label, unit, latest_value, latest_period, target, direction, category, freshness_status, provenance, confidence, source_url, notes, updated_at")
          .eq("country_code", cc)
          .order("category")
          .order("label"),
        supabaseAdmin
          .from("sector_dossiers")
          .select("sector_code, kind, confidence, payload, citations, source_ids, updated_at")
          .eq("country_code", cc)
          .order("sector_code"),
        supabaseAdmin
          .from("ministry_profiles")
          .select("ministry_slug, minister, minister_profile, mandate, programmes, citations, source_ids, updated_at")
          .eq("country_code", cc)
          .order("ministry_slug"),
        supabaseAdmin
          .from("country_source_chunks")
          .select("id, document_id, chunk_index, content, created_at")
          .eq("country_code", cc)
          .order("created_at", { ascending: false })
          .limit(100),
        supabaseAdmin
          .from("memory_objects")
          .select("kind, title, sector_code, payload, weight, verified, source_id, updated_at")
          .eq("scope_key", cc)
          .order("kind")
          .order("title"),
        supabaseAdmin
          .from("country_capital_flows")
          .select("node_key, value_usd_m, period, confidence_grade, method, provenance, notes, citations, updated_at")
          .eq("country_code", cc)
          .order("node_key"),
      ]);

      const logError = (stage: string, res: any) => {
        if (res?.error) console.error(`[getOnboardingStatus] committed data read failed for ${stage}:`, res.error);
      };
      logError("profile/gdp", countryRow);
      logError("sector_composition", sectors);
      logError("ministries", ministries);
      logError("ministry_sector_map", ministrySectors);
      logError("source_registry", sources);
      logError("kpi_seed", kpis);
      logError("sector_dossier", dossiers);
      logError("ministry_deep_dive", ministryProfiles);
      logError("corpus_ingest", chunks);
      logError("second_brain_seed", memories);
      logError("capital_flows", flows);

      const c: any = countryRow.data;
      const countryPack = c?.country_pack && typeof c.country_pack === "object" ? c.country_pack : {};
      const allCitations = (rows: any[] | null | undefined) =>
        (rows ?? []).flatMap((r: any) => Array.isArray(r?.citations) ? r.citations : []);

      return {
        profile: c?.profile_committed_at
          ? (countryPack.profile ?? {
              code: c.code,
              name: c.name,
              iso3: c.iso3,
              currency: c.currency,
              fiscal_year_start_month: c.fiscal_year_start_month,
              membership_tier: c.membership_tier,
              is_caricom: c.is_caricom,
              is_oecs: c.is_oecs,
              is_cbi_state: c.is_cbi_state,
            })
          : null,
        gdp: c?.gdp_committed_at
          ? {
              gdp_current_usd: c.gdp_current_usd,
              gdp_year: c.gdp_year,
              currency: c.currency,
            }
          : null,
        sector_composition: (sectors.data ?? []).length
          ? {
              rows: (sectors.data ?? []).map((r: any) => ({
                sector_code: r.sector_code,
                sector_label: r.sectors?.label ?? r.sector_code,
                share_pct: r.share_pct,
                confidence_grade: r.confidence_grade,
                source_ref: r.source_ref,
              })),
            }
          : null,
        ministries: (ministries.data ?? []).length
          ? {
              ministries: (ministries.data ?? []).map((m: any) => ({
                slug: m.slug,
                name: m.name,
                sort_order: m.sort_order,
              })),
            }
          : null,
        ministry_sector_map: (ministrySectors.data ?? []).length
          ? {
              mappings: (ministrySectors.data ?? []).map((r: any) => ({
                ministry_slug: r.ministries?.slug,
                ministry_name: r.ministries?.name,
                sector_code: r.sector_code,
                weight: r.weight,
              })),
            }
          : null,
        source_registry: (sources.data ?? []).length
          ? {
              sources: (sources.data ?? []).map((s: any) => ({
                title: s.title,
                org: s.org,
                kind: s.kind,
                url: s.url,
                active: s.active,
                quality_score: s.quality_score,
                fetch_status: s.fetch_status,
                fetch_error: s.fetch_error,
                last_fetched_at: s.last_fetched_at,
                tags: s.tags,
                summary: s.summary,
              })),
            }
          : null,
        kpi_seed: (kpis.data ?? []).length
          ? {
              kpis: (kpis.data ?? []).map((k: any) => ({
                kpi_code: k.kpi_code,
                label: k.label,
                category: k.category,
                latest_value: k.latest_value,
                latest_period: k.latest_period,
                unit: k.unit,
                target: k.target,
                direction: k.direction,
                freshness_status: k.freshness_status,
                provenance: k.provenance,
                confidence: k.confidence,
                source_url: k.source_url,
                notes: k.notes,
                updated_at: k.updated_at,
              })),
            }
          : null,
        sector_dossier: (dossiers.data ?? []).length
          ? {
              dossiers: (dossiers.data ?? []).map((d: any) => ({
                sector_code: d.sector_code,
                kind: d.kind,
                confidence: d.confidence,
                ...(d.payload && typeof d.payload === "object" ? d.payload : { payload: d.payload }),
                source_ids: d.source_ids,
                updated_at: d.updated_at,
              })),
            }
          : null,
        ministry_deep_dive: (ministryProfiles.data ?? []).length
          ? {
              ministries: (ministryProfiles.data ?? []).map((m: any) => ({
                ministry_slug: m.ministry_slug,
                minister: m.minister,
                minister_profile: m.minister_profile,
                mandate: m.mandate,
                programmes: m.programmes,
                source_ids: m.source_ids,
                updated_at: m.updated_at,
              })),
            }
          : null,
        corpus_ingest: (chunks.data ?? []).length
          ? {
              chunks: (chunks.data ?? []).map((ch: any) => ({
                document_id: ch.document_id,
                chunk_index: ch.chunk_index,
                content: typeof ch.content === "string" && ch.content.length > 700 ? `${ch.content.slice(0, 700)}…` : ch.content,
                created_at: ch.created_at,
              })),
            }
          : null,
        second_brain_seed: (memories.data ?? []).length
          ? {
              memories: (memories.data ?? []).map((m: any) => ({
                kind: m.kind,
                title: m.title,
                sector_code: m.sector_code,
                weight: m.weight,
                verified: m.verified,
                payload: m.payload,
                source_id: m.source_id,
                updated_at: m.updated_at,
              })),
            }
          : null,
        capital_flows: (flows.data ?? []).length
          ? {
              flows: (flows.data ?? []).map((f: any) => ({
                node_key: f.node_key,
                value_usd_m: f.value_usd_m,
                period: f.period,
                confidence_grade: f.confidence_grade,
                method: f.method,
                provenance: f.provenance,
                notes: f.notes,
                citations: f.citations,
                updated_at: f.updated_at,
              })),
            }
          : null,
        __citations: {
          sector_dossier: allCitations(dossiers.data),
          ministry_deep_dive: allCitations(ministryProfiles.data),
          capital_flows: allCitations(flows.data),
        },
      };
    };

    const [country, runs, drafts, committedDraftsRaw, committedTargetData, cites, summaries, pipelineRuns, tgt] = await Promise.all([
      supabaseAdmin.from("countries").select("*").eq("code", cc).maybeSingle(),
      supabaseAdmin
        .from("onboarding_runs")
        .select("*")
        .eq("country_code", cc)
        .order("started_at", { ascending: false })
        .limit(50),
      supabaseAdmin
        .from("onboarding_drafts")
        .select("*")
        .eq("country_code", cc)
        .is("committed_at", null)
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("onboarding_drafts")
        .select("id, stage, payload, committed_at, run_id, target_table")
        .eq("country_code", cc)
        .not("committed_at", "is", null)
        .order("committed_at", { ascending: false }),
      loadCommittedTargetData(),
      supabaseAdmin
        .from("onboarding_citations")
        .select("*"),
      supabaseAdmin
        .from("onboarding_summaries")
        .select("*")
        .eq("country_code", cc),
      supabaseAdmin
        .from("onboarding_pipeline_runs")
        .select("*")
        .eq("country_code", cc)
        .order("started_at", { ascending: false })
        .limit(5),
      countCommittedTargets(supabaseAdmin, cc),
    ]);

    // Dedupe committed drafts to newest per stage.
    const seenCommitted = new Set<string>();
    const committedDrafts = (committedDraftsRaw.data ?? []).filter((d: any) => {
      if (seenCommitted.has(d.stage)) return false;
      seenCommitted.add(d.stage);
      return true;
    });
    const committedDraftIds = new Set(committedDrafts.map((d: any) => d.id));

    const draftIds = new Set((drafts.data ?? []).map((d) => d.id));
    const cByDraft = new Map<string, any[]>();
    for (const c of cites.data ?? []) {
      if (!draftIds.has(c.draft_id) && !committedDraftIds.has(c.draft_id)) continue;
      const arr = cByDraft.get(c.draft_id) ?? [];
      arr.push(c);
      cByDraft.set(c.draft_id, arr);
    }
    // Dedupe drafts to the newest per stage; mark older ones superseded.
    const seen = new Set<string>();
    const dedupedDrafts = (drafts.data ?? []).map((d) => {
      const superseded = seen.has(d.stage);
      seen.add(d.stage);
      return { ...d, superseded, citations: cByDraft.get(d.id) ?? [] };
    });
    const committedDraftsWithCites = committedDrafts.map((d: any) => ({
      ...d,
      citations: cByDraft.get(d.id) ?? [],
    }));
    const committedData = Object.entries(committedTargetData)
      .filter(([stage, payload]) => !stage.startsWith("__") && payload != null)
      .map(([stage, payload]) => ({
        stage,
        payload,
        citations: (committedTargetData.__citations as any)?.[stage] ?? [],
      }));
    return {
      country: country.data,
      runs: runs.data ?? [],
      drafts: dedupedDrafts,
      committedDrafts: committedDraftsWithCites,
      committedData,
      summaries: summaries.data ?? [],
      pipelineRuns: pipelineRuns.data ?? [],
      committedTargets: tgt.targets,
      statusDiagnostics: tgt.diagnostics,
    };

  });

// Row counts per stage in the actual target tables — the ground truth for
// whether a stage is "committed" (vs the ephemeral run status).
async function countCommittedTargets(admin: any, cc: string) {
  const diagnostics: Array<{ stage: string; message: string }> = [];
  const zero = { rows: 0 as number };
  const count = async (stage: string, q: any) => {
    const { count, error } = await q;
    if (error) {
      diagnostics.push({ stage, message: error.message ?? String(error) });
      console.error(`[onboarding] committed-target count failed for ${stage}:`, error);
      return { ...zero, error: error.message ?? String(error) };
    }
    return { rows: count ?? 0 };
  };
  const [
    countryRow,
    sectorsC,
    ministriesC,
    ministrySectorsC,
    sourcesC,
    kpisC,
    dossiersC,
    ministerProfilesC,
    chunksC,
    memoryC,
    flowsC,
  ] = await Promise.all([
    admin.from("countries").select("profile_committed_at, gdp_committed_at").eq("code", cc).maybeSingle(),
    count("sector_composition", admin.from("country_sectors").select("*", { count: "exact", head: true }).eq("country_code", cc)),
    count("ministries", admin.from("ministries").select("*", { count: "exact", head: true }).eq("country_code", cc)),
    count(
      "ministry_sector_map",
      admin
        .from("ministry_sectors")
        .select("ministry_id, ministries!inner(country_code)", { count: "exact", head: true })
        .eq("ministries.country_code", cc),
    ),
    count("source_registry", admin.from("country_sources").select("*", { count: "exact", head: true }).eq("country_code", cc)),
    count("kpi_seed", admin.from("country_kpis").select("*", { count: "exact", head: true }).eq("country_code", cc)),
    count("sector_dossier", admin.from("sector_dossiers").select("*", { count: "exact", head: true }).eq("country_code", cc)),
    count("ministry_deep_dive", admin.from("ministry_profiles").select("*", { count: "exact", head: true }).eq("country_code", cc)),
    count("corpus_ingest", admin.from("country_source_chunks").select("*", { count: "exact", head: true }).eq("country_code", cc)),
    // memory_objects are country-scoped by scope_key, not country_code.
    count("second_brain_seed", admin.from("memory_objects").select("*", { count: "exact", head: true }).eq("scope_key", cc)),
    count("capital_flows", admin.from("country_capital_flows").select("*", { count: "exact", head: true }).eq("country_code", cc)),
  ]);
  if (countryRow.error) {
    diagnostics.push({ stage: "profile", message: countryRow.error.message ?? String(countryRow.error) });
    diagnostics.push({ stage: "gdp", message: countryRow.error.message ?? String(countryRow.error) });
  }
  const c = countryRow.data;
  const targets = {
    profile: { rows: c?.profile_committed_at ? 1 : 0 },
    gdp: { rows: c?.gdp_committed_at ? 1 : 0 },

    sector_composition: sectorsC,
    ministries: ministriesC,
    ministry_sector_map: ministrySectorsC,
    source_registry: sourcesC,
    kpi_seed: kpisC,
    sector_dossier: dossiersC,
    ministry_deep_dive: ministerProfilesC,
    corpus_ingest: chunksC,
    second_brain_seed: memoryC,
    capital_flows: flowsC,
  } as Record<string, { rows: number }>;
  return { targets, diagnostics };
}



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
    ...SUMMARY_SCHEMA_FRAGMENT,
  },
  required: [
    "currency",
    "fiscal_year_start_month",
    "population",
    "main_exports",
    "government_type",
    "head_of_government",
    "notes",
    "summary_md",
    "summary_highlights",
  ],
} as const;

export const runProfileAgent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ countryCode: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const country = await loadCountry(supabaseAdmin, data.countryCode);
    const ctx = await buildCountryContext(supabaseAdmin, data.countryCode);

    const model: SonarModel = "sonar-pro";
    const runId = await openRun(supabaseAdmin, {
      country_code: data.countryCode,
      stage: "profile",
      userId: context.userId,
      model_stack: { perplexity: model },
    });

    try {
      const fb = await runWithFallbacks<any>({
        context: ctx,
        topic: `${country.name} — country profile, head of government, population, HDI, main exports`,
        perplexity: {
          model,
          system:
            "You are a country-profile researcher. Answer with a single JSON object matching the schema. Prefer the country's official government portal and national statistics office; secondary sources are IMF, World Bank, UN. Cite every fact. If a field is unknown from primary sources, return the most recent multilateral estimate and note it." +
            SUMMARY_SYSTEM_SUFFIX,
          user: `Research ${country.name} (${country.iso3 ?? country.code}). Return:\n- currency (ISO 4217)\n- fiscal_year_start_month (1-12)\n- population (most recent official)\n- HDI (or null)\n- main_exports: top 3-5 export categories\n- government_type\n- head_of_government (verify the current holder as of ${new Date().getFullYear()} — cross-check the official portal AND a recent news source; do not rely solely on Wikipedia).`,
          responseSchema: ProfileSchema as unknown as Record<string, unknown>,
          recency: "month",
        },
        gemini: {
          system: "You are a country-profile researcher for " + country.name + ".",
          user: `Extract the profile fields for ${country.name} (${country.iso3 ?? country.code}) from the source material and partial output.`,
          schemaHint:
            `{ "currency": "ISO 4217", "fiscal_year_start_month": 1-12, "population": number, "hdi": number|null, "main_exports": string[], "government_type": string, "head_of_government": string, "notes": string, "summary_md": string, "summary_highlights": [{"label": string, "value": string}] }`,
        },
        parse: jsonParser<any>(),
        validate: (v) =>
          !!v &&
          typeof v.currency === "string" && /^[A-Z]{3}$/.test(v.currency) &&
          typeof v.head_of_government === "string" && v.head_of_government.trim().length > 3 &&
          !/unknown/i.test(v.head_of_government) &&
          Number(v.population) > 0,
        infer: () => ({ ...seedProfile(country.name, ctx), summary_md: `Provisional profile for ${country.name} — please review.`, summary_highlights: [] }),
      });

      const inline = extractInlineSummary(fb.data);
      const draftId = await saveDraft(supabaseAdmin, {
        run_id: runId,
        country_code: data.countryCode,
        stage: "profile",
        target_table: "countries",
        payload: fb.data,
        confidence: fb.tier === "perplexity" && fb.citations.length >= 2 ? "high" : fb.tier === "inferred" ? "low" : "medium",
        citations: fb.citations,
        summary_md: inline.summary_md,
        summary_highlights: inline.summary_highlights,
      });

      await promoteAfterDraft(supabaseAdmin, data.countryCode, "profile", draftId, fb);
      await finishRun(supabaseAdmin, runId, { status: "ready", model_stack: { ...fb.modelStack, notes: fb.notes } });
      return { runId, draftId, payload: fb.data, citations: fb.citations, tier: fb.tier, notes: fb.notes };
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
    ...SUMMARY_SCHEMA_FRAGMENT,
  },
  required: ["gdp_current_usd", "gdp_year", "source_primary", "notes", "summary_md", "summary_highlights"],
} as const;

export const runGdpAgent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ countryCode: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const country = await loadCountry(supabaseAdmin, data.countryCode);
    const ctx = await buildCountryContext(supabaseAdmin, data.countryCode);

    const model: SonarModel = "sonar-pro";
    const runId = await openRun(supabaseAdmin, {
      country_code: data.countryCode,
      stage: "gdp",
      userId: context.userId,
      model_stack: { perplexity: model },
    });

    try {
      const currentYear = new Date().getFullYear();
      const fb = await runWithFallbacks<any>({
        context: ctx,
        topic: `${country.name} nominal GDP most recent year (World Bank WDI, IMF WEO, national accounts)`,
        perplexity: {
          model,
          system:
            "You are a macro-economics researcher. Return a single JSON object. Cross-check GDP between World Bank WDI and IMF WEO — pick the most recent year where BOTH publish a figure. Cite both sources. Value MUST be in whole US dollars (not billions or millions)." +
            SUMMARY_SYSTEM_SUFFIX,
          user: `What is the nominal GDP of ${country.name} in current US dollars, most recent year (${currentYear - 3}-${currentYear})? Prefer World Bank WDI and IMF WEO, cross-checked. Return the value in whole USD (e.g. 1750000000, not 1.75). Include both sources.`,
          responseSchema: GdpSchema as unknown as Record<string, unknown>,
          recency: "year",
        },
        gemini: {
          system: "You are a macro-economics researcher.",
          user: `Extract nominal GDP of ${country.name} in current USD from the source material. Value must be whole USD.`,
          schemaHint: `{ "gdp_current_usd": number, "gdp_year": integer, "source_primary": string, "source_secondary": string|null, "notes": string, "summary_md": string, "summary_highlights": [{"label": string, "value": string}] }`,
        },
        parse: jsonParser<any>(),
        validate: (v) =>
          !!v &&
          typeof v.gdp_current_usd === "number" &&
          v.gdp_current_usd > 1_000_000 && // sanity: at least 1M USD (rejects unit errors)
          Number.isInteger(v.gdp_year) &&
          v.gdp_year >= currentYear - 6 && v.gdp_year <= currentYear,
        infer: () => ({ ...seedGdp(), summary_md: `Provisional GDP for ${country.name} — please review.`, summary_highlights: [] }),
      });

      const inline = extractInlineSummary(fb.data);
      const draftId = await saveDraft(supabaseAdmin, {
        run_id: runId,
        country_code: data.countryCode,
        stage: "gdp",
        target_table: "countries",
        payload: fb.data,
        confidence: fb.tier === "perplexity" && fb.citations.length >= 2 ? "high" : fb.tier === "inferred" ? "low" : "medium",
        citations: fb.citations,
        summary_md: inline.summary_md,
        summary_highlights: inline.summary_highlights,
      });

      await promoteAfterDraft(supabaseAdmin, data.countryCode, "gdp", draftId, fb);
      await finishRun(supabaseAdmin, runId, { status: "ready", model_stack: { ...fb.modelStack, notes: fb.notes } });
      return { runId, draftId, payload: fb.data, citations: fb.citations, tier: fb.tier, notes: fb.notes };
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
    const ctx = await buildCountryContext(supabaseAdmin, data.countryCode);

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
        properties: {
          rows: {
            type: "array",
            items: {
              type: "object",
              properties: {
                sector_code: { type: "string" },
                share_pct: { type: "number", minimum: 0, maximum: 100 },
                confidence_grade: { type: "string", enum: ["A", "B", "C", "D", "F"] },
                rationale: { type: "string" },
              },
              required: ["sector_code", "share_pct"],
            },
          },
          method_note: { type: "string" },
          ...SUMMARY_SCHEMA_FRAGMENT,
        },
        required: ["rows"],
      } as const;

      const fb = await runWithFallbacks<{ rows: any[]; method_note: string; summary_md?: string; summary_highlights?: any[] }>({
        context: ctx,
        topic: `${country.name} GDP by industry / sector composition (national accounts, ISIC breakdown)`,
        perplexity: {
          model,
          system:
            "You are a national-accounts analyst. Map the country's GDP by industry (ISIC A-U) into the given sector taxonomy. Return one row per sector code (use 0 if the sector is negligible). Shares must sum to ~100%. Use A/B for values from official national accounts, C for multilateral estimates, D/F for inference. Cite each source. Think step-by-step: identify the most recent national accounts publication, extract each ISIC branch, then map to the taxonomy." +
            SUMMARY_SYSTEM_SUFFIX,
          user: `Country: ${country.name} (${country.iso3 ?? country.code}).\n\nSector taxonomy (return one row per code):\n${sectorList}\n\nUse the most recent full-year national accounts. Prefer the country's Central Statistical Office, then ECCB / CDB / IMF / World Bank. Show which ISIC branches map to which taxonomy sector in the rationale.`,
          responseSchema: rowsSchema as unknown as Record<string, unknown>,
          recency: "year",
        },
        gemini: {
          system: "You are a national-accounts analyst.",
          user: `Country: ${country.name}. Extract sector shares from the source material and map to this taxonomy: ${sectorList}. Return share_pct per sector code, summing to ~100.`,
          schemaHint: `{ "rows": [{"sector_code": string, "share_pct": number, "confidence_grade": "A"|"B"|"C"|"D"|"F", "rationale": string}], "method_note": string, "summary_md": string, "summary_highlights": [{"label": string, "value": string}] }`,
        },
        parse: jsonParser<{ rows: any[]; method_note: string }>(),
        validate: (v) => {
          if (!v?.rows?.length) return false;
          const nonZero = v.rows.filter((r: any) => Number(r.share_pct) > 0);
          if (nonZero.length < 4) return false;
          const total = v.rows.reduce((s: number, r: any) => s + Number(r.share_pct ?? 0), 0);
          return total >= 85 && total <= 115;
        },
        infer: () => ({
          rows: seedSectorComposition(sectors.map((s) => s.code), ctx),
          method_note: "Provisional small-state defaults — no primary source reached.",
          summary_md: `Provisional sector composition for ${country.name} — please review.`,
          summary_highlights: [],
        }),
      });

      const inline = extractInlineSummary(fb.data);
      const parsedRows: any[] = fb.data.rows ?? [];
      const bySector = new Map(parsedRows.map((r: any) => [String(r.sector_code), r]));
      const complete = sectors.map(
        (s) =>
          bySector.get(s.code) ?? {
            sector_code: s.code,
            share_pct: 0,
            confidence_grade: "F",
            rationale: "Not returned by agent — defaulted to 0",
          },
      );
      const total = complete.reduce((sum: number, r: any) => sum + Number(r.share_pct ?? 0), 0);

      const draftId = await saveDraft(supabaseAdmin, {
        run_id: runId,
        country_code: data.countryCode,
        stage: "sector_composition",
        target_table: "country_sectors",
        payload: { rows: complete, method_note: fb.data.method_note, total_pct: total },
        confidence:
          fb.tier === "inferred"
            ? "low"
            : total >= 95 && total <= 105 && fb.citations.length >= 2
            ? "high"
            : "medium",
        citations: fb.citations,
        summary_md: inline.summary_md,
        summary_highlights: inline.summary_highlights,
      });

      await promoteAfterDraft(supabaseAdmin, data.countryCode, "sector_composition", draftId, fb);
      await finishRun(supabaseAdmin, runId, { status: "ready", model_stack: { ...fb.modelStack, notes: fb.notes } });
      return { runId, draftId, rows: complete, total_pct: total, citations: fb.citations, tier: fb.tier, notes: fb.notes };
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
    const ctx = await buildCountryContext(supabaseAdmin, data.countryCode);

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
        properties: {
          ministries: {
            type: "array",
            items: {
              type: "object",
              properties: {
                slug: { type: "string", description: "kebab-case identifier" },
                name: { type: "string", description: "Full official ministry name" },
                minister: { type: ["string", "null"] },
                mandate: { type: "string" },
              },
              required: ["slug", "name"],
            },
          },
          ...SUMMARY_SCHEMA_FRAGMENT,
        },
        required: ["ministries"],
      } as const;

      const fb = await runWithFallbacks<{ ministries: any[]; summary_md?: string; summary_highlights?: any[] }>({
        context: ctx,
        topic: `${country.name} cabinet ministries and ministers (current)`,
        perplexity: {
          model,
          system:
            `You are a governance researcher. Return the current canonical cabinet ministries of ${country.name}. Prefer the official government portal (${ctx.portal ?? "the country's .gov site"}) — its "Cabinet" or "Government" or "Ministries" page. Cross-check against a recent news article (past 12 months) confirming the current minister names. A small state typically has 8-18 ministries; do not return fewer than 6 unless you have explicit evidence of a smaller cabinet.` +
            SUMMARY_SYSTEM_SUFFIX,
          user: `List the current cabinet ministries of ${country.name} as of ${new Date().getFullYear()}.\n\nFor each ministry:\n- slug (kebab-case, e.g. "finance", "foreign-affairs")\n- name (full official ministry name)\n- minister (current holder's full name — verify from official portal AND recent news; null only if truly unknown)\n- mandate (one-line description of the portfolio's scope)\n\nStart from ${ctx.portal ?? "the official government portal"}. If a cabinet reshuffle happened recently, use the latest.`,
          responseSchema: schema as unknown as Record<string, unknown>,
          recency: "month",
        },
        gemini: {
          system: "You are a governance researcher.",
          user: `Extract the current cabinet ministries of ${country.name} from the source material. Each item needs slug (kebab-case), full official name, current minister name (or null), and one-line mandate.`,
          schemaHint: `{ "ministries": [{"slug": string, "name": string, "minister": string|null, "mandate": string}], "summary_md": string, "summary_highlights": [{"label": string, "value": string}] }`,
        },
        parse: jsonParser<{ ministries: any[] }>(),
        validate: (v) => {
          if (!v?.ministries?.length || v.ministries.length < 6) return false;
          return v.ministries.every(
            (m: any) =>
              typeof m?.slug === "string" && /^[a-z0-9-]+$/.test(m.slug) &&
              typeof m?.name === "string" && m.name.trim().length > 3,
          );
        },
        infer: () => ({
          ministries: seedMinistries(country.name, ctx),
          summary_md: `Provisional canonical ministries for ${country.name} — please verify against the government portal.`,
          summary_highlights: [],
        }),
      });

      const inline = extractInlineSummary(fb.data);
      const draftId = await saveDraft(supabaseAdmin, {
        run_id: runId,
        country_code: data.countryCode,
        stage: "ministries",
        target_table: "ministries",
        payload: fb.data,
        confidence: fb.tier === "perplexity" && fb.citations.length >= 1 ? "high" : fb.tier === "inferred" ? "low" : "medium",
        citations: fb.citations,
        summary_md: inline.summary_md,
        summary_highlights: inline.summary_highlights,
      });

      await promoteAfterDraft(supabaseAdmin, data.countryCode, "ministries", draftId, fb);
      await finishRun(supabaseAdmin, runId, { status: "ready", model_stack: { ...fb.modelStack, notes: fb.notes } });
      return { runId, draftId, ministries: fb.data.ministries, citations: fb.citations, tier: fb.tier, notes: fb.notes };
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
    const ctx = await buildCountryContext(supabaseAdmin, data.countryCode);
    const { data: ministries, error: mErr } = await supabaseAdmin
      .from("ministries")
      .select("id, slug, name")
      .eq("country_code", data.countryCode);
    if (mErr) throw mErr;
    if (!ministries?.length) throw new Error("Commit ministries first — none exist for this country");

    // Pull committed minister identities so the mapping can attribute weights
    // to a real officeholder. Empty when stage 9 (ministry_deep_dive) hasn't
    // run yet — we still emit the mapping, just without minister attribution.
    const { data: profileRows } = await supabaseAdmin
      .from("ministry_profiles")
      .select("ministry_slug, minister, minister_profile")
      .eq("country_code", data.countryCode);
    const ministerBySlug = new Map<string, { name: string | null; title: string | null }>(
      (profileRows ?? []).map((r: any) => [
        r.ministry_slug,
        { name: r.minister ?? null, title: (r.minister_profile as any)?.title ?? null },
      ]),
    );
    const ministersResolved = Array.from(ministerBySlug.values()).filter((v) => v.name).length;


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
        properties: {
          mappings: {
            type: "array",
            items: {
              type: "object",
              properties: {
                ministry_slug: { type: "string" },
                sector_code: { type: "string" },
                weight: { type: "number", minimum: 0, maximum: 100 },
                rationale: { type: "string" },
              },
              required: ["ministry_slug", "sector_code", "weight"],
            },
          },
          ...SUMMARY_SCHEMA_FRAGMENT,
        },
        required: ["mappings"],
      } as const;

      const sectorList = sectors.map((s) => `${s.code} (${s.label})`).join(", ");
      const ministryList = ministries
        .map((m) => {
          const mp = ministerBySlug.get(m.slug);
          const attribution = mp?.name
            ? ` — Minister: ${mp.name}${mp.title ? ` (${mp.title})` : ""}`
            : "";
          return `${m.slug} (${m.name})${attribution}`;
        })
        .join("\n- ");
      const sectorWeights = ctx.committed.sectors.length
        ? `\n\nCOMMITTED SECTOR WEIGHTS (distribute ministerial ownership consistently with these shares):\n${ctx.committed.sectors.map((s) => `- ${s.sector_code}: ${Number(s.share_pct).toFixed(1)}%`).join("\n")}`
        : "";
      const ministerHint = ministersResolved
        ? `\n\nATTRIBUTED MINISTERS: ${ministersResolved}/${ministries.length} ministries have a verified officeholder above. Ground rationales in the named minister's public statements or mandate.`
        : `\n\nNOTE: minister names for this country have not been researched yet — run Stage 9 (ministry deep-dive) before this stage for attributed weights.`;
      const fb = await runWithFallbacks<{ mappings: any[]; summary_md?: string; summary_highlights?: any[] }>({
        context: ctx,
        topic: `${country.name} ministerial portfolios and sector ownership`,
        perplexity: {
          model,
          system:
            "You map ministerial portfolios to economic sectors. For each ministry, output the sectors it primarily oversees with a weight 0-100 representing its share of responsibility for that sector. Per-ministry weights across all its sectors should roughly sum to 100. Omit sectors a ministry has no role in. Use the official ministerial mandates on the government portal." +
            SUMMARY_SYSTEM_SUFFIX,
          user: `Country: ${country.name}.\n\nSectors: ${sectorList}.\n\nMinistries:\n- ${ministryList}${sectorWeights}${ministerHint}\n\nProvide the ministry→sector mapping. Every ministry MUST appear at least once. Ground the rationale in the actual mandate text where possible.`,
          responseSchema: schema as unknown as Record<string, unknown>,
        },
        gemini: {
          system: "You map ministerial portfolios to economic sectors.",
          user: `Country: ${country.name}. Sectors: ${sectorList}. Ministries: ${ministryList}. Extract mappings from source material; weight 0-100 per (ministry, sector); each ministry appears at least once.`,
          schemaHint: `{ "mappings": [{"ministry_slug": string, "sector_code": string, "weight": number, "rationale": string}], "summary_md": string, "summary_highlights": [{"label": string, "value": string}] }`,
        },
        parse: jsonParser<{ mappings: any[] }>(),
        validate: (v) => {
          if (!v?.mappings?.length) return false;
          const ministrySet = new Set(ministries.map((m) => m.slug));
          const covered = new Set(v.mappings.map((m: any) => m.ministry_slug));
          // At least 60% of ministries should be represented; otherwise cascade.
          return covered.size >= Math.ceil(ministrySet.size * 0.6);
        },
        infer: () => ({
          mappings: seedMinistrySectorMap(ministries.map((m) => m.slug), sectors.map((s) => s.code)),
          summary_md: `Provisional canonical portfolio→sector mapping for ${country.name} — please review.`,
          summary_highlights: [],
        }),
      });

      // Sidecar: minister index attached to draft payload so the review UI
      // can render "Sector X → Minister Y (Title Z)" without a DB migration.
      // The commit RPC ignores unknown fields; this is display-only.
      const minister_index = Object.fromEntries(
        Array.from(ministerBySlug.entries()).map(([slug, v]) => [slug, { name: v.name, title: v.title }]),
      );
      const enrichedMappings = Array.isArray(fb.data.mappings)
        ? fb.data.mappings.map((row: any) => {
            const mp = ministerBySlug.get(row?.ministry_slug);
            if (!mp?.name) return row;
            return { ...row, minister_name: mp.name, minister_title: mp.title ?? null };
          })
        : fb.data.mappings;
      const enrichedPayload = { ...fb.data, mappings: enrichedMappings, minister_index };

      const inline = extractInlineSummary(enrichedPayload);
      const draftSummary = ministersResolved
        ? inline.summary_md
        : `${inline.summary_md ?? ""}\n\n⚠️ Minister names unresolved — run Stage 9 (ministry deep-dive) first for attributed weights.`.trim();

      const draftId = await saveDraft(supabaseAdmin, {
        run_id: runId,
        country_code: data.countryCode,
        stage: "ministry_sector_map",
        target_table: "ministry_sectors",
        payload: enrichedPayload,
        confidence: fb.tier === "perplexity" && fb.citations.length >= 1 ? "medium" : "low",
        citations: fb.citations,
        summary_md: draftSummary,
        summary_highlights: inline.summary_highlights,
      });

      await promoteAfterDraft(supabaseAdmin, data.countryCode, "ministry_sector_map", draftId, fb);
      await finishRun(supabaseAdmin, runId, { status: "ready", model_stack: { ...fb.modelStack, notes: fb.notes } });
      return {
        runId,
        draftId,
        mappings: enrichedMappings,
        minister_index,
        ministers_resolved: ministersResolved,
        citations: fb.citations,
        tier: fb.tier,
        notes: fb.notes,
      };

    } catch (err) {
      await finishRun(supabaseAdmin, runId, { status: "failed", error: (err as Error).message });
      throw err;
    }
  });

// ============================================================
// LEARNED DOMAINS (read + demote)
// ============================================================

export const listCountryAuthorizedDomains = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ countryCode: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("country_authorized_domains")
      .select("id, domain, tier, first_seen_stage, citation_count, last_used_at, demoted_at, created_at")
      .eq("country_code", data.countryCode)
      .order("last_used_at", { ascending: false });
    if (error) throw error;
    return rows ?? [];
  });

export const demoteCountryAuthorizedDomain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), demote: z.boolean().default(true) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("country_authorized_domains")
      .update({ demoted_at: data.demote ? new Date().toISOString() : null })
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
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

    // Fallback: no inline summary on this draft → generate one (fire-and-forget).
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
      profile_committed_at: new Date().toISOString(),
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
        gdp_committed_at: new Date().toISOString(),
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

    const rows = payload.rows
      .filter((r) => Number(r.share_pct) > 0)
      .map((r) => ({
        sector_code: r.sector_code,
        share_pct: r.share_pct,
        confidence_grade: r.confidence_grade || "C",
      }));
    if (rows.length === 0) {
      throw new Error("Commit rejected: sector composition has 0 valid rows. Draft remains open.");
    }
    // Atomic replace via RPC — delete+insert in a single transaction.
    const { error: rpcErr } = await supabaseAdmin.rpc("replace_country_sectors", {
      _country_code: draft.country_code,
      _rows: rows as any,
    });
    if (rpcErr) throw rpcErr;
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
    if (rows.length === 0) {
      throw new Error("Commit rejected: ministries draft has 0 rows. Draft remains open.");
    }
    const { error: upErr } = await supabaseAdmin
      .from("ministries")
      .upsert(rows, { onConflict: "country_code,slug" })
      .select("id");
    if (upErr) throw upErr;
    const { count: targetRows, error: countErr } = await supabaseAdmin
      .from("ministries")
      .select("*", { count: "exact", head: true })
      .eq("country_code", draft.country_code);
    if (countErr) throw countErr;
    if ((targetRows ?? 0) === 0) {
      throw new Error("Commit rejected: ministries write produced 0 target rows. Draft remains open.");
    }
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

    // Guard against the AI hallucinating sector codes outside the canonical taxonomy.
    const { data: sectorRows, error: sErr } = await supabaseAdmin.from("sectors").select("code");
    if (sErr) throw sErr;
    const validCodes = new Set((sectorRows ?? []).map((r: any) => r.code));
    const allMappings = payload.mappings ?? [];
    const cleanMappings = allMappings.filter((m) => validCodes.has(m.sector_code));
    const dropped = allMappings.filter((m) => !validCodes.has(m.sector_code));
    if (cleanMappings.length === 0) {
      throw new Error(
        `Commit rejected: none of ${allMappings.length} mapping(s) reference a valid sector code. ` +
          `Unknown codes: ${[...new Set(dropped.map((d) => d.sector_code))].join(", ")}`,
      );
    }

    // Dedupe by (ministry_slug, sector_code) — the AI sometimes emits the same
    // pair twice, which would violate ministry_sectors_pkey (ministry_id,
    // sector_code) on the RPC's bulk insert. Keep the max weight per pair.
    const dedupMap = new Map<string, { ministry_slug: string; sector_code: string; weight: number }>();
    for (const m of cleanMappings) {
      const key = `${m.ministry_slug}|${m.sector_code}`;
      const prev = dedupMap.get(key);
      const weight = Number(m.weight ?? 1) || 1;
      if (!prev || weight > prev.weight) dedupMap.set(key, { ...m, weight });
    }
    const uniqueMappings = [...dedupMap.values()];
    const duplicatesCollapsed = cleanMappings.length - uniqueMappings.length;

    // Atomic replace via RPC. The RPC resolves ministry_slug → ministry_id server-side.
    const { error: rpcErr } = await supabaseAdmin.rpc("replace_ministry_sectors", {
      _country_code: draft.country_code,
      _rows: uniqueMappings as any,
    });
    if (rpcErr) throw rpcErr;

    const { count: targetRows, error: countErr } = await supabaseAdmin
      .from("ministry_sectors")
      .select("ministry_id, ministries!inner(country_code)", { count: "exact", head: true })
      .eq("ministries.country_code", draft.country_code);
    if (countErr) throw countErr;
    if ((targetRows ?? 0) === 0) {
      throw new Error("Commit rejected: ministry-sector map wrote 0 target rows. Draft remains open.");
    }
    await markDraftCommitted(supabaseAdmin, draft.id, draft.run_id);

    return { ok: true, inserted: cleanMappings.length, dropped: dropped.length, dropped_codes: [...new Set(dropped.map((d) => d.sector_code))] };

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
