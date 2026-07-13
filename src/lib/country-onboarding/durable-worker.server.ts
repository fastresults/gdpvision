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
    if (stage === "kpi_seed") {
      const parent = rows.find((s: any) => s.stage === "kpi_seed" && s.step_key === "kpi_seed");
      if (!parent || TERMINAL.includes(parent.status)) continue;
      const children = rows.filter((s: any) => s.stage === "kpi_seed" && s.step_type === "kpi");
      const freshRunningChild = children.find(
        (s: any) => s.status === "running" && s.heartbeat_at && Date.now() - new Date(s.heartbeat_at).getTime() < 15 * 60 * 1000,
      );
      if (freshRunningChild) return null;
      const child = children.find((s: any) => {
        if (TERMINAL.includes(s.status)) return false;
        if (s.status === "running" && s.heartbeat_at && Date.now() - new Date(s.heartbeat_at).getTime() < 15 * 60 * 1000) return false;
        return true;
      });
      if (child) return child;
      if (children.length > 0 && children.every((s: any) => TERMINAL.includes(s.status))) return parent;
      if (parent.status === "running" && parent.heartbeat_at && Date.now() - new Date(parent.heartbeat_at).getTime() < 15 * 60 * 1000) return null;
      return parent;
    }
    const step = rows.find((s: any) => s.stage === stage && s.step_key === stage);
    if (!step) continue;
    if (TERMINAL.includes(step.status)) continue;
    if (step.status === "running" && step.heartbeat_at && Date.now() - new Date(step.heartbeat_at).getTime() < 15 * 60 * 1000) return null;
    return step;
  }
  return null;
}

async function recordKpiAttempt(admin: any, runId: string, countryCode: string, attempt: import("./kpi-research.server").AttemptRecord) {
  await admin.from("kpi_research_attempts").insert({
    run_id: runId,
    country_code: countryCode,
    kpi_code: attempt.kpi_code,
    pass: attempt.pass,
    provider: attempt.provider,
    model: attempt.model ?? null,
    ok: attempt.ok,
    value: attempt.value,
    period: attempt.period,
    source_url: attempt.source_url,
    error: attempt.error,
  });
}

async function expandKpiSeed(admin: any, job: any, parent: any) {
  const { registryFor } = await import("./kpi-registry");
  const registry = registryFor(["all"]);
  const country = await loadCountry(admin, job.country_code);
  const runId = await openLegacyRun(admin, {
    countryCode: job.country_code,
    stage: "kpi_seed",
    userId: job.started_by ?? null,
    modelStack: { durable: "per-kpi", perplexity: "sonar-pro", lovable_ai: "google/gemini-2.5-pro" },
  });
  const children = registry.map((k, order) => ({
    job_id: job.id,
    country_code: job.country_code,
    stage: "kpi_seed",
    step_key: `kpi:${k.kpi_code}`,
    step_type: "kpi",
    status: "queued",
    checkpoint: { order, runId, kpi_code: k.kpi_code, country },
    output: {},
  }));
  const { error } = await admin.from("onboarding_job_steps").upsert(children, { onConflict: "job_id,stage,step_key" });
  if (error) throw error;
  await admin.from("onboarding_job_steps").update({
    status: "running",
    checkpoint: { ...(parent.checkpoint ?? {}), expanded: true, runId, totalKpis: registry.length },
    heartbeat_at: new Date().toISOString(),
  }).eq("id", parent.id);
  return { status: "expanded", stage: "kpi_seed", runId, totalKpis: registry.length };
}

async function executeKpiChild(admin: any, job: any, step: any) {
  const { findRegistryEntry } = await import("./kpi-registry");
  const research = await import("./kpi-research.server");
  const inferMod = await import("./kpi-inference.server");
  const checkpoint = step.checkpoint ?? {};
  const kpiCode = String(checkpoint.kpi_code ?? step.step_key.replace(/^kpi:/, ""));
  const kpi = findRegistryEntry(kpiCode);
  if (!kpi) throw new Error(`Unknown KPI ${kpiCode}`);
  const country = checkpoint.country ?? await loadCountry(admin, job.country_code);
  const runId = String(checkpoint.runId ?? "");
  if (!runId) throw new Error("KPI child missing parent onboarding run id");
  const iso3 = country.iso3 ?? country.code;
  const attempts: import("./kpi-research.server").AttemptRecord[] = [];
  let value: import("./kpi-research.server").ResearchedValue | null = null;
  let inference: import("./kpi-inference.server").InferenceResult | null = null;

  const wb = await research.backfillWorldBank(iso3, kpi);
  attempts.push(wb.attempt);
  await recordKpiAttempt(admin, runId, job.country_code, wb.attempt);
  if (wb.value) value = research.normalizeValue(wb.value);

  if (!value || value.value == null) {
    const imf = await research.backfillImf(iso3, kpi);
    attempts.push(imf.attempt);
    await recordKpiAttempt(admin, runId, job.country_code, imf.attempt);
    if (imf.value) value = research.normalizeValue(imf.value);
  }

  if (!value || value.value == null) {
    const targeted = await research.targetedPerplexity({ country, kpi });
    attempts.push(targeted.attempt);
    await recordKpiAttempt(admin, runId, job.country_code, targeted.attempt);
    if (targeted.value) value = research.normalizeValue(targeted.value);
  }

  if (!value || value.value == null) {
    const gemini = await research.escalateGemini({ country, kpi });
    attempts.push(gemini.attempt);
    await recordKpiAttempt(admin, runId, job.country_code, gemini.attempt);
    if (gemini.value) value = research.normalizeValue(gemini.value);
  }

  if (!value || value.value == null) {
    const inferred = await inferMod.inferOneKpi({ admin, country, kpi });
    inference = inferred.result;
    const attempt = {
      kpi_code: inferred.attempt.kpi_code,
      pass: "escalation" as const,
      provider: "lovable-ai" as const,
      model: inferred.attempt.model,
      ok: inferred.attempt.ok,
      value: inferred.attempt.value,
      period: inferred.attempt.period,
      source_url: inferred.attempt.source_url,
      error: inferred.attempt.error ? `inference: ${inferred.attempt.error}` : null,
    };
    attempts.push(attempt);
    await recordKpiAttempt(admin, runId, job.country_code, attempt);
    if (inferred.result) {
      value = {
        kpi_code: inferred.result.kpi_code,
        value: inferred.result.value,
        period: inferred.result.period,
        source_url: inferred.result.source_url,
        source_org: inferred.result.source_org,
        notes: `Inferred (${inferred.result.confidence}) via ${inferred.result.model}`,
      };
    }
  }

  const output = {
    kpi_code: kpi.kpi_code,
    value: value?.value ?? null,
    period: value?.period ?? null,
    source_url: value?.source_url ?? null,
    source_org: value?.source_org ?? null,
    notes: value?.notes ?? "not found after durable per-KPI research",
    inference,
    attempts: attempts.length,
    ok: value?.value != null,
  };
  await admin.from("onboarding_job_steps").update({
    status: "completed",
    output: output as any,
    finished_at: new Date().toISOString(),
    heartbeat_at: new Date().toISOString(),
  }).eq("id", step.id);
  return { status: "completed", stage: "kpi_seed", kpi: kpi.kpi_code, ok: output.ok };
}

async function finalizeKpiSeed(admin: any, job: any, parent: any) {
  const { data: children } = await admin
    .from("onboarding_job_steps")
    .select("output, status")
    .eq("job_id", job.id)
    .eq("stage", "kpi_seed")
    .eq("step_type", "kpi");
  const rows = children ?? [];
  if (!rows.length || !rows.every((s: any) => TERMINAL.includes(s.status))) return expandKpiSeed(admin, job, parent);
  const runId = String(parent.checkpoint?.runId ?? rows[0]?.output?.runId ?? "");
  if (!runId) throw new Error("KPI parent missing run id for finalization");
  const { finalizeKpiSeedOutputs } = await import("./kpi-seed.server");
  const res = await finalizeKpiSeedOutputs({
    admin,
    runId,
    countryCode: job.country_code,
    userId: job.started_by ?? null,
    outputs: rows.map((r: any) => r.output).filter(Boolean),
    autoCommit: true,
  });
  await admin.from("onboarding_job_steps").update({
    status: "completed",
    output: res as any,
    finished_at: new Date().toISOString(),
    heartbeat_at: new Date().toISOString(),
  }).eq("id", parent.id);
  return { status: "completed", stage: "kpi_seed", res };
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

    if (step.stage === "kpi_seed" && step.step_type === "kpi") {
      return await executeKpiChild(admin, job, step);
    }

    if (step.stage === "kpi_seed") {
      const { count } = await admin
        .from("onboarding_job_steps")
        .select("id", { count: "exact", head: true })
        .eq("job_id", job.id)
        .eq("stage", "kpi_seed")
        .eq("step_type", "kpi");
      if (!count) return await expandKpiSeed(admin, job, step);
      return await finalizeKpiSeed(admin, job, step);
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