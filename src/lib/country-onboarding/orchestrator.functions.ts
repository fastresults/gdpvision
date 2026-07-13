import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type Stage =
  | "profile"
  | "gdp"
  | "sector_composition"
  | "ministries"
  | "source_registry"
  | "kpi_seed"
  | "ministry_sector_map"
  | "sector_dossier"
  | "ministry_deep_dive"
  | "corpus_ingest"
  | "second_brain_seed"
  | "capital_flows";

const STAGE_ORDER: Stage[] = [
  "profile",
  "gdp",
  "sector_composition",
  "ministries",
  "source_registry",
  "kpi_seed",
  "ministry_sector_map",
  "sector_dossier",
  "ministry_deep_dive",
  "corpus_ingest",
  "second_brain_seed",
  "capital_flows",
];

const Input = z.object({
  countryCode: z.string().min(2).max(4),
  mode: z.enum(["pending", "rerun"]).default("pending"),
});

const JobInput = z.object({ jobId: z.string().uuid() });
const RecoverInput = z.object({ countryCode: z.string().min(2).max(4), staleMinutes: z.number().int().min(5).max(240).default(15) });

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data: isAdmin } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (!isAdmin) throw new Error("Forbidden: super admin only");
}

async function getCommittedTargets(admin: any, countryCode: string): Promise<Record<Stage, number>> {
  const count = async (q: any) => {
    const { count, error } = await q;
    if (error) return 0;
    return count ?? 0;
  };
  const [countryRow, sectors, ministries, ministrySectors, sources, kpis, dossiers, ministryProfiles, chunks, memories, flows] = await Promise.all([
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
  const c = countryRow.data;
  return {
    profile: c?.profile_committed_at ? 1 : 0,
    gdp: c?.gdp_committed_at ? 1 : 0,
    sector_composition: sectors,
    ministries,
    source_registry: sources,
    kpi_seed: kpis,
    ministry_sector_map: ministrySectors,
    sector_dossier: dossiers,
    ministry_deep_dive: ministryProfiles,
    corpus_ingest: chunks,
    second_brain_seed: memories,
    capital_flows: flows,
  };
}

async function enqueueSteps(admin: any, jobId: string, countryCode: string, mode: "pending" | "rerun") {
  const committed = mode === "pending" ? await getCommittedTargets(admin, countryCode) : ({} as Record<Stage, number>);
  const rows = STAGE_ORDER.map((stage, i) => ({
    job_id: jobId,
    country_code: countryCode,
    stage,
    step_key: stage,
    step_type: "stage",
    status: mode === "pending" && (committed[stage] ?? 0) > 0 ? "skipped" : "queued",
    checkpoint: { order: i, committedRows: committed[stage] ?? 0 },
    output: {},
  }));
  const { error } = await admin.from("onboarding_job_steps").upsert(rows, { onConflict: "job_id,stage,step_key" });
  if (error) throw error;
}

export const runCountryOnboardingPipeline = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const countryCode = data.countryCode;
    const staleCutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString();

    await supabaseAdmin
      .from("onboarding_jobs")
      .update({ status: "stale", error: "auto-reconciled: no heartbeat >15min", finished_at: new Date().toISOString() })
      .eq("country_code", countryCode)
      .in("status", ["queued", "running"])
      .lt("updated_at", staleCutoff);

    const { data: existing } = await supabaseAdmin
      .from("onboarding_jobs")
      .select("id, status, progress, created_at")
      .eq("country_code", countryCode)
      .in("status", ["queued", "running"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing?.id) return { jobId: existing.id, status: existing.status, queued: false };

    const { data: job, error } = await supabaseAdmin
      .from("onboarding_jobs")
      .insert({
        country_code: countryCode,
        mode: data.mode,
        status: "queued",
        started_by: context.userId,
        progress: { totalStages: STAGE_ORDER.length, completed: 0, stages: STAGE_ORDER },
      })
      .select("id")
      .single();
    if (error) throw error;

    await enqueueSteps(supabaseAdmin, job.id, countryCode, data.mode);
    await supabaseAdmin.from("onboarding_job_events").insert({
      job_id: job.id,
      country_code: countryCode,
      event_type: "job.created",
      message: `Queued ${data.mode} onboarding workflow`,
      payload: { stages: STAGE_ORDER },
    });

    return { jobId: job.id as string, status: "queued", queued: true };
  });

export const getOnboardingJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ countryCode: z.string().optional(), jobId: z.string().uuid().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let jobQuery = supabaseAdmin.from("onboarding_jobs").select("*");
    if (data.jobId) jobQuery = jobQuery.eq("id", data.jobId).limit(1);
    else if (data.countryCode) jobQuery = jobQuery.eq("country_code", data.countryCode).order("created_at", { ascending: false }).limit(1);
    else throw new Error("countryCode or jobId required");
    const { data: jobs, error } = await jobQuery;
    if (error) throw error;
    const job = Array.isArray(jobs) ? jobs[0] ?? null : jobs;
    if (!job) return null;
    const { data: steps } = await supabaseAdmin
      .from("onboarding_job_steps")
      .select("*")
      .eq("job_id", job.id)
      .order("created_at", { ascending: true });
    const { data: events } = await supabaseAdmin
      .from("onboarding_job_events")
      .select("*")
      .eq("job_id", job.id)
      .order("created_at", { ascending: false })
      .limit(20);
    return { job, steps: steps ?? [], events: events ?? [] };
  });

export const resumeOnboardingJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => JobInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("onboarding_job_steps")
      .update({ status: "queued", error: null, lease_owner: null, lease_expires_at: null })
      .eq("job_id", data.jobId)
      .in("status", ["failed", "stale", "running"]);
    const { error } = await supabaseAdmin
      .from("onboarding_jobs")
      .update({ status: "queued", error: null, lease_owner: null, lease_expires_at: null })
      .eq("id", data.jobId);
    if (error) throw error;
    return { ok: true };
  });

export const cancelOnboardingJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => JobInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const now = new Date().toISOString();
    await supabaseAdmin.from("onboarding_job_steps").update({ status: "cancelled", finished_at: now }).eq("job_id", data.jobId).in("status", ["queued", "running", "blocked"]);
    const { error } = await supabaseAdmin.from("onboarding_jobs").update({ status: "cancelled", finished_at: now }).eq("id", data.jobId);
    if (error) throw error;
    return { ok: true };
  });

export const recoverStaleOnboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => RecoverInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const cutoff = new Date(Date.now() - data.staleMinutes * 60 * 1000).toISOString();
    const now = new Date().toISOString();
    const [runs, pipelines, jobs, steps] = await Promise.all([
      supabaseAdmin.from("onboarding_runs").update({ status: "stale", finished_at: now, error: `manual recovery: no heartbeat >${data.staleMinutes}min` }).eq("country_code", data.countryCode).in("status", ["queued", "planning", "searching", "extracting", "validating"]).lt("updated_at", cutoff).select("id"),
      supabaseAdmin.from("onboarding_pipeline_runs").update({ status: "failed", finished_at: now, error: `manual recovery: no heartbeat >${data.staleMinutes}min` }).eq("country_code", data.countryCode).eq("status", "running").lt("updated_at", cutoff).select("id"),
      supabaseAdmin.from("onboarding_jobs").update({ status: "stale", finished_at: now, error: `manual recovery: no heartbeat >${data.staleMinutes}min` }).eq("country_code", data.countryCode).in("status", ["queued", "running"]).lt("updated_at", cutoff).select("id"),
      supabaseAdmin.from("onboarding_job_steps").update({ status: "stale", finished_at: now, error: `manual recovery: no heartbeat >${data.staleMinutes}min` }).eq("country_code", data.countryCode).eq("status", "running").lt("updated_at", cutoff).select("id"),
    ]);
    return {
      ok: true,
      staleRuns: runs.data?.length ?? 0,
      stalePipelines: pipelines.data?.length ?? 0,
      staleJobs: jobs.data?.length ?? 0,
      staleSteps: steps.data?.length ?? 0,
    };
  });