// @domain indices
// @tables none
// @ui none
//
// TEST DATA for test runs only (mode "test"), so every index can be scored and
// reviewed on GDP Advisor's preview before the real sources and evidence exist.
// Never used by watch, tracker or edition runs; a test release can never be
// published (database CHECK), and every value made here is stored with
// origin = 'test_fixture' and grade D.
//
// Values are deterministic: derived from each indicator's own goalposts and a
// hash of index · indicator · country, so the same test run gives the same
// picture and countries differ. Pure, no I/O.

import {
  scoreCountry,
  type CountryResult,
  type IndexSpec,
  type IndicatorSpec,
  type Observation,
  type RawInput,
} from "./scoring";

/** FNV-1a → [0, 1). */
export function unitHash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) / 0x1_0000_0000;
}

/** The value of the indicator's window that a fixture aims for: 20–85% of the way from worst to best. */
export function fixtureTarget(
  ind: Pick<IndicatorSpec, "goal_best" | "goal_worst" | "log_scale">,
  key: string,
): number {
  const q = 0.2 + 0.65 * unitHash(key);
  if (ind.log_scale && ind.goal_best > 0 && ind.goal_worst > 0) {
    const lb = Math.log(ind.goal_best);
    const lw = Math.log(ind.goal_worst);
    return Math.exp(lw + (lb - lw) * q);
  }
  return ind.goal_worst + (ind.goal_best - ind.goal_worst) * q;
}

/** Eleven yearly observations (cut-off − 11 … cut-off − 1) whose window equals the target. */
export function fixtureObservations(
  ind: Pick<
    IndicatorSpec,
    "goal_best" | "goal_worst" | "log_scale" | "window_kind" | "band_low" | "band_high"
  >,
  key: string,
  cutoffYear: number,
): Observation[] {
  const target = fixtureTarget(ind, key);
  const years = Array.from({ length: 11 }, (_, i) => cutoffYear - 11 + i);
  switch (ind.window_kind) {
    case "sd10": {
      // alternating ±a around a level gives a sample SD of a·√(n/(n−1)) over n years
      const n = 10;
      const a = Math.max(0, target) * Math.sqrt((n - 1) / n);
      return years.map((y, i) => ({ period: String(y), value: 3 + (i % 2 ? a : -a) }));
    }
    case "band_distance": {
      // distance outside the band: above it when there is an upper bound, else below the lower one
      const d = Math.max(0, target);
      const v =
        ind.band_high != null ? ind.band_high + d : ind.band_low != null ? ind.band_low - d : d;
      return years.map((y) => ({ period: String(y), value: v }));
    }
    default:
      // latest / mean5: a flat series at the target
      return years.map((y) => ({ period: String(y), value: target }));
  }
}

/** Reasons a test run fills with a fixture: anything that left the input without a usable value. */
export const FILLABLE = new Set([
  "pending_source",
  "not_collected",
  "source_unreachable",
  "stale",
  "series_too_short",
  "grade_outside_A_D",
  "unscorable_value",
]);

/** Every indicator treated as live, so parked and pending-source measures are scored in a test run. */
export function testSpec(spec: IndexSpec): IndexSpec {
  return { ...spec, indicators: spec.indicators.map((i) => ({ ...i, status: "active" as const })) };
}

/**
 * Score one country for a test run: real (or snapshot) inputs where they score, a fixture
 * wherever an input is missing or excluded. Returns the result and the fixture-filled codes.
 */
export function scoreForTest(
  spec: IndexSpec,
  raws: RawInput[],
  country: string,
  cutoffYear: number,
): { result: CountryResult; raws: RawInput[]; fixtures: Set<string> } {
  const s = testSpec(spec);
  const first = scoreCountry(s, raws, cutoffYear);
  const fixtures = new Set(
    first.inputs
      .filter((i) => i.excluded_reason && FILLABLE.has(i.excluded_reason))
      .map((i) => i.indicator_code),
  );
  if (!fixtures.size) return { result: first, raws, fixtures };
  const byCode = new Map(s.indicators.map((i) => [i.code, i]));
  const filled = s.indicators.map((ind) => {
    const raw = raws.find((r) => r.indicator_code === ind.code);
    if (!fixtures.has(ind.code))
      return raw ?? { indicator_code: ind.code, observations: [], grade: null, source_ok: true };
    return {
      indicator_code: ind.code,
      observations: fixtureObservations(
        byCode.get(ind.code)!,
        `${spec.code}.${ind.code}.${country}`,
        cutoffYear,
      ),
      grade: "D" as const,
      source_ok: true,
    };
  });
  return { result: scoreCountry(s, filled, cutoffYear), raws: filled, fixtures };
}
