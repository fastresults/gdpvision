// Client-side wrapper around the pure v1_macro engine. Lets sliders drive
// the fan chart, stat strip, waterfall and attribution stack in real time —
// no network round-trip. Server `runScenarioEngine` is deterministic against
// the same inputs, so persisted results reconcile exactly.

import { runEngine, type EngineOutput } from "@/lib/engine/v1_macro";
import type { EngineRunResult } from "@/lib/scenarios.functions";

export function runLocalEngine(
  init: EngineRunResult,
  levers: Record<string, number>,
  horizonYears: number,
): EngineRunResult {
  const output: EngineOutput = runEngine({
    baseline: init.baseline,
    horizonYears,
    levers,
    leverDefs: init.leverDefs,
  });
  return { output, baseline: init.baseline, leverDefs: init.leverDefs };
}
