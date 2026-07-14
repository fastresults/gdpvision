import type { SonarCitation } from "./perplexity.server";

export type KpiSeedCountry = { code: string; name: string; iso3: string | null };

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

async function updateRunPlan(admin: any, runId: string | null, plan: Record<string, unknown>) {
  if (!runId) return;
  try {
    await admin.from("onboarding_runs").update({ plan, updated_at: new Date().toISOString() }).eq("id", runId);
  } catch {
    /* heartbeat/progress is best-effort */
  }
}

async function finishRun(admin: any, runId: string, patch: Record<string, unknown>) {
  await admin
    .from("onboarding_runs")
    .update({ ...patch, finished_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", runId);
}

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
  try {
    await admin.from("kpi_research_attempts").insert(rows);
  } catch (err) {
    console.error("[kpi_seed] attempt logging failed", err);
  }
}

async function saveDraft(admin: any, args: {
  run_id: string;
  country_code: string;
  payload: unknown;
  confidence: "high" | "medium" | "low";
  citations: SonarCitation[];
}) {
  // Keep older uncommitted drafts as rollback evidence. The UI marks older
  // drafts superseded, so a bad rerun cannot erase the last reviewable draft.
  const { data: draft, error } = await admin
    .from("onboarding_drafts")
    .insert({
      run_id: args.run_id,
      country_code: args.country_code,
      stage: "kpi_seed",
      target_table: "country_kpis",
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

async function attachOrCreateSource(
  admin: any,
  countryCode: string,
  sourceUrl: string | null,
  sourceOrg: string | null,
  userId: string | null,
): Promise<string | null> {
  if (!sourceUrl) return null;
  const { upsertCountrySource, resolveKpiProvider, hostOf } = await import("@/lib/country-data/sources.server");
  const canon = resolveKpiProvider(countryCode, sourceUrl);
  const org = canon?.org ?? sourceOrg ?? hostOf(sourceUrl) ?? "Auto";
  const qualityByOrg: Record<string, number> = {
    "World Bank": 5,
    "IMF WEO": 5,
    IMF: 5,
    UN: 5,
    UNDP: 5,
    WHO: 5,
    ILO: 5,
    OECS: 4,
    CDB: 4,
    ECCB: 4,
    CARICOM: 4,
  };
  const res = await upsertCountrySource(admin, {
    country_code: countryCode,
    url: sourceUrl,
    title: canon?.title ?? `${org} — KPI source`,
    org,
    kind: "kpi_source",
    tags: ["auto", "kpi"],
    quality_score: canon?.quality ?? qualityByOrg[org] ?? 3,
    active: true,
    created_by: userId,
  });
  return res?.id ?? null;
}

async function upsertResolvedKpi(
  admin: any,
  countryCode: string,
  userId: string | null,
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
  const source_id = await attachOrCreateSource(admin, countryCode, k.source_url, k.source_org, userId);
  const isInferred = !!k.inference && k.latest_value != null;
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
    freshness_status: k.latest_value == null ? "missing" : "fresh",
    last_verified_at: new Date().toISOString(),
    research_notes: k.notes ?? null,
    provenance: isInferred ? "inferred" : "verified",
  };
  if (isInferred && k.inference) {
    row.confidence = k.inference.confidence;
    row.inference_rationale = k.inference.rationale;
    row.inference_evidence = { assumptions: k.inference.assumptions, evidence: k.inference.evidence };
    row.inference_model = k.inference.model;
    row.inferred_at = new Date().toISOString();
    row.verified_by = null;
    row.verified_at = null;
    row.admin_note = null;
  } else {
    row.confidence = null;
    row.inference_rationale = null;
    row.inference_evidence = null;
    row.inference_model = null;
    row.inferred_at = null;
  }
  const { error } = await admin.from("country_kpis").upsert(row, { onConflict: "country_code,kpi_code" });
  return { ok: !error, error: error?.message ?? null, source_id };
}

async function markDraftCommitted(admin: any, draftId: string, runId: string) {
  await admin.from("onboarding_drafts").update({ committed_at: new Date().toISOString(), needs_review: false }).eq("id", draftId);
  await admin.from("onboarding_runs").update({ status: "committed", updated_at: new Date().toISOString() }).eq("id", runId);
  await admin.from("audit_log").insert({ action: "onboarding.commit", target_type: "draft", target_id: draftId });
}

export async function runKpiSeedResearch(args: {
  admin: any;
  runId: string;
  country: KpiSeedCountry;
  userId?: string | null;
  runInference?: boolean;
  autoCommit?: boolean;
  onProgress?: (plan: Record<string, unknown>) => Promise<void>;
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
    const plan = {
      kind: "kpi_seed_progress",
      ...progress,
      filled: coverageNow.filled,
      missing: coverageNow.missing.length,
      missingKpis: coverageNow.missing,
      updatedAt: new Date().toISOString(),
    };
    await updateRunPlan(args.admin, args.runId, plan);
    await args.onProgress?.(plan);
  };

  const persistAttempts = async (attempts: Array<import("./kpi-research.server").AttemptRecord>) => {
    if (!attempts.length) return;
    allAttempts.push(...attempts);
    progress.okCount += attempts.filter((a) => a.ok).length;
    progress.failCount += attempts.filter((a) => !a.ok).length;
    await recordAttempts(args.admin, args.runId, args.country.code, attempts);
  };

  await writeProgress({ phase: "sweep", processed: 0, total: registry.length });

  const sweep = await research.sweepPerplexity({ country: args.country, registry });
  for (const v of sweep.values) research.mergeInto(values, research.normalizeValue(v));
  await persistAttempts(sweep.attempts);
  await writeProgress({ phase: "worldbank", processed: 0, total: registry.length, currentKpi: null });

  const missingAfterA = registry.filter((k) => !values.get(k.kpi_code) || values.get(k.kpi_code)!.value == null);
  const iso3 = args.country.iso3 ?? args.country.code;
  for (let i = 0; i < missingAfterA.length; i++) {
    const k = missingAfterA[i];
    await writeProgress({ phase: "worldbank", processed: i, total: missingAfterA.length, currentKpi: k.kpi_code });
    const { value, attempt } = await research.backfillWorldBank(iso3, k);
    await persistAttempts([attempt]);
    if (value) research.mergeInto(values, research.normalizeValue(value));
  }

  const missingAfterB = registry.filter((k) => !values.get(k.kpi_code) || values.get(k.kpi_code)!.value == null);
  for (let i = 0; i < missingAfterB.length; i++) {
    const k = missingAfterB[i];
    await writeProgress({ phase: "imf", processed: i, total: missingAfterB.length, currentKpi: k.kpi_code });
    const { value, attempt } = await research.backfillImf(iso3, k);
    await persistAttempts([attempt]);
    if (value) research.mergeInto(values, research.normalizeValue(value));
  }

  const missingAfterC = registry.filter((k) => !values.get(k.kpi_code) || values.get(k.kpi_code)!.value == null);
  for (let i = 0; i < missingAfterC.length; i++) {
    const k = missingAfterC[i];
    await writeProgress({ phase: "targeted", processed: i, total: missingAfterC.length, currentKpi: k.kpi_code });
    const { value, attempt } = await research.targetedPerplexity({ country: args.country, kpi: k });
    await persistAttempts([attempt]);
    if (value) research.mergeInto(values, research.normalizeValue(value));
  }

  const missingAfterD = registry.filter((k) => !values.get(k.kpi_code) || values.get(k.kpi_code)!.value == null);
  for (let i = 0; i < missingAfterD.length; i++) {
    const k = missingAfterD[i];
    await writeProgress({ phase: "escalation", processed: i, total: missingAfterD.length, currentKpi: k.kpi_code });
    const { value, attempt } = await research.escalateGemini({ country: args.country, kpi: k });
    await persistAttempts([attempt]);
    if (value) research.mergeInto(values, research.normalizeValue(value));
  }

  const inferred = new Map<string, import("./kpi-inference.server").InferenceResult>();
  if (args.runInference !== false) {
    const inferMod = await import("./kpi-inference.server");
    const missingAfterE = registry.filter((k) => !values.get(k.kpi_code) || values.get(k.kpi_code)!.value == null);
    for (let i = 0; i < missingAfterE.length; i++) {
      const k = missingAfterE[i];
      await writeProgress({ phase: "inference", processed: i, total: missingAfterE.length, currentKpi: k.kpi_code });
      const { result, attempt } = await inferMod.inferOneKpi({ admin: args.admin, country: args.country, kpi: k });
      await persistAttempts([{
        kpi_code: attempt.kpi_code,
        pass: "escalation",
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
  void findRegistryEntry;

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

  const seenCite = new Set<string>();
  const citations: SonarCitation[] = [];
  for (const k of enriched) {
    const url = k.source_url;
    if (!url || seenCite.has(url)) continue;
    seenCite.add(url);
    let domain: string | undefined;
    try { domain = new URL(url).hostname.replace(/^www\./, ""); } catch { /* ignore */ }
    citations.push({ url, domain, title: k.source_org ?? undefined });
  }

  const payload = { kpis: enriched, coverage };
  const draftId = await saveDraft(args.admin, {
    run_id: args.runId,
    country_code: args.country.code,
    payload,
    confidence: coverage.filled === coverage.total ? "high" : coverage.filled >= coverage.total * 0.75 ? "medium" : "low",
    citations,
  });

  let upserted = 0;
  if (args.autoCommit) {
    for (const k of enriched) {
      const { ok } = await upsertResolvedKpi(args.admin, args.country.code, args.userId ?? null, k);
      if (ok) upserted++;
    }
    if (upserted === 0) {
      throw new Error("Auto-commit rejected: KPI seed wrote 0 target rows. Draft remains open.");
    }
    await markDraftCommitted(args.admin, draftId, args.runId);
  }

  await finishRun(args.admin, args.runId, {
    status: args.autoCommit ? "committed" : "ready",
    plan: {
      kind: "kpi_seed_progress",
      phase: args.autoCommit ? "committed" : "ready",
      processed: enriched.length,
      total: enriched.length,
      okCount: allAttempts.filter((a) => a.ok).length,
      failCount: allAttempts.filter((a) => !a.ok).length,
      filled: coverage.filled,
      missing: coverage.missing.length,
      missingKpis: coverage.missing,
      updatedAt: new Date().toISOString(),
    },
    error:
      coverage.filled < coverage.total
        ? `partial: ${coverage.filled}/${coverage.total} required (missing: ${coverage.missing.join(", ")})`
        : null,
  });

  return { runId: args.runId, draftId, count: enriched.length, coverage, attempts: allAttempts.length, committed: !!args.autoCommit, upserted };
}

export async function finalizeKpiSeedOutputs(args: {
  admin: any;
  runId: string;
  countryCode: string;
  userId?: string | null;
  outputs: Array<{
    kpi_code: string;
    value: number | null;
    period: string | null;
    source_url: string | null;
    source_org: string | null;
    notes: string;
    inference?: import("./kpi-inference.server").InferenceResult | null;
  }>;
  autoCommit?: boolean;
}) {
  const { registryFor } = await import("./kpi-registry");
  const research = await import("./kpi-research.server");
  const registry = registryFor(["all"]);
  const values = new Map<string, import("./kpi-research.server").ResearchedValue>();
  const inferred = new Map<string, import("./kpi-inference.server").InferenceResult>();
  for (const output of args.outputs) {
    values.set(output.kpi_code, {
      kpi_code: output.kpi_code,
      value: output.value,
      period: output.period,
      source_url: output.source_url,
      source_org: output.source_org,
      notes: output.notes,
    });
    if (output.inference) inferred.set(output.kpi_code, output.inference);
  }
  for (const k of registry) {
    if (!values.has(k.kpi_code)) {
      values.set(k.kpi_code, {
        kpi_code: k.kpi_code,
        value: null,
        period: null,
        source_url: null,
        source_org: null,
        notes: "not found after durable per-KPI research",
      });
    }
  }
  const coverage = research.coverageOf(registry, values);
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
  const seenCite = new Set<string>();
  const citations: SonarCitation[] = [];
  for (const k of enriched) {
    const url = k.source_url;
    if (!url || seenCite.has(url)) continue;
    seenCite.add(url);
    let domain: string | undefined;
    try { domain = new URL(url).hostname.replace(/^www\./, ""); } catch { /* ignore */ }
    citations.push({ url, domain, title: k.source_org ?? undefined });
  }
  const draftId = await saveDraft(args.admin, {
    run_id: args.runId,
    country_code: args.countryCode,
    payload: { kpis: enriched, coverage },
    confidence: coverage.filled === coverage.total ? "high" : coverage.filled >= coverage.total * 0.75 ? "medium" : "low",
    citations,
  });
  let upserted = 0;
  if (args.autoCommit) {
    for (const k of enriched) {
      const { ok } = await upsertResolvedKpi(args.admin, args.countryCode, args.userId ?? null, k);
      if (ok) upserted++;
    }
    if (upserted === 0) {
      throw new Error("Auto-commit rejected: KPI seed wrote 0 target rows. Draft remains open.");
    }
    await markDraftCommitted(args.admin, draftId, args.runId);
  }
  await finishRun(args.admin, args.runId, {
    status: args.autoCommit ? "committed" : "ready",
    plan: {
      kind: "kpi_seed_progress",
      phase: args.autoCommit ? "committed" : "ready",
      processed: enriched.length,
      total: enriched.length,
      filled: coverage.filled,
      missing: coverage.missing.length,
      missingKpis: coverage.missing,
      updatedAt: new Date().toISOString(),
    },
    error:
      coverage.filled < coverage.total
        ? `partial: ${coverage.filled}/${coverage.total} required (missing: ${coverage.missing.join(", ")})`
        : null,
  });
  return { draftId, count: enriched.length, coverage, committed: !!args.autoCommit, upserted };
}