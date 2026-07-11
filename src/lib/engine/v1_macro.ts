// Engine v1 (PRD §7.2). Deterministic macro projection model — pure, versioned,
// invoked from a createServerFn with pinned model_version on every scenario
// artifact. No RNG; identical inputs yield identical outputs.

export const ENGINE_VERSION = "v1_macro" as const;

export interface EngineInput {
  baseline: {
    /** current GDP share by sector_code, in percent (sums to ~100) */
    composition: Record<string, number>;
    /** latest CBI exposure index reading, 0–100. null if not yet computed. */
    exposureIndex: number | null;
  };
  horizonYears: number;
  /** Lever slug → value (must fall within lever bounds; caller enforces). */
  levers: Record<string, number>;
  /** Optional per-lever descriptor so the engine picks the right response fn. */
  leverDefs: Array<{
    slug: string;
    sector_code: string;
    response_fn_ref: string;
    bounds: { min: number; max: number; default?: number };
  }>;
}

export interface EngineOutput {
  model_version: typeof ENGINE_VERSION;
  years: number[];
  gdpGrowthPath: Array<{ p10: number; p50: number; p90: number }>;
  exposurePath: Array<{ p10: number; p50: number; p90: number }> | null;
  sectorImpacts: Array<{
    sector_code: string;
    /** projected share at horizon end, percent */
    share_pct_end: number;
    /** delta vs baseline, percentage points */
    delta_pp: number;
  }>;
  attribution: Array<{ lever_slug: string; contribution_pp: number }>;
}

/** Tiny deterministic response registry — extend as sectors go live. */
const RESPONSES: Record<
  string,
  (value: number, def: EngineInput["leverDefs"][number]) => {
    gdpDelta_pp: number;
    sectorDelta_pp: number;
    exposureDelta_pp: number;
  }
> = {
  "v1_macro.linear_gdp": (v, def) => {
    // centered on default, ±1pp per +/-10% deviation of lever from default
    const d = v - (def.bounds.default ?? 0);
    return { gdpDelta_pp: d * 0.05, sectorDelta_pp: d * 0.15, exposureDelta_pp: 0 };
  },
  "v1_macro.exposure_delta": (v, def) => {
    const d = v - (def.bounds.default ?? 0);
    // CBI inflows raise exposure ~0.9pp per +1pp of budget share
    return { gdpDelta_pp: d * 0.02, sectorDelta_pp: d * 0.08, exposureDelta_pp: d * 0.9 };
  },
  "v1_macro.default": (v, def) => {
    const d = v - (def.bounds.default ?? 0);
    return { gdpDelta_pp: d * 0.02, sectorDelta_pp: d * 0.05, exposureDelta_pp: 0 };
  },
};

export function runEngine(input: EngineInput): EngineOutput {
  const currentYear = new Date().getUTCFullYear();
  const years = Array.from({ length: input.horizonYears }, (_, i) => currentYear + i + 1);

  // Aggregate lever impacts.
  let annualGdpDelta = 0; // percentage points, single-year steady contribution
  let annualExposureDelta = 0;
  const sectorDeltas: Record<string, number> = {};
  const attribution: EngineOutput["attribution"] = [];

  for (const def of input.leverDefs) {
    const value = input.levers[def.slug];
    if (value === undefined) continue;
    const fn = RESPONSES[def.response_fn_ref] ?? RESPONSES["v1_macro.default"];
    const r = fn(value, def);
    annualGdpDelta += r.gdpDelta_pp;
    annualExposureDelta += r.exposureDelta_pp;
    sectorDeltas[def.sector_code] = (sectorDeltas[def.sector_code] ?? 0) + r.sectorDelta_pp;
    attribution.push({ lever_slug: def.slug, contribution_pp: r.gdpDelta_pp });
  }

  // GDP growth path: baseline 2.0% + lever delta, widening bands over time.
  const baselineGrowth = 2.0;
  const gdpGrowthPath = years.map((_, i) => {
    const p50 = baselineGrowth + annualGdpDelta;
    const spread = 0.6 + i * 0.15; // bands widen with horizon
    return { p10: p50 - spread, p50, p90: p50 + spread };
  });

  // Exposure path (only when baseline reading exists).
  const exposurePath = input.baseline.exposureIndex === null
    ? null
    : years.map((_, i) => {
        const p50 = (input.baseline.exposureIndex ?? 0) + annualExposureDelta * (i + 1) / years.length;
        const spread = 1.5 + i * 0.4;
        return { p10: p50 - spread, p50, p90: p50 + spread };
      });

  // Sector projected shares (renormalized).
  const projected: Record<string, number> = {};
  for (const [code, share] of Object.entries(input.baseline.composition)) {
    projected[code] = share + (sectorDeltas[code] ?? 0);
  }
  const total = Object.values(projected).reduce((a, b) => a + b, 0);
  const scale = total > 0 ? 100 / total : 1;
  const sectorImpacts: EngineOutput["sectorImpacts"] = Object.entries(projected).map(
    ([code, share]) => {
      const end = share * scale;
      return {
        sector_code: code,
        share_pct_end: Number(end.toFixed(2)),
        delta_pp: Number((end - (input.baseline.composition[code] ?? 0)).toFixed(2)),
      };
    },
  );

  return {
    model_version: ENGINE_VERSION,
    years,
    gdpGrowthPath,
    exposurePath,
    sectorImpacts,
    attribution,
  };
}
