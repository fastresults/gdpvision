// @domain marketing
// @tables none
// @ui src/components/calculator/ValueCalculator.tsx
//
// The Sovereign Value Instrument — deterministic value model, v1_value.
// Pure, versioned, no RNG, no I/O. Identical inputs yield identical outputs,
// and every figure the UI shows can be traced back through `trace`.
//
// The discipline mirrors src/lib/engine/v1_macro.ts: coefficients are stated,
// bounded, and capped. An over-claiming calculator destroys the argument of
// the paper it sits beside, so the ceiling matters more than the coefficients.

export const VALUE_MODEL_VERSION = "v1_value" as const;

export type Stance = "conservative" | "central" | "optimistic";

export const STANCE_MULTIPLIER: Record<Stance, number> = {
  conservative: 0.6,
  central: 1.0,
  optimistic: 1.45,
};

export const STANCE_LABEL: Record<Stance, string> = {
  conservative: "Conservative",
  central: "Central",
  optimistic: "Optimistic",
};

/** Named pools of addressable value, all in USD per year. */
export type PoolKey = "latency" | "unmeasured" | "commitment" | "fdi" | "concentration";

export const POOL_LABEL: Record<PoolKey, string> = {
  latency: "Value held up by decision latency",
  unmeasured: "Programme spend with no measured outcome",
  commitment: "Decisions taken but not followed through",
  fdi: "Addressable inbound investment",
  concentration: "Output exposed to a single sector",
};

export interface CountryPreset {
  code: string;
  name: string;
  /** Nominal GDP, USD. */
  gdpUsd: number;
  /** General government expenditure as a share of GDP, percent. */
  publicSpendPct: number;
  /** Share of output in the largest sector, percent. */
  topSectorSharePct: number;
}

/**
 * Order-of-magnitude reference points for small open economies. These seed the
 * sliders; every one of them is editable, and the model never depends on the
 * preset being exact.
 */
export const COUNTRY_PRESETS: CountryPreset[] = [
  { code: "ATG", name: "Antigua and Barbuda", gdpUsd: 2_100_000_000, publicSpendPct: 22, topSectorSharePct: 55 },
  { code: "AIA", name: "Anguilla", gdpUsd: 350_000_000, publicSpendPct: 24, topSectorSharePct: 58 },
  { code: "BHS", name: "The Bahamas", gdpUsd: 14_400_000_000, publicSpendPct: 21, topSectorSharePct: 48 },
  { code: "BRB", name: "Barbados", gdpUsd: 6_400_000_000, publicSpendPct: 30, topSectorSharePct: 40 },
  { code: "BLZ", name: "Belize", gdpUsd: 3_300_000_000, publicSpendPct: 27, topSectorSharePct: 38 },
  { code: "DMA", name: "Dominica", gdpUsd: 680_000_000, publicSpendPct: 34, topSectorSharePct: 34 },
  { code: "GRD", name: "Grenada", gdpUsd: 1_300_000_000, publicSpendPct: 25, topSectorSharePct: 42 },
  { code: "GUY", name: "Guyana", gdpUsd: 21_200_000_000, publicSpendPct: 30, topSectorSharePct: 62 },
  { code: "JAM", name: "Jamaica", gdpUsd: 19_400_000_000, publicSpendPct: 27, topSectorSharePct: 32 },
  { code: "KNA", name: "St Kitts and Nevis", gdpUsd: 1_100_000_000, publicSpendPct: 32, topSectorSharePct: 45 },
  { code: "LCA", name: "St Lucia", gdpUsd: 2_500_000_000, publicSpendPct: 26, topSectorSharePct: 47 },
  { code: "VCT", name: "St Vincent and the Grenadines", gdpUsd: 1_100_000_000, publicSpendPct: 31, topSectorSharePct: 36 },
  { code: "TTO", name: "Trinidad and Tobago", gdpUsd: 28_000_000_000, publicSpendPct: 30, topSectorSharePct: 35 },
  { code: "MUS", name: "Mauritius", gdpUsd: 14_400_000_000, publicSpendPct: 27, topSectorSharePct: 25 },
  { code: "FJI", name: "Fiji", gdpUsd: 5_500_000_000, publicSpendPct: 28, topSectorSharePct: 40 },
  { code: "SYC", name: "Seychelles", gdpUsd: 2_100_000_000, publicSpendPct: 33, topSectorSharePct: 52 },
];

/** One framing question. Answered from memory by a Principal, not from a file. */
export interface FramingQuestion {
  key: "decisionsPerQuarter" | "latencyMonths" | "unmeasuredPct" | "topSectorSharePct";
  question: string;
  help: string;
  min: number;
  max: number;
  step: number;
  unit: string;
}

export const FRAMING_QUESTIONS: FramingQuestion[] = [
  {
    key: "decisionsPerQuarter",
    question: "How many GDP-moving decisions does Cabinet take in a quarter?",
    help: "Anything that commits capital, changes an incentive, or reallocates a programme.",
    min: 4,
    max: 120,
    step: 1,
    unit: "decisions",
  },
  {
    key: "latencyMonths",
    question: "From question asked to decision taken — how many months?",
    help: "Count the time spent reconciling numbers, not the time spent deliberating.",
    min: 1,
    max: 18,
    step: 1,
    unit: "months",
  },
  {
    key: "unmeasuredPct",
    question: "What share of programme spend has no measured outcome attached?",
    help: "Money that is disbursed and reported, but never scored against a stated result.",
    min: 0,
    max: 80,
    step: 1,
    unit: "% of public spend",
  },
  {
    key: "topSectorSharePct",
    question: "What share of output sits in your largest sector?",
    help: "Tourism, extractives, financial services — whichever carries the economy.",
    min: 10,
    max: 75,
    step: 1,
    unit: "% of GDP",
  },
];

export interface ChamberCoefficient {
  index: string;
  /** Short label used on the slider and in the waterfall. */
  short: string;
  /** The single mechanism this chamber monetises. */
  mechanism: string;
  /** Where the coefficient comes from — shown in the arithmetic drawer. */
  basis: string;
  /** Pools this chamber draws on, with the recoverable share at full adoption. */
  draws: Array<{ pool: PoolKey; share: number }>;
}

export const CHAMBER_COEFFICIENTS: ChamberCoefficient[] = [
  {
    index: "01",
    short: "National Ledger",
    mechanism: "Decision latency reduction across the Cabinet cadence",
    basis: "One agreed set of numbers removes the reconciliation pass. Recovers a quarter of the value held up by latency at full institutionalisation.",
    draws: [{ pool: "latency", share: 0.25 }],
  },
  {
    index: "02",
    short: "Portfolios",
    mechanism: "Reallocation yield on programme spend with no measured outcome",
    basis: "Ministers who can see their own contribution reallocate at the margin. A tenth of unmeasured spend, not the whole of it.",
    draws: [{ pool: "unmeasured", share: 0.1 }],
  },
  {
    index: "03",
    short: "Scenarios",
    mechanism: "Avoided cost of a large commitment taken on the wrong assumption",
    basis: "Rehearsal before commitment prices the downside while it is still avoidable.",
    draws: [{ pool: "commitment", share: 0.28 }],
  },
  {
    index: "04",
    short: "FDI Studio",
    mechanism: "Incremental investment capture and concentration de-risking",
    basis: "Investors withdraw on unanswered readiness questions, not on size. Priced against an addressable inbound pool of two per cent of GDP.",
    draws: [
      { pool: "fdi", share: 0.35 },
      { pool: "concentration", share: 0.06 },
    ],
  },
  {
    index: "05",
    short: "Narrative",
    mechanism: "Reduced policy reversal and stalled-programme rate",
    basis: "A programme that is explained survives its first bad week. Modest by design — this chamber protects value rather than creating it.",
    draws: [{ pool: "commitment", share: 0.12 }],
  },
  {
    index: "06",
    short: "Cabinet Room",
    mechanism: "Follow-through on decisions already taken",
    basis: "A named owner and a standing commitments record is the cheapest recovery of value in government.",
    draws: [{ pool: "commitment", share: 0.22 }],
  },
  {
    index: "07",
    short: "Persona Lab",
    mechanism: "Programme design hit-rate before the spend is committed",
    basis: "A rehearsal instrument, not a substitute for polling — so the share claimed is small.",
    draws: [{ pool: "unmeasured", share: 0.06 }],
  },
  {
    index: "08",
    short: "Mandate Compact",
    mechanism: "Mandate delivery rate across the term",
    basis: "Pledges decomposed to ministry-owned deliverables and scored quarterly convert intent into completed work.",
    draws: [
      { pool: "unmeasured", share: 0.08 },
      { pool: "commitment", share: 0.1 },
    ],
  },
];

/** Adoption ramp — chambers land over three years, they do not arrive at once. */
export const RAMP = [0.35, 0.75, 1.0] as const;

/**
 * Ceiling on total claimed uplift, as a share of GDP at year three (central
 * stance). No configuration of sliders may claim more than this.
 */
export const UPLIFT_CEILING_PCT_OF_GDP = 1.2;

export interface ValueInput {
  gdpUsd: number;
  publicSpendPct: number;
  decisionsPerQuarter: number;
  latencyMonths: number;
  unmeasuredPct: number;
  topSectorSharePct: number;
  /** Chamber index → adoption, 0–100. */
  chambers: Record<string, number>;
  stance: Stance;
}

export interface ChamberContribution {
  index: string;
  short: string;
  adoption: number;
  /** Year-three uplift attributable to this chamber, USD. */
  usd: number;
  /** Share of total year-three uplift, 0–1. */
  share: number;
  mechanism: string;
}

export interface ValueResult {
  model_version: typeof VALUE_MODEL_VERSION;
  pools: Record<PoolKey, number>;
  /** Uncapped sum before the ceiling is applied. */
  rawUsd: number;
  /** Year-three uplift, USD, after the ceiling. */
  upliftUsd: number;
  upliftPpOfGdp: number;
  path: Array<{ year: number; usd: number }>;
  chambers: ChamberContribution[];
  annualCostUsd: number;
  yearOneCostUsd: number;
  returnMultiple: number;
  paybackMonths: number | null;
  adoptedCount: number;
  /** Chamber index whose single next notch moves the verdict most. */
  highestLeverageIndex: string | null;
  trace: Record<string, unknown>;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/** Softly caps `raw` against `ceiling`: monotone, never exceeds the ceiling. */
function softCap(raw: number, ceiling: number): number {
  if (ceiling <= 0) return 0;
  return ceiling * (1 - Math.exp(-raw / ceiling));
}

export function computePools(input: ValueInput): Record<PoolKey, number> {
  const gdp = Math.max(0, input.gdpUsd);
  const publicSpend = gdp * clamp(input.publicSpendPct, 5, 60) / 100;

  return {
    // Latency bites harder the longer a decision takes, up to 8% of public spend.
    latency: publicSpend * clamp((input.latencyMonths - 1) / 17, 0, 1) * 0.08,
    unmeasured: publicSpend * clamp(input.unmeasuredPct, 0, 80) / 100,
    // Follow-through pool scales with decision cadence, up to 5% of public spend.
    commitment: publicSpend * clamp(input.decisionsPerQuarter / 120, 0, 1) * 0.05,
    // Addressable inbound investment, held deliberately flat at 2% of GDP.
    fdi: gdp * 0.02,
    // Output exposed above a 25% single-sector threshold.
    concentration: gdp * clamp(input.topSectorSharePct - 25, 0, 50) / 100,
  };
}

/** Annual instrument cost band. Scales with the number of chambers stood up. */
export function computeCost(input: ValueInput, adoptedCount: number): { annual: number; yearOne: number } {
  const annual = 300_000 + adoptedCount * 95_000;
  return { annual, yearOne: Math.round(annual * 1.4) };
}

export function computeValue(input: ValueInput): ValueResult {
  const pools = computePools(input);
  const stance = STANCE_MULTIPLIER[input.stance];
  const gdp = Math.max(0, input.gdpUsd);

  const raws = CHAMBER_COEFFICIENTS.map((c) => {
    const adoption = clamp(input.chambers[c.index] ?? 0, 0, 100) / 100;
    const usd = c.draws.reduce((sum, d) => sum + pools[d.pool] * d.share, 0) * adoption * stance;
    return { c, adoption, usd };
  });

  const rawUsd = raws.reduce((s, r) => s + r.usd, 0);
  const ceiling = gdp * (UPLIFT_CEILING_PCT_OF_GDP / 100) * stance;
  const upliftUsd = softCap(rawUsd, ceiling);
  const scale = rawUsd > 0 ? upliftUsd / rawUsd : 0;

  const chambers: ChamberContribution[] = raws.map((r) => ({
    index: r.c.index,
    short: r.c.short,
    adoption: Math.round(r.adoption * 100),
    usd: r.usd * scale,
    share: upliftUsd > 0 ? (r.usd * scale) / upliftUsd : 0,
    mechanism: r.c.mechanism,
  }));

  const path = RAMP.map((f, i) => ({ year: i + 1, usd: upliftUsd * f }));
  const adoptedCount = raws.filter((r) => r.adoption >= 0.1).length;
  const cost = computeCost(input, adoptedCount);

  const yearOne = path[0].usd;
  const paybackMonths =
    yearOne > 0 ? Math.max(1, Math.round((cost.yearOne / (yearOne / 12)) * 10) / 10) : null;

  // Highest leverage: which single chamber, raised one notch (+25), adds most.
  let bestIndex: string | null = null;
  let bestGain = 0;
  for (const c of CHAMBER_COEFFICIENTS) {
    const current = clamp(input.chambers[c.index] ?? 0, 0, 100);
    if (current >= 100) continue;
    const probe = computeValueRaw({ ...input, chambers: { ...input.chambers, [c.index]: Math.min(100, current + 25) } });
    const gain = probe - upliftUsd;
    if (gain > bestGain) {
      bestGain = gain;
      bestIndex = c.index;
    }
  }

  return {
    model_version: VALUE_MODEL_VERSION,
    pools,
    rawUsd,
    upliftUsd,
    upliftPpOfGdp: gdp > 0 ? (upliftUsd / gdp) * 100 : 0,
    path,
    chambers,
    annualCostUsd: cost.annual,
    yearOneCostUsd: cost.yearOne,
    returnMultiple: cost.annual > 0 ? upliftUsd / cost.annual : 0,
    paybackMonths: paybackMonths !== null ? Math.min(paybackMonths, 120) : null,
    adoptedCount,
    highestLeverageIndex: bestIndex,
    trace: {
      model_version: VALUE_MODEL_VERSION,
      stance: input.stance,
      stance_multiplier: stance,
      gdp_usd: gdp,
      public_spend_usd: gdp * input.publicSpendPct / 100,
      addressable_pools_usd: pools,
      raw_sum_usd: Math.round(rawUsd),
      ceiling_usd: Math.round(ceiling),
      ceiling_rule: `Soft-capped at ${UPLIFT_CEILING_PCT_OF_GDP}% of GDP × stance multiplier`,
      capped_uplift_year_3_usd: Math.round(upliftUsd),
      adoption_ramp: { year_1: RAMP[0], year_2: RAMP[1], year_3: RAMP[2] },
      chambers: CHAMBER_COEFFICIENTS.map((c) => ({
        chamber: `${c.index} · ${c.short}`,
        adoption_pct: clamp(input.chambers[c.index] ?? 0, 0, 100),
        draws: c.draws.map((d) => ({
          pool: POOL_LABEL[d.pool],
          pool_usd: Math.round(pools[d.pool]),
          recoverable_share: d.share,
        })),
        basis: c.basis,
        contribution_year_3_usd: Math.round((raws.find((r) => r.c.index === c.index)?.usd ?? 0) * scale),
      })),
      cost: {
        annual_usd: cost.annual,
        year_one_usd: cost.yearOne,
        rule: "US$300,000 base plus US$95,000 per chamber stood up; year one carries a 40% implementation uplift.",
      },
    },
  };
}

/** Uncapped-then-capped total only — used for the sensitivity probe. */
function computeValueRaw(input: ValueInput): number {
  const pools = computePools(input);
  const stance = STANCE_MULTIPLIER[input.stance];
  const raw = CHAMBER_COEFFICIENTS.reduce((sum, c) => {
    const adoption = clamp(input.chambers[c.index] ?? 0, 0, 100) / 100;
    return sum + c.draws.reduce((s, d) => s + pools[d.pool] * d.share, 0) * adoption * stance;
  }, 0);
  const ceiling = Math.max(0, input.gdpUsd) * (UPLIFT_CEILING_PCT_OF_GDP / 100) * stance;
  return softCap(raw, ceiling);
}

export function formatUsd(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1_000_000_000) return `US$${(v / 1_000_000_000).toFixed(2)} bn`;
  if (abs >= 1_000_000) return `US$${(v / 1_000_000).toFixed(1)} m`;
  if (abs >= 1_000) return `US$${Math.round(v / 1_000)} k`;
  return `US$${Math.round(v)}`;
}

export function formatUsdExact(v: number): string {
  return `US$${Math.round(v).toLocaleString("en-US")}`;
}

export const DEFAULT_INPUT: ValueInput = {
  gdpUsd: COUNTRY_PRESETS.find((c) => c.code === "LCA")!.gdpUsd,
  publicSpendPct: 26,
  decisionsPerQuarter: 24,
  latencyMonths: 6,
  unmeasuredPct: 30,
  topSectorSharePct: 47,
  chambers: { "01": 100, "02": 50, "03": 50, "04": 50, "05": 25, "06": 50, "07": 0, "08": 50 },
  stance: "central",
};

export const ADOPTION_STOPS: Array<{ value: number; label: string }> = [
  { value: 0, label: "Not adopted" },
  { value: 25, label: "Piloted" },
  { value: 50, label: "In service" },
  { value: 75, label: "Embedded" },
  { value: 100, label: "Institutionalised" },
];

export function adoptionLabel(v: number): string {
  let best = ADOPTION_STOPS[0];
  for (const s of ADOPTION_STOPS) if (v >= s.value) best = s;
  return best.label;
}
