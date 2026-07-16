// Client-side driver for stage 9 (ministry deep-dive).
//
// The old single-call `runMinistryDeepDiveAgent` server function did all
// Perplexity work (~3-4 slow API calls × N ministries) inside one request,
// which reliably hit the sandbox proxy timeout on countries with many
// ministries. The stage is now split into three short server functions:
//
//   planMinistryDeepDive        — opens run + seeds one row per ministry.
//   resolveNextMinistryDeepDive — resolves ONE pending ministry per call.
//   finalizeMinistryDeepDive    — assembles the draft from the item rows.
//
// This helper drives the loop from the browser (fresh request per ministry),
// so no single request ever exceeds the sandbox timeout and progress is
// visible per-ministry. It preserves the original return shape so existing
// UI code (onboarding wizard, country-data page) doesn't need to change.

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

/**
 * Runs the full stage-9 flow client-driven.
 *
 * Each `resolveNext` call is its own HTTP request, so individual Perplexity
 * work always fits comfortably under the sandbox timeout. `onProgress` fires
 * after every ministry so callers can update UI.
 */
export async function runMinistryDeepDiveFlow(
  countryCode: string,
  opts?: {
    onProgress?: (p: MinistryDeepDiveProgress) => void;
    signal?: AbortSignal;
    maxIterations?: number;
  },
): Promise<MinistryDeepDiveResult> {
  const { runId, total } = await planMinistryDeepDive({
    data: { countryCode },
  });

  const cap = opts?.maxIterations ?? Math.max(total * 2, 30);
  let iterations = 0;
  let processed = 0;

  // Emit an initial progress tick so the UI shows the plan immediately.
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
    const step = await resolveNextMinistryDeepDive({ data: { runId } });
    processed = Math.max(processed, (step.total ?? total) - step.remaining);
    opts?.onProgress?.({
      runId,
      processed,
      total: step.total ?? total,
      ministry_slug: step.ministry_slug,
      minister: step.minister,
    });
    if (step.remaining <= 0) break;
  }

  if (iterations >= cap) {
    throw new Error(
      `Ministry deep-dive did not finish within ${cap} iterations for ${countryCode}`,
    );
  }

  return await finalizeMinistryDeepDive({ data: { runId } });
}
