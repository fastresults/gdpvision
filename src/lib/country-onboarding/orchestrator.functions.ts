// Sequential onboarding orchestrator.
//
// One country = one run at a time. Each stage runs inline through the existing
// per-stage runner + committer (called from the admin UI). No worker pool, no
// cron, no durable job tables. The helpers below tell the UI whether to run
// missing work or commit an already-generated draft before spending more AI.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type Stage =
  | "profile"
  | "gdp"
  | "sector_composition"
  | "ministries"
  | "ministry_sector_map"
  | "source_registry"
  | "kpi_seed"
  | "sector_dossier"
  | "ministry_deep_dive"
  | "corpus_ingest"
  | "second_brain_seed"
  | "capital_flows";

// Fixed sequential order — later stages depend on data written by earlier ones.
export const STAGE_ORDER: Stage[] = [
  "profile",
  "gdp",
  "sector_composition",
  "ministries",
  "ministry_sector_map",
  "source_registry",
  "kpi_seed",
  "sector_dossier",
  "ministry_deep_dive",
  "corpus_ingest",
  "second_brain_seed",
  "capital_flows",
];

const Input = z.object({
  countryCode: z.string().min(2).max(4),
  rerun: z.boolean().optional().default(false),
});

export type NextOnboardingAction = "run_stage" | "commit_ready_draft" | "done";

type ReadyDraft = {
  id: string;
  stage: Stage;
  target_table: string | null;
  created_at: string;
  run_id: string | null;
  run_status: string | null;
  commit_eligible: boolean;
  blocked_reason: string | null;
};

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data: isAdmin } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (!isAdmin) throw new Error("Forbidden: super admin only");
}

async function committedRowsByStage(
  admin: any,
  countryCode: string,
): Promise<Record<Stage, number>> {
  const count = async (q: any) => {
    const { count, error } = await q;
    if (error) return 0;
    return count ?? 0;
  };
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
    admin.from("countries").select("profile_committed_at, gdp_committed_at").eq("code", countryCode).maybeSingle(),
    count(admin.from("country_sectors").select("*", { count: "exact", head: true }).eq("country_code", countryCode)),
    count(admin.from("ministries").select("*", { count: "exact", head: true }).eq("country_code", countryCode)),
    count(admin.from("ministry_sectors").select("ministry_id, ministries!inner(country_code)", { count: "exact", head: true }).eq("ministries.country_code", countryCode)),
    count(admin.from("country_sources").select("*", { count: "exact", head: true }).eq("country_code", countryCode)),
    count(admin.from("country_kpis").select("*", { count: "exact", head: true }).eq("country_code", countryCode)),
    count(admin.from("sector_dossiers").select("*", { count: "exact", head: true }).eq("country_code", countryCode)),
    count(admin.from("ministry_profiles").select("*", { count: "exact", head: true }).eq("country_code", countryCode)),
    count(admin.from("country_source_chunks").select("*", { count: "exact", head: true }).eq("country_code", countryCode)),
    count(admin.from("memory_objects").select("*", { count: "exact", head: true }).eq("scope_key", countryCode)),
    count(admin.from("country_capital_flows").select("*", { count: "exact", head: true }).eq("country_code", countryCode)),
  ]);
  const c = countryRow.data as { profile_committed_at?: string | null; gdp_committed_at?: string | null } | null;
  return {
    profile: c?.profile_committed_at ? 1 : 0,
    gdp: c?.gdp_committed_at ? 1 : 0,
    sector_composition: sectors,
    ministries,
    ministry_sector_map: ministrySectors,
    source_registry: sources,
    kpi_seed: kpis,
    sector_dossier: dossiers,
    ministry_deep_dive: ministryProfiles,
    corpus_ingest: chunks,
    second_brain_seed: memories,
    capital_flows: flows,
  };
}

function isStage(raw: unknown): raw is Stage {
  return typeof raw === "string" && (STAGE_ORDER as readonly string[]).includes(raw);
}

function isCapitalFlowCommitEligible(payload: any): boolean {
  return Boolean(
    payload &&
    Array.isArray(payload.flows) &&
    payload.flows.length > 0 &&
    payload.coverage?.coverageOk === true,
  );
}

function isDraftCommitEligible(stage: Stage, payload: any): { ok: boolean; reason: string | null } {
  if (stage === "corpus_ingest") return { ok: false, reason: "corpus ingest auto-commits from its runner" };
  if (stage === "capital_flows" && !isCapitalFlowCommitEligible(payload)) {
    return { ok: false, reason: "capital-flow draft has not passed coverage/reconciliation gates" };
  }
  return { ok: true, reason: null };
}

async function readyDraftsByStage(admin: any, countryCode: string): Promise<Partial<Record<Stage, ReadyDraft>>> {
  const { data: drafts, error: draftsError } = await admin
    .from("onboarding_drafts")
    .select("id, stage, target_table, payload, created_at, run_id")
    .eq("country_code", countryCode)
    .is("committed_at", null)
    .order("created_at", { ascending: false });
  if (draftsError) throw draftsError;

  const runIds = [...new Set((drafts ?? []).map((d: any) => d.run_id).filter(Boolean))];
  const runStatusById = new Map<string, string>();
  if (runIds.length) {
    const { data: runs, error: runsError } = await admin
      .from("onboarding_runs")
      .select("id, status")
      .in("id", runIds);
    if (runsError) throw runsError;
    for (const r of runs ?? []) runStatusById.set(r.id, r.status);
  }

  const byStage: Partial<Record<Stage, ReadyDraft>> = {};
  for (const d of drafts ?? []) {
    if (!isStage(d.stage) || byStage[d.stage]) continue;
    const runStatus = d.run_id ? runStatusById.get(d.run_id) ?? null : null;
    if (runStatus && ["failed", "stale"].includes(runStatus)) continue;
    const eligibility = isDraftCommitEligible(d.stage, d.payload);
    byStage[d.stage] = {
      id: d.id,
      stage: d.stage,
      target_table: d.target_table ?? null,
      created_at: d.created_at,
      run_id: d.run_id ?? null,
      run_status: runStatus,
      commit_eligible: eligibility.ok,
      blocked_reason: eligibility.reason,
    };
  }
  return byStage;
}

async function getNextAction(admin: any, countryCode: string, rerun: boolean) {
  const committed = await committedRowsByStage(admin, countryCode);
  const readyDrafts = await readyDraftsByStage(admin, countryCode);

  if (rerun) {
    return {
      action: "run_stage" as const,
      nextStage: STAGE_ORDER[0],
      draftId: null,
      readyDraft: null,
      done: false,
      remaining: STAGE_ORDER.filter((s) => (committed[s] ?? 0) === 0).length,
      committed,
      readyDrafts,
    };
  }

  for (const stage of STAGE_ORDER) {
    if ((committed[stage] ?? 0) > 0) continue;
    const readyDraft = readyDrafts[stage] ?? null;
    if (readyDraft?.commit_eligible) {
      return {
        action: "commit_ready_draft" as const,
        nextStage: stage,
        draftId: readyDraft.id,
        readyDraft,
        done: false,
        remaining: STAGE_ORDER.filter((s) => (committed[s] ?? 0) === 0).length,
        committed,
        readyDrafts,
      };
    }
    return {
      action: "run_stage" as const,
      nextStage: stage,
      draftId: null,
      readyDraft,
      done: false,
      remaining: STAGE_ORDER.filter((s) => (committed[s] ?? 0) === 0).length,
      committed,
      readyDrafts,
    };
  }

  return {
    action: "done" as const,
    nextStage: null,
    draftId: null,
    readyDraft: null,
    done: true,
    remaining: 0,
    committed,
    readyDrafts,
  };
}

/**
 * Returns the next safe action for this country.
 * - commit_ready_draft: target rows are missing, but a usable draft already exists.
 * - run_stage: no usable draft exists, so the stage runner should execute.
 * - done: every target has committed rows.
 *
 * The client-side "Run all pending" loop calls this, invokes that stage's
 * runner + committer, then calls this again — until `done: true`.
 */
export const getNextOnboardingStage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Clear any stale open onboarding_runs row for this country (>15min without heartbeat)
    // so a new run for the same stage isn't blocked by the unique index.
    const cutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    await supabaseAdmin
      .from("onboarding_runs")
      .update({ status: "stale", finished_at: new Date().toISOString(), error: "auto-cleared: no heartbeat >15min" })
      .eq("country_code", data.countryCode)
      .in("status", ["queued", "planning", "searching", "extracting", "validating"])
      .lt("updated_at", cutoff);

    return getNextAction(supabaseAdmin, data.countryCode, data.rerun);
  });

export const advanceCountryOnboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const cutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    await supabaseAdmin
      .from("onboarding_runs")
      .update({ status: "stale", finished_at: new Date().toISOString(), error: "auto-cleared: no heartbeat >15min" })
      .eq("country_code", data.countryCode)
      .in("status", ["queued", "planning", "searching", "extracting", "validating"])
      .lt("updated_at", cutoff);

    return getNextAction(supabaseAdmin, data.countryCode, data.rerun);
  });

/**
 * Manually clear stale open onboarding_runs rows for a country. Used by the
 * "Clear locks" button if a previous run got interrupted mid-flight and the
 * unique index is blocking a retry sooner than the auto-clear window.
 */
export const clearOnboardingLocks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ countryCode: z.string().min(2).max(4) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: cleared, error } = await supabaseAdmin
      .from("onboarding_runs")
      .update({ status: "stale", finished_at: new Date().toISOString(), error: "manually cleared" })
      .eq("country_code", data.countryCode)
      .in("status", ["queued", "planning", "searching", "extracting", "validating"])
      .select("id, stage");
    if (error) throw error;
    return { cleared: cleared?.length ?? 0, stages: (cleared ?? []).map((r: any) => r.stage) };
  });
