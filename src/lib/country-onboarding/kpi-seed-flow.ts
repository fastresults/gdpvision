// Client-side driver for stage 7 (KPI seed).
//
// This mirrors the durable stage 9 ministry-deep-dive flow: each request does
// one bounded unit of work, progress is stored in the database, and transient
// browser/proxy failures are retried without restarting the whole research run.

import {
  finalizeKpiSeedRun,
  planKpiSeed,
  resolveNextKpiSeedItem,
  runKpiSeedSweep,
} from "./corpus.functions";

export type KpiSeedProgress = {
  runId: string;
  phase?: string;
  processed: number;
  total: number;
  currentKpi: string | null;
  filled?: number;
  missing?: number;
  missingKpis?: string[];
};

export type KpiSeedResult = Awaited<ReturnType<typeof finalizeKpiSeedRun>>;

const TRANSIENT_PATTERNS = [
  "failed to fetch",
  "internal server error",
  "sandbox proxy failed",
  "networkerror",
  "network error",
  "load failed",
  "fetch failed",
  "socket hang up",
  "econnreset",
  "etimedout",
  "aborted",
  "the operation was aborted",
  "502",
  "503",
  "504",
  "gateway timeout",
  "bad gateway",
  "service unavailable",
];

function isTransient(err: unknown): boolean {
  if (!err) return false;
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  if (err instanceof TypeError) return true;
  return TRANSIENT_PATTERNS.some((p) => msg.includes(p));
}

async function withRetry<T>(
  label: string,
  fn: () => Promise<T>,
  opts: { retries?: number; baseDelayMs?: number; signal?: AbortSignal } = {},
): Promise<T> {
  const retries = opts.retries ?? 4;
  const base = opts.baseDelayMs ?? 1500;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (opts.signal?.aborted) throw new Error(`${label} aborted`);
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt === retries || !isTransient(err)) throw err;
      const delay = base * Math.pow(2, attempt) + Math.random() * 500;
      // eslint-disable-next-line no-console
      console.warn(
        `[kpi-seed] ${label} transient failure (attempt ${attempt + 1}/${retries + 1}), retrying in ${Math.round(delay)}ms`,
        err,
      );
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

function emitProgress(
  runId: string,
  rawPlan: any,
  onProgress?: (p: KpiSeedProgress) => void,
) {
  const plan = rawPlan ?? {};
  onProgress?.({
    runId,
    phase: plan.phase,
    processed: Number(plan.processed ?? 0),
    total: Number(plan.total ?? 0),
    currentKpi: plan.currentKpi ?? null,
    filled: typeof plan.filled === "number" ? plan.filled : undefined,
    missing: typeof plan.missing === "number" ? plan.missing : undefined,
    missingKpis: Array.isArray(plan.missingKpis) ? plan.missingKpis : undefined,
  });
}

export async function runKpiSeedFlow(
  countryCode: string,
  opts?: {
    onProgress?: (p: KpiSeedProgress) => void;
    signal?: AbortSignal;
    maxIterations?: number;
  },
): Promise<KpiSeedResult> {
  const planned = await withRetry(
    "plan",
    () => planKpiSeed({ data: { countryCode } }),
    { signal: opts?.signal },
  );
  const runId = planned.runId;
  emitProgress(runId, (planned as any).plan, opts?.onProgress);

  const swept = await withRetry(
    "sweep",
    () => runKpiSeedSweep({ data: { runId } }),
    { signal: opts?.signal, retries: 5, baseDelayMs: 2500 },
  );
  emitProgress(runId, (swept as any).plan, opts?.onProgress);

  const cap = opts?.maxIterations ?? Math.max(Number(planned.total ?? 18) * 8, 80);
  let iterations = 0;
  let lastRemaining = Number((swept as any).remaining ?? planned.total ?? 0);
  let stuckRounds = 0;

  while (iterations < cap) {
    if (opts?.signal?.aborted) throw new Error("KPI seed aborted");
    iterations++;
    const step = await withRetry(
      `resolve #${iterations}`,
      () => resolveNextKpiSeedItem({ data: { runId } }),
      { signal: opts?.signal, retries: 5, baseDelayMs: 2500 },
    );
    emitProgress(runId, (step as any).plan, opts?.onProgress);
    const remaining = Number((step as any).remaining ?? 0);
    if (remaining <= 0) break;

    if (remaining >= lastRemaining) {
      stuckRounds++;
      if (stuckRounds >= 300) {
        throw new Error(
          `KPI seed stuck: ${remaining} item(s) still pending (last KPI: ${(step as any).currentKpi ?? "n/a"})`,
        );
      }
      await new Promise((r) => setTimeout(r, 1500));
    } else {
      stuckRounds = 0;
      lastRemaining = remaining;
    }
  }

  if (iterations >= cap) {
    throw new Error(`KPI seed did not finish within ${cap} iterations for ${countryCode}`);
  }

  return await withRetry(
    "finalize",
    () => finalizeKpiSeedRun({ data: { runId } }),
    { signal: opts?.signal },
  );
}