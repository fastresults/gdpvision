import type { Stage } from "./orchestrator.functions";

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

const TERMINAL = ["completed", "failed", "cancelled", "skipped", "needs_review", "blocked", "stale"];

async function loadCountry(admin: any, code: string) {
  const { data, error } = await admin
    .from("countries")
    .select("code, name, iso3, currency, gdp_current_usd")
    .eq("code", code)
    .maybeSingle();
  if (error || !data) throw new Error(`Country ${code} not found`);
  return data as { code: string; name: string; iso3: string | null; currency: string; gdp_current_usd: number | null };
}

async function countCommitted(admin: any, countryCode: string, stage: Stage): Promise<number> {
  const count = async (q: any) => {
    const { count, error } = await q;
    if (error) return 0;
    return count ?? 0;
  };
  if (stage === "profile" || stage === "gdp") {
    const { data } = await admin.from("countries").select("profile_committed_at, gdp_committed_at").eq("code", countryCode).maybeSingle();
    return stage === "profile" ? (data?.profile_committed_at ? 1 : 0) : (data?.gdp_committed_at ? 1 : 0);
  }
  if (stage === "sector_composition") return count(admin.from("country_sectors").select("*", { count: "exact", head: true }).eq("country_code", countryCode));
  if (stage === "ministries") return count(admin.from("ministries").select("*", { count: "exact", head: true }).eq("country_code", countryCode));
  if (stage === "source_registry") return count(admin.from("country_sources").select("*", { count: "exact", head: true }).eq("country_code", countryCode));
  if (stage === "kpi_seed") return count(admin.from("country_kpis").select("*", { count: "exact", head: true }).eq("country_code", countryCode));
  if (stage === "ministry_sector_map") {
    return count(admin.from("ministry_sectors").select("ministry_id, ministries!inner(country_code)", { count: "exact", head: true }).eq("ministries.country_code", countryCode));
  }
  if (stage === "sector_dossier") return count(admin.from("sector_dossiers").select("*", { count: "exact", head: true }).eq("country_code", countryCode));
  if (stage === "ministry_deep_dive") return count(admin.from("ministry_profiles").select("*", { count: "exact", head: true }).eq("country_code", countryCode));
  if (stage === "corpus_ingest") return count(admin.from("country_source_chunks").select("*", { count: "exact", head: true }).eq("country_code", countryCode));
  if (stage === "second_brain_seed") return count(admin.from("memory_objects").select("*", { count: "exact", head: true }).eq("scope_key", countryCode));
  if (stage === "capital_flows") return count(admin.from("country_capital_flows").select("*", { count: "exact", head: true }).eq("country_code", countryCode));
  return 0;
}

async function openLegacyRun(admin: any, params: { countryCode: string; stage: Stage; userId: string | null; modelStack: Record<string, string> }) {
  const staleCutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  await admin
    .from("onboarding_runs")
    .update({ status: "stale", finished_at: new Date().toISOString(), error: "durable worker recovery: stale open run" })
    .eq("country_code", params.countryCode)
    .eq("stage", params.stage)
    .in("status", ["queued", "planning", "searching", "extracting", "validating"])
    .lt("updated_at", staleCutoff);

  const { data, error } = await admin
    .from("onboarding_runs")
    .insert({
      country_code: params.countryCode,
      stage: params.stage,
      status: "planning",
      started_by: params.userId,
      model_stack: params.modelStack,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

async function writeEvent(admin: any, args: { jobId: string; stepId?: string; countryCode: string; eventType: string; message?: string; payload?: unknown }) {
  await admin.from("onboarding_job_events").insert({
    job_id: args.jobId,
    step_id: args.stepId ?? null,
    country_code: args.countryCode,
    event_type: args.eventType,
    message: args.message ?? null,
    payload: (args.payload ?? {}) as any,
  });
}

async function refreshJobStatus(admin: any, jobId: string) {
  const { data: steps } = await admin.from("onboarding_job_steps").select("stage, status, error, output").eq("job_id", jobId);
  const rows = steps ?? [];
  const counts = rows.reduce((acc: Record<string, number>, s: any) => {
    acc[s.status] = (acc[s.status] ?? 0) + 1;
    return acc;
  }, {});
  const done = rows.filter((s: any) => TERMINAL.includes(s.status)).length;
  const failed = rows.find((s: any) => s.status === "failed");
  const blocked = rows.find((s: any) => s.status === "blocked");
  const running = rows.find((s: any) => s.status === "running");
  const queued = rows.find((s: any) => s.status === "queued");
  let status = "running";
  if (failed) status = "failed";
  else if (blocked && !queued && !running) status = "blocked";
  else if (done === rows.length) status = "completed";
  const current = running?.stage ?? queued?.stage ?? null;
  await admin.from("onboarding_jobs").update({
    status,
    current_stage: current,
    heartbeat_at: new Date().toISOString(),
    progress: { total: rows.length, done, counts, currentStage: current, updatedAt: new Date().toISOString() },
    error: failed?.error ?? blocked?.error ?? null,
    finished_at: status === "completed" || status === "failed" || status === "blocked" ? new Date().toISOString() : null,
  }).eq("id", jobId);
}

async function nextRunnableStep(admin: any, job: any) {
  const { data: steps } = await admin
    .from("onboarding_job_steps")
    .select("*")
    .eq("job_id", job.id)
    .order("created_at", { ascending: true });
  const rows = steps ?? [];
  for (const stage of STAGE_ORDER) {
    const step = rows.find((s: any) => s.stage === stage && s.step_key === stage);
    if (!step) continue;
    if (TERMINAL.includes(step.status)) continue;
    if (step.status === "running" && step.heartbeat_at && Date.now() - new Date(step.heartbeat_at).getTime() < 15 * 60 * 1000) return null;
    return step;
  }
  return null;
}

async function executeStep(admin: any, job: any, step: any) {
  const now = new Date().toISOString();
  await admin
    .from("onboarding_job_steps")
    .update({ status: "running", attempt_count: Number(step.attempt_count ?? 0) + 1, started_at: step.started_at ?? now, heartbeat_at: now, lease_owner: "durable-worker", lease_expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(), error: null })
    .eq("id", step.id);
  await admin.from("onboarding_jobs").update({ status: "running", current_stage: step.stage, heartbeat_at: now }).eq("id", job.id);
  await writeEvent(admin, { jobId: job.id, stepId: step.id, countryCode: job.country_code, eventType: "step.started", message: `Started ${step.stage}` });

  try {
    const committed = await countCommitted(admin, job.country_code, step.stage as Stage);
    if (job.mode === "pending" && committed > 0) {
      await admin.from("onboarding_job_steps").update({ status: "skipped", output: { committedRows: committed }, finished_at: new Date().toISOString(), heartbeat_at: new Date().toISOString() }).eq("id", step.id);
      return { status: "skipped", stage: step.stage };
    }

    if (step.stage === "kpi_seed") {
      const country = await loadCountry(admin, job.country_code);
      const runId = await openLegacyRun(admin, {
        countryCode: job.country_code,
        stage: "kpi_seed",
        userId: job.started_by ?? null,
        modelStack: { durable: "true", perplexity: "sonar-pro", lovable_ai: "google/gemini-2.5-pro" },
      });
      const { runKpiSeedResearch } = await import("./kpi-seed.server");
      const res = await runKpiSeedResearch({ admin, runId, country: { code: country.code, name: country.name, iso3: country.iso3 }, userId: job.started_by ?? null, autoCommit: true });
      await admin.from("onboarding_job_steps").update({ status: "completed", output: res as any, finished_at: new Date().toISOString(), heartbeat_at: new Date().toISOString() }).eq("id", step.id);
      return { status: "completed", stage: step.stage, res };
    }

    // Durable migration is intentionally conservative: non-KPI stages already
    // committed are skipped; uncommitted long AI stages are blocked with an
    // explicit reason instead of silently hanging inside one request.
    await admin.from("onboarding_job_steps").update({
      status: "blocked",
      error: `${step.stage} has not been migrated to durable worker execution yet; run/commit this stage individually, then resume the durable job.`,
      finished_at: new Date().toISOString(),
      heartbeat_at: new Date().toISOString(),
    }).eq("id", step.id);
    return { status: "blocked", stage: step.stage };
  } catch (err) {
    const msg = (err as Error).message ?? String(err);
    await admin.from("onboarding_job_steps").update({
      status: Number(step.attempt_count ?? 0) + 1 >= Number(step.max_attempts ?? 3) ? "failed" : "queued",
      error: msg.slice(0, 1000),
      heartbeat_at: new Date().toISOString(),
      lease_owner: null,
      lease_expires_at: null,
    }).eq("id", step.id);
    await writeEvent(admin, { jobId: job.id, stepId: step.id, countryCode: job.country_code, eventType: "step.failed", message: msg.slice(0, 500) });
    return { status: "failed", stage: step.stage, error: msg };
  }
}

export async function processOnboardingJobs(admin: any, opts: { countryCode?: string; limit?: number } = {}) {
  const staleCutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  await admin.from("onboarding_jobs").update({ status: "stale", error: "worker reconcile: no heartbeat >15min", finished_at: new Date().toISOString() }).in("status", ["queued", "running"]).lt("updated_at", staleCutoff);
  await admin.from("onboarding_job_steps").update({ status: "stale", error: "worker reconcile: no heartbeat >15min", finished_at: new Date().toISOString() }).eq("status", "running").lt("updated_at", staleCutoff);

  let query = admin.from("onboarding_jobs").select("*").in("status", ["queued", "running"]).order("created_at", { ascending: true }).limit(opts.limit ?? 1);
  if (opts.countryCode) query = query.eq("country_code", opts.countryCode);
  const { data: jobs, error } = await query;
  if (error) throw error;

  const processed: unknown[] = [];
  for (const job of jobs ?? []) {
    const step = await nextRunnableStep(admin, job);
    if (!step) {
      await refreshJobStatus(admin, job.id);
      processed.push({ jobId: job.id, status: "idle" });
      continue;
    }
    const res = await executeStep(admin, job, step);
    await refreshJobStatus(admin, job.id);
    processed.push({ jobId: job.id, ...res });
  }
  return { ok: true, processed };
}