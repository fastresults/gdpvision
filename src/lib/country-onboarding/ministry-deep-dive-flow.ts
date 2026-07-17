// Client-side driver for stage 9 (ministry deep-dive).
//
// Split server flow:
//   planMinistryDeepDive        — opens run + seeds one row per ministry.
//   resolveNextMinistryDeepDive — resolves ONE pending ministry per call.
//   finalizeMinistryDeepDive    — assembles the draft from the item rows.
//
// Each call is its own HTTP request so no single request exceeds the sandbox
// proxy timeout. Because Perplexity, edge-runtime cold starts, and the
// sandbox proxy occasionally drop a connection (surfaces as browser
// `TypeError: Failed to fetch`), every call is wrapped in a
// retry-with-backoff. `resolveNext` is server-idempotent — it picks the next
// pending item — so a retry safely re-attempts the same ministry.

import {
  planMinistryDeepDive,
  resolveNextMinistryDeepDive,
  finalizeMinistryDeepDive,
} from "./corpus.functions";

export type MinistryDeepDiveProgress = {
  runId: string;
  processed: number;
  total: number;
  ministry_slug: string | null;
  minister: string | null;
};

export type MinistryDeepDiveResult = Awaited<
  ReturnType<typeof finalizeMinistryDeepDive>
>;

const TRANSIENT_PATTERNS = [
  "failed to fetch",
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
  // TypeError from window.fetch on network drop is the classic "Failed to fetch".
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
      if (attempt === retries || !isTransient(err)) {
        throw err;
      }
      const delay = base * Math.pow(2, attempt) + Math.random() * 500;
      // eslint-disable-next-line no-console
      console.warn(
        `[ministry-deep-dive] ${label} transient failure (attempt ${attempt + 1}/${retries + 1}), retrying in ${Math.round(delay)}ms`,
        err,
      );
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

export async function runMinistryDeepDiveFlow(
  countryCode: string,
  opts?: {
    onProgress?: (p: MinistryDeepDiveProgress) => void;
    signal?: AbortSignal;
    maxIterations?: number;
  },
): Promise<MinistryDeepDiveResult> {
  const { runId, total } = await withRetry(
    "plan",
    () => planMinistryDeepDive({ data: { countryCode } }),
    { signal: opts?.signal },
  );

  const cap = opts?.maxIterations ?? Math.max(total * 3, 40);
  let iterations = 0;
  let processed = 0;
  let lastRemaining = total;
  let stuckRounds = 0;

  opts?.onProgress?.({
    runId,
    processed: 0,
    total,
    ministry_slug: null,
    minister: null,
  });

  while (iterations < cap) {
    if (opts?.signal?.aborted) throw new Error("Ministry deep-dive aborted");
    iterations++;
    const step = await withRetry(
      `resolve #${iterations}`,
      () => resolveNextMinistryDeepDive({ data: { runId } }),
      { signal: opts?.signal, retries: 5, baseDelayMs: 2000 },
    );
    processed = Math.max(processed, (step.total ?? total) - step.remaining);
    opts?.onProgress?.({
      runId,
      processed,
      total: step.total ?? total,
      ministry_slug: step.ministry_slug,
      minister: step.minister,
    });
    if (step.remaining <= 0) break;

    // Safety: if remaining hasn't dropped for several rounds, bail loudly.
    if (step.remaining >= lastRemaining) {
      stuckRounds++;
      if (stuckRounds >= 5) {
        throw new Error(
          `Ministry deep-dive stuck: ${step.remaining} items remaining and not progressing (last slug: ${step.ministry_slug ?? "n/a"})`,
        );
      }
    } else {
      stuckRounds = 0;
      lastRemaining = step.remaining;
    }
  }

  if (iterations >= cap) {
    throw new Error(
      `Ministry deep-dive did not finish within ${cap} iterations for ${countryCode}`,
    );
  }

  return await withRetry(
    "finalize",
    () => finalizeMinistryDeepDive({ data: { runId } }),
    { signal: opts?.signal },
  );
}
