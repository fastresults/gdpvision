import type { Json } from "@/integrations/supabase/types";
import { upsertCountrySource } from "@/lib/country-data/sources.server";
import { buildCapitalFlowsDraft } from "@/lib/country-onboarding/capital-flows.server";

type AdminClient = any;

type CapitalFlowPayload = {
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
  }>;
  coverage?: {
    inputs?: string[];
    outputs?: string[];
    applicableInputs?: string[];
    applicableOutputs?: string[];
    missingInputs?: string[];
    missingOutputs?: string[];
    nonApplicableNodes?: Array<{ node_key: string; reason: string }>;
    coverageOk?: boolean;
  };
  reconciliation?: {
    sumIn?: number;
    sumOut?: number;
    residual?: number;
    residual_pct?: number;
  };
};

function isValidHttpUrl(raw: unknown): raw is string {
  if (typeof raw !== "string") return false;
  try {
    const u = new URL(raw.trim());
    return (u.protocol === "http:" || u.protocol === "https:") && u.hostname.includes(".");
  } catch {
    return false;
  }
}

function domainOf(raw: string): string | null {
  try {
    return new URL(raw).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

const FLOW_METHODS = new Set(["reported", "derived", "modelled", "residual"]);

async function dbCount(admin: AdminClient, countryCode: string): Promise<number> {
  const { count, error } = await admin
    .from("country_capital_flows")
    .select("id", { head: true, count: "exact" })
    .eq("country_code", countryCode);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

async function openRun(admin: AdminClient, countryCode: string, userId: string): Promise<string> {
  const { data, error } = await admin
    .from("onboarding_runs")
    .insert({
      country_code: countryCode,
      stage: "capital_flows",
      status: "planning",
      started_by: userId,
      model_stack: { perplexity: "sonar-reasoning-pro", strategy: "acceptance-self-heal-workbook" },
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

async function finishRun(admin: AdminClient, runId: string, patch: Record<string, unknown>) {
  const { error } = await admin
    .from("onboarding_runs")
    .update({ ...patch, finished_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", runId);
  if (error) throw new Error(error.message);
}

async function saveDraft(admin: AdminClient, args: {
  runId: string;
  countryCode: string;
  payload: CapitalFlowPayload;
  confidence: "high" | "medium" | "low";
  citations: Array<{ url: string; title?: string; domain?: string }>;
  summaryMd?: string | null;
  summaryHighlights?: Array<{ label: string; value: string }> | null;
}): Promise<string> {
  const patch = {
    run_id: args.runId,
    country_code: args.countryCode,
    stage: "capital_flows",
    target_table: "country_capital_flows",
    payload: args.payload as unknown as Json,
    confidence: args.confidence,
    needs_review: true,
    summary_md: args.summaryMd ?? null,
    summary_highlights: (args.summaryHighlights ?? []) as unknown as Json,
    updated_at: new Date().toISOString(),
  };
  const { data: existing, error: existingError } = await admin
    .from("onboarding_drafts")
    .select("id")
    .eq("country_code", args.countryCode)
    .eq("stage", "capital_flows")
    .is("committed_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existingError) throw new Error(existingError.message);

  let draftResult = existing?.id
    ? await admin.from("onboarding_drafts").update(patch).eq("id", existing.id).select("id").single()
    : await admin.from("onboarding_drafts").insert(patch).select("id").single();
  if (draftResult.error && draftResult.error.code === "23505") {
    const { data: racedExisting, error: racedExistingError } = await admin
      .from("onboarding_drafts")
      .select("id")
      .eq("country_code", args.countryCode)
      .eq("stage", "capital_flows")
      .is("committed_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (racedExistingError) throw new Error(racedExistingError.message);
    if (racedExisting?.id) {
      draftResult = await admin.from("onboarding_drafts").update(patch).eq("id", racedExisting.id).select("id").single();
    }
  }
  if (draftResult.error) throw new Error(draftResult.error.message);
  const draft = draftResult.data;
  await admin.from("onboarding_citations").delete().eq("draft_id", draft.id);

  const seenCitationUrls = new Set<string>();
  const citationRows = args.citations
    .filter((c) => isValidHttpUrl(c.url))
    .filter((c) => {
      if (seenCitationUrls.has(c.url)) return false;
      seenCitationUrls.add(c.url);
      return true;
    })
    .map((c) => ({ draft_id: draft.id, url: c.url, domain: c.domain ?? domainOf(c.url), title: c.title ?? null }));
  if (citationRows.length) {
    const { error: citeErr } = await admin.from("onboarding_citations").insert(citationRows);
    if (citeErr) throw new Error(citeErr.message);
  }
  return draft.id as string;
}

async function markDraftCommitted(admin: AdminClient, draftId: string, runId: string): Promise<void> {
  const now = new Date().toISOString();
  const draftRes = await admin
    .from("onboarding_drafts")
    .update({ committed_at: now, needs_review: false, updated_at: now })
    .eq("id", draftId);
  if (draftRes.error) throw new Error(draftRes.error.message);
  const runRes = await admin.from("onboarding_runs").update({ status: "committed", updated_at: now }).eq("id", runId);
  if (runRes.error) throw new Error(runRes.error.message);
}

async function commitFlowWorkbook(admin: AdminClient, countryCode: string, userId: string, payload: CapitalFlowPayload, citations: Array<{ url: string; title?: string; domain?: string }>) {
  if (!payload.period || !Array.isArray(payload.flows) || payload.flows.length === 0) {
    throw new Error("Capital-flow workbook has no flows to commit");
  }

  const { data: registry, error: registryError } = await admin.from("capital_flow_nodes").select("node_key");
  if (registryError) throw new Error(registryError.message);
  const validNodeKeys = new Set((registry ?? []).map((r: any) => String(r.node_key)));
  const invalidRows = payload.flows
    .map((f, i) => ({ f, i }))
    .filter(({ f }) => !validNodeKeys.has(f.node_key) || !FLOW_METHODS.has(f.method || "reported") || !Number.isFinite(Number(f.value_usd_m)) || Number(f.value_usd_m) <= 0);
  if (invalidRows.length) {
    throw new Error(`Capital-flow workbook has ${invalidRows.length} invalid row(s): ${invalidRows.map(({ f, i }) => `#${i + 1}:${f.node_key}`).join(", ")}`);
  }

  const validCitations = citations.filter((c) => isValidHttpUrl(c.url));
  const flowSourceCitations = payload.flows
    .filter((f) => isValidHttpUrl(f.source_url))
    .map((f) => ({ url: f.source_url, domain: domainOf(f.source_url), title: f.source_org || "Capital-flow source" }));
  const citationMap = new Map<string, { url: string; title?: string | null; domain?: string | null }>();
  for (const c of [...validCitations, ...flowSourceCitations]) if (!citationMap.has(c.url)) citationMap.set(c.url, c);
  const orderedCitations = [...citationMap.values()];

  const seenSources = new Set<string>();
  for (const f of payload.flows) {
    if (!isValidHttpUrl(f.source_url) || seenSources.has(f.source_url)) continue;
    seenSources.add(f.source_url);
    await upsertCountrySource(admin, {
      country_code: countryCode,
      url: f.source_url,
      title: `${f.source_org || domainOf(f.source_url) || "Auto"} — capital-flow source`,
      org: f.source_org || domainOf(f.source_url) || "Auto",
      kind: "flow_source",
      tags: ["auto", "capital_flow", "acceptance-self-heal"],
      quality_score: f.confidence_grade === "A" ? 5 : f.confidence_grade === "B" ? 4 : 3,
      active: true,
      created_by: userId,
    });
  }

  const clear = await admin.from("country_capital_flows").delete().eq("country_code", countryCode);
  if (clear.error) throw new Error(clear.error.message);

  let upserted = 0;
  for (const f of payload.flows) {
    const period = payload.period || f.period || "unknown";
    const notes = [f.notes ?? null, f.formula ? `Formula: ${f.formula}` : null, f.source_kind ? `Source basis: ${f.source_kind}` : null]
      .filter(Boolean)
      .join("\n") || null;
    const { error } = await admin
      .from("country_capital_flows")
      .upsert(
        {
          country_code: countryCode,
          node_key: f.node_key,
          period,
          value_usd_m: Number(f.value_usd_m),
          method: f.method || "reported",
          confidence_grade: f.confidence_grade || "C",
          provenance: "acceptance-self-heal",
          notes,
          citations: orderedCitations as unknown as Json,
        },
        { onConflict: "country_code,node_key,period" },
      );
    if (error) throw new Error(`commit flow ${f.node_key} failed: ${error.message}`);
    upserted += 1;
  }

  if (upserted === 0) throw new Error("Commit rejected: capital-flow workbook wrote 0 rows");
  return { upserted };
}

export async function researchAndCommitCapitalFlowsForAcceptance(admin: AdminClient, args: {
  countryCode: string;
  userId: string;
}): Promise<{
  runId: string;
  draftId: string;
  before: number;
  after: number;
  upserted: number;
  period: string;
  inputs: number;
  outputs: number;
  residualPct: number;
  attempts: number;
  summary: string;
}> {
  const before = await dbCount(admin, args.countryCode);
  const { data: country, error: countryErr } = await admin
    .from("countries")
    .select("code, name, iso3, currency, gdp_current_usd")
    .eq("code", args.countryCode)
    .maybeSingle();
  if (countryErr || !country) throw new Error(`Country ${args.countryCode} not found`);

  const runId = await openRun(admin, args.countryCode, args.userId);
  let runFinished = false;
  try {
    const workbook = await buildCapitalFlowsDraft({
      admin,
      country,
      runId,
      onProgress: async (plan) => {
        await admin
          .from("onboarding_runs")
          .update({ plan, updated_at: new Date().toISOString() })
          .eq("id", runId);
      },
    });
    const payload = workbook.payload as CapitalFlowPayload;
    const inputs = payload.coverage?.inputs?.length ?? 0;
    const outputs = payload.coverage?.outputs?.length ?? 0;
    const residualPct = Number(payload.reconciliation?.residual_pct ?? workbook.reconciliationPct ?? 1);
    const applicableInputs = payload.coverage?.applicableInputs?.length ?? 6;
    const applicableOutputs = payload.coverage?.applicableOutputs?.length ?? 6;
    const eligible = workbook.coverageOk && inputs >= Math.min(3, applicableInputs) && outputs >= 4;

    const draftId = await saveDraft(admin, {
      runId,
      countryCode: args.countryCode,
      payload,
      confidence: workbook.confidence,
      citations: workbook.citations,
      summaryMd: workbook.summary_md,
      summaryHighlights: workbook.summary_highlights,
    });

    if (!eligible) {
      await finishRun(admin, runId, {
        status: "needs_review",
        error: `Coverage insufficient: ${inputs}/${applicableInputs} inputs, ${outputs}/${applicableOutputs} outputs, ${(residualPct * 100).toFixed(1)}% residual`,
        plan: { coverage: payload.coverage, reconciliation: payload.reconciliation, attempts: workbook.attempts },
      });
      runFinished = true;
      throw new Error(`Capital-flow workbook exhausted without commit eligibility: ${inputs}/${applicableInputs} inputs, ${outputs}/${applicableOutputs} outputs, ${(residualPct * 100).toFixed(1)}% residual`);
    }

    const commit = await commitFlowWorkbook(admin, args.countryCode, args.userId, payload, workbook.citations);
    const after = await dbCount(admin, args.countryCode);
    if (after <= 0) throw new Error("Capital-flow commit verification failed: 0 rows after commit");
    await markDraftCommitted(admin, draftId, runId);
    await finishRun(admin, runId, {
      status: "committed",
      error: null,
      plan: { coverage: payload.coverage, reconciliation: payload.reconciliation, attempts: workbook.attempts },
    });
    runFinished = true;
    return {
      runId,
      draftId,
      before,
      after,
      upserted: commit.upserted,
      period: payload.period,
      inputs,
      outputs,
      residualPct,
      attempts: workbook.attempts,
      summary: `Committed ${commit.upserted} validated flow node(s) for ${payload.period}: ${inputs} inputs, ${outputs} outputs, ${(residualPct * 100).toFixed(1)}% residual`,
    };
  } catch (err) {
    if (!runFinished) {
      try {
        await finishRun(admin, runId, { status: "failed", error: (err as Error).message });
      } catch {
        // Preserve the original failure.
      }
    }
    throw err;
  }
}