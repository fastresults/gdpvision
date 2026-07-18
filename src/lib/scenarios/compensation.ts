// Pure helper — compares the levered P50 GDP growth path against the
// do-nothing baseline path and derives the "compensation ledger" numbers
// the UI shows in real time while sliders move.

export type Band = { p10: number; p50: number; p90: number };

export type Regime = "at_baseline" | "deficit" | "break_even" | "surplus";

export interface CompensationYear {
  year: number;
  baselineP50: number;
  leveredP50: number;
  deltaPp: number; // levered - baseline
  cumulativePp: number; // running sum of deltaPp
}

export interface CompensationSummary {
  perYear: CompensationYear[];
  cumulativeEndPp: number;
  breakEvenYear: number | null; // first year cumulative >= 0 after any deficit
  regime: Regime;
  /** 0..100 while still in cumulative deficit; null once at or above baseline. */
  gapClosedPct: number | null;
  /** end-of-horizon surplus in cumulative pp (0 if none). */
  surplusEndPp: number;
  /** absolute cumulative shortfall of the baseline vs. zero-delta reference (informational). */
  worstDeficitPp: number;
}

export function computeCompensation(
  baseline: Band[],
  levered: Band[],
  years: number[],
): CompensationSummary {
  const n = Math.min(baseline.length, levered.length, years.length);
  const perYear: CompensationYear[] = [];
  let cum = 0;
  let worst = 0;
  let breakEvenYear: number | null = null;
  let sawDeficit = false;

  for (let i = 0; i < n; i++) {
    const b = baseline[i].p50;
    const l = levered[i].p50;
    const d = l - b;
    cum += d;
    if (cum < worst) worst = cum;
    if (cum < -1e-6) sawDeficit = true;
    if (sawDeficit && breakEvenYear === null && cum >= -1e-6) {
      breakEvenYear = years[i];
    }
    perYear.push({
      year: years[i],
      baselineP50: b,
      leveredP50: l,
      deltaPp: d,
      cumulativePp: cum,
    });
  }

  const cumulativeEndPp = perYear.at(-1)?.cumulativePp ?? 0;
  const allZero = perYear.every((p) => Math.abs(p.deltaPp) < 1e-4);

  let regime: Regime;
  if (allZero) regime = "at_baseline";
  else if (cumulativeEndPp > 0.05) regime = "surplus";
  else if (cumulativeEndPp < -0.05) regime = "deficit";
  else regime = "break_even";

  let gapClosedPct: number | null = null;
  if (regime === "deficit") {
    // How much of the worst-case cumulative shortfall (relative to
    // final baseline aggregate) have the levers offset by end of horizon.
    const worstMag = Math.abs(worst) || Math.abs(cumulativeEndPp) || 1;
    const closed = worstMag + cumulativeEndPp; // cumulativeEndPp is negative
    gapClosedPct = Math.max(0, Math.min(100, (closed / worstMag) * 100));
  }

  return {
    perYear,
    cumulativeEndPp,
    breakEvenYear,
    regime,
    gapClosedPct,
    surplusEndPp: Math.max(0, cumulativeEndPp),
    worstDeficitPp: Math.abs(worst),
  };
}
