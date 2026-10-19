// @domain indices
// @tables none
// @ui none
//
// Pure, deterministic scoring for the Caribbean Indices (CGX, CHX, CGV, CCX)
// and the Sextant confidence rating. No I/O. The runner gathers inputs, this
// file decides every number, so the same inputs always give the same scores.
// Method: docs/prd/PRD-caribbean-indices.md.
//
// The rules, in plain language:
//   indicator  100 × (x − worst) / (best − worst), clipped to 0–100, on the
//              log scale when the indicator says so. Works for either direction.
//   window     latest value, 5-year mean, 10-year standard deviation, or the
//              distance outside a target band (0 inside it).
//   pillar     weighted mean of its indicator scores, only if at least two-thirds
//              of its indicators with a live source have a valid value; otherwise
//              not scored. Pending-source indicators lower the Sextant instead.
//              External composites are capped at 20% of the index's weight.
//   index      geometric mean of the pillar scores (each floored at 1), only if
//              every pillar is scored. Nothing is imputed or estimated.
//   sextant    availability 30% · timeliness 25% · grade quality 30% · source
//              health 15%, banded Clear / Fair / Hazy / Obscured.

export type Grade = "A" | "B" | "C" | "D";
export type WindowKind = "latest" | "mean5" | "sd10" | "band_distance";

export interface IndicatorSpec {
  code: string;
  pillar_code: string;
  goal_best: number;
  goal_worst: number;
  log_scale: boolean;
  window_kind: WindowKind;
  band_low: number | null;
  band_high: number | null;
  age_tolerance_years: number;
  weight: number;
  status: "active" | "pending_source";
  /** Another publisher's index score (WGI, EGDI, UHC). Capped by external_composite_cap. */
  is_external_composite?: boolean;
}

export interface PillarSpec {
  code: string;
  weight: number;
}

export interface IndexSpec {
  code: string;
  method_version: number;
  aggregation: "geometric" | "arithmetic";
  pillar_coverage_min: number;
  /** Max share of the index's weight from external composites (default 0.2). */
  external_composite_cap?: number;
  pillars: PillarSpec[];
  indicators: IndicatorSpec[];
}

/** One observation of a series: period is a year ('2024'). */
export interface Observation {
  period: string;
  value: number;
}

/** What the runner found for one indicator in one country, before scoring. */
export interface RawInput {
  indicator_code: string;
  observations: Observation[]; // any order; the window picks what it needs
  grade: Grade | null;
  source_ok: boolean;
}

export interface ScoredInput {
  indicator_code: string;
  value_used: number | null;
  period: string | null;
  age_years: number | null;
  score: number | null;
  method: "reported" | "derived" | null;
  grade: Grade | null;
  source_ok: boolean;
  excluded_reason: string | null;
}

export interface CountryResult {
  status: "scored" | "not_scored";
  score: number | null;
  not_scored_reason: string | null;
  pillar_scores: Record<string, number | null>;
  coverage: {
    present: number;
    specified: number;
    by_pillar: Record<string, { present: number; specified: number; live: number }>;
  };
  weakest_grade: Grade | null;
  sextant: number;
  sextant_band: SextantBand;
  sextant_parts: {
    availability: number;
    timeliness: number;
    grade_quality: number;
    source_health: number;
  };
  inputs: ScoredInput[];
}

export type SextantBand = "clear" | "fair" | "hazy" | "obscured";

const GRADE_POINTS: Record<Grade, number> = { A: 100, B: 75, C: 50, D: 25 };
const GRADE_ORDER: Grade[] = ["A", "B", "C", "D"];
export const SEXTANT_WEIGHTS = {
  availability: 0.3,
  timeliness: 0.25,
  grade_quality: 0.3,
  source_health: 0.15,
};

const round = (x: number, dp = 1) => Math.round(x * 10 ** dp) / 10 ** dp;
const yearOf = (p: string) => Number(String(p).slice(0, 4));

export function isGrade(x: unknown): x is Grade {
  return typeof x === "string" && (GRADE_ORDER as string[]).includes(x);
}

/** Observations usable at a cut-off: finite, dated, not after the cut-off year. */
function usable(obs: Observation[], cutoffYear: number): Observation[] {
  return obs
    .filter(
      (o) =>
        Number.isFinite(o.value) &&
        Number.isFinite(yearOf(o.period)) &&
        yearOf(o.period) <= cutoffYear,
    )
    .sort((a, b) => yearOf(b.period) - yearOf(a.period));
}

/** Applies the indicator's window. Returns null when the series is too short. */
export function applyWindow(
  spec: Pick<IndicatorSpec, "window_kind" | "band_low" | "band_high">,
  obs: Observation[],
  cutoffYear: number,
): { value: number; period: string; method: "reported" | "derived" } | null {
  const o = usable(obs, cutoffYear);
  if (!o.length) return null;
  const latest = o[0];
  switch (spec.window_kind) {
    case "latest":
      return { value: latest.value, period: latest.period, method: "reported" };
    case "band_distance": {
      const lo = spec.band_low ?? -Infinity;
      const hi = spec.band_high ?? Infinity;
      const v = latest.value < lo ? lo - latest.value : latest.value > hi ? latest.value - hi : 0;
      return { value: v, period: latest.period, method: "derived" };
    }
    case "mean5":
    case "sd10": {
      const n = spec.window_kind === "mean5" ? 5 : 10;
      const top = yearOf(latest.period);
      const win = o.filter((x) => yearOf(x.period) > top - n);
      // a window needs at least 80% of its years
      if (win.length < Math.ceil(n * 0.8)) return null;
      const mean = win.reduce((s, x) => s + x.value, 0) / win.length;
      if (spec.window_kind === "mean5")
        return { value: mean, period: latest.period, method: "derived" };
      const sd = Math.sqrt(win.reduce((s, x) => s + (x.value - mean) ** 2, 0) / (win.length - 1));
      return { value: sd, period: latest.period, method: "derived" };
    }
  }
}

/** 0–100 against fixed goalposts; direction comes from best vs worst. */
export function scoreValue(
  spec: Pick<IndicatorSpec, "goal_best" | "goal_worst" | "log_scale">,
  x: number,
): number | null {
  let v = x;
  let best = spec.goal_best;
  let worst = spec.goal_worst;
  if (spec.log_scale) {
    if (v <= 0 || best <= 0 || worst <= 0) return null;
    v = Math.log(v);
    best = Math.log(best);
    worst = Math.log(worst);
  }
  if (best === worst) return null;
  const s = (100 * (v - worst)) / (best - worst);
  return round(Math.min(100, Math.max(0, s)), 2);
}

export function sextantBand(s: number): SextantBand {
  if (s >= 80) return "clear";
  if (s >= 60) return "fair";
  if (s >= 40) return "hazy";
  return "obscured";
}

function scoreInput(
  spec: IndicatorSpec,
  raw: RawInput | undefined,
  cutoffYear: number,
): ScoredInput {
  const base: ScoredInput = {
    indicator_code: spec.code,
    value_used: null,
    period: null,
    age_years: null,
    score: null,
    method: null,
    grade: raw?.grade ?? null,
    source_ok: raw?.source_ok ?? true,
    excluded_reason: null,
  };
  if (spec.status === "pending_source") return { ...base, excluded_reason: "pending_source" };
  if (!raw || !raw.observations.length)
    return {
      ...base,
      excluded_reason: raw?.source_ok === false ? "source_unreachable" : "not_collected",
    };
  if (!isGrade(raw.grade)) return { ...base, excluded_reason: "grade_outside_A_D" };
  const w = applyWindow(spec, raw.observations, cutoffYear);
  if (!w) return { ...base, excluded_reason: "series_too_short" };
  const age = cutoffYear - yearOf(w.period);
  if (age > spec.age_tolerance_years) {
    return {
      ...base,
      value_used: w.value,
      period: w.period,
      age_years: age,
      method: w.method,
      excluded_reason: "stale",
    };
  }
  const s = scoreValue(spec, w.value);
  if (s == null)
    return {
      ...base,
      value_used: w.value,
      period: w.period,
      age_years: age,
      method: w.method,
      excluded_reason: "unscorable_value",
    };
  return {
    ...base,
    value_used: w.value,
    period: w.period,
    age_years: age,
    method: w.method,
    score: s,
  };
}

/** Scores one index for one country. Deterministic. */
export function scoreCountry(spec: IndexSpec, raws: RawInput[], cutoffYear: number): CountryResult {
  const byCode = new Map(raws.map((r) => [r.indicator_code, r]));
  const inputs = spec.indicators.map((ind) => scoreInput(ind, byCode.get(ind.code), cutoffYear));
  const scoreOf = new Map(inputs.map((i) => [i.indicator_code, i]));

  const pillar_scores: Record<string, number | null> = {};
  const by_pillar: Record<string, { present: number; specified: number; live: number }> = {};
  const missingPillars: string[] = [];

  // External composites: with equal pillar weights, a pillar's share of the index is
  // weight_p / Σweights, so composites may carry at most cap ÷ that share of a pillar.
  const cap = spec.external_composite_cap ?? 0.2;
  const totalPillarWeight = spec.pillars.reduce((s, p) => s + p.weight, 0);

  for (const p of spec.pillars) {
    const inds = spec.indicators.filter((i) => i.pillar_code === p.code);
    // Coverage is measured against indicators with a live source; pending ones are
    // named in coverage.by_pillar (pending) and lower the Sextant, not the score.
    const live = inds.filter((i) => i.status === "active");
    const scored = live.filter((i) => scoreOf.get(i.code)?.score != null);
    by_pillar[p.code] = { present: scored.length, specified: inds.length, live: live.length };
    // tolerance so "two-thirds" (stored as 0.667) admits 2 of 3
    if (!live.length || scored.length / live.length < spec.pillar_coverage_min - 0.001) {
      pillar_scores[p.code] = null;
      missingPillars.push(p.code);
      continue;
    }
    const maxShare = Math.min(1, cap / (p.weight / totalPillarWeight));
    const comp = scored.filter((i) => i.is_external_composite);
    const own = scored.filter((i) => !i.is_external_composite);
    const wComp = comp.reduce((s, i) => s + i.weight, 0);
    const wOwn = own.reduce((s, i) => s + i.weight, 0);
    let factor = 1;
    if (wComp > 0 && wComp / (wComp + wOwn) > maxShare + 1e-9) {
      if (wOwn === 0) {
        // a pillar made only of other publishers' scores is not our measurement
        pillar_scores[p.code] = null;
        missingPillars.push(p.code);
        continue;
      }
      factor = (maxShare * wOwn) / (wComp * (1 - maxShare));
    }
    const w = (i: IndicatorSpec) => i.weight * (i.is_external_composite ? factor : 1);
    const wsum = scored.reduce((s, i) => s + w(i), 0);
    const v = scored.reduce((s, i) => s + w(i) * (scoreOf.get(i.code)!.score as number), 0) / wsum;
    pillar_scores[p.code] = round(v, 2);
  }

  let score: number | null = null;
  let not_scored_reason: string | null = null;
  if (missingPillars.length) {
    not_scored_reason = `Coverage below ${Math.round(spec.pillar_coverage_min * 100)}% in: ${missingPillars.join(", ")}`;
  } else {
    const ws = spec.pillars.reduce((s, p) => s + p.weight, 0);
    if (spec.aggregation === "geometric") {
      const logSum = spec.pillars.reduce(
        (s, p) => s + p.weight * Math.log(Math.max(1, pillar_scores[p.code] as number)),
        0,
      );
      score = round(Math.exp(logSum / ws), 1);
    } else {
      score = round(
        spec.pillars.reduce((s, p) => s + p.weight * (pillar_scores[p.code] as number), 0) / ws,
        1,
      );
    }
  }

  // Sextant: how well-measured the inputs are, whether or not the index scored.
  const active = spec.indicators.filter((i) => i.status === "active");
  const specified = spec.indicators.length;
  const used = inputs.filter((i) => i.score != null);
  const availability = specified ? (100 * used.length) / specified : 0;
  const tolOf = new Map(spec.indicators.map((i) => [i.code, i.age_tolerance_years]));
  const timeliness = used.length
    ? used.reduce(
        (s, i) =>
          s + 100 * Math.max(0, 1 - (i.age_years ?? 0) / ((tolOf.get(i.indicator_code) ?? 3) + 1)),
        0,
      ) / used.length
    : 0;
  const grade_quality = used.length
    ? used.reduce((s, i) => s + GRADE_POINTS[i.grade as Grade], 0) / used.length
    : 0;
  const attempted = inputs.filter((i) => active.some((a) => a.code === i.indicator_code));
  const source_health = attempted.length
    ? (100 * attempted.filter((i) => i.source_ok).length) / attempted.length
    : 0;
  const sextant = round(
    SEXTANT_WEIGHTS.availability * availability +
      SEXTANT_WEIGHTS.timeliness * timeliness +
      SEXTANT_WEIGHTS.grade_quality * grade_quality +
      SEXTANT_WEIGHTS.source_health * source_health,
    1,
  );

  const grades = used.map((i) => i.grade as Grade);
  const weakest_grade = grades.length
    ? GRADE_ORDER[Math.max(...grades.map((g) => GRADE_ORDER.indexOf(g)))]
    : null;

  return {
    status: score == null ? "not_scored" : "scored",
    score,
    not_scored_reason,
    pillar_scores,
    coverage: { present: used.length, specified, by_pillar },
    weakest_grade,
    sextant,
    sextant_band: sextantBand(sextant),
    sextant_parts: {
      availability: round(availability),
      timeliness: round(timeliness),
      grade_quality: round(grade_quality),
      source_health: round(source_health),
    },
    inputs,
  };
}

/** Standard competition ranking (1, 2, 2, 4) over scored countries; higher is better. */
export function rankScores<T extends { country_code: string; score: number | null }>(
  rows: T[],
): Map<string, number> {
  const scored = rows
    .filter((r) => r.score != null)
    .sort((a, b) => (b.score as number) - (a.score as number));
  const out = new Map<string, number>();
  scored.forEach((r, i) => {
    const prev = scored[i - 1];
    out.set(
      r.country_code,
      prev && prev.score === r.score ? (out.get(prev.country_code) as number) : i + 1,
    );
  });
  return out;
}
