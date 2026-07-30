// @domain agency
// @tables none
// @ui src/routes/_authenticated/admin/proforma.tsx
//
// The Agency Pro Forma — deterministic go-to-market model, v1_proforma.
// Pure, versioned, no RNG, no I/O. It answers two questions on one page:
// how much the instrument earns as it is adopted across the Caribbean and
// beyond, and how much GDP that same adoption puts on the ground.
//
// The value side is NOT re-derived here. Every adopting country is run through
// `computeValue` from src/lib/calculator/model.ts — the same coefficients, the
// same stance multipliers, the same 1.2%-of-GDP ceiling the public calculator
// is bound by. One dialect of economics across the whole product.

import {
  CHAMBER_COEFFICIENTS,
  RAMP,
  STANCE_MULTIPLIER,
  computeValue,
  type Stance,
} from "@/lib/calculator/model";

export const PROFORMA_MODEL_VERSION = "v1_proforma" as const;

export const HORIZON_MONTHS = 60;

/** A sovereign the instrument can be sold to. */
export interface MarketCountry {
  code: string;
  name: string;
  gdpUsd: number;
  publicSpendPct: number;
  topSectorSharePct: number;
}

export type CohortKey = "caribbean" | "pacific" | "west_africa";

export const COHORT_LABEL: Record<CohortKey, string> = {
  caribbean: "Caribbean",
  pacific: "Pacific SIDS",
  west_africa: "West Africa",
};

export interface CohortSetting {
  key: CohortKey;
  /** Month the cohort opens (1 = day one). */
  startMonth: number;
  /** Maximum number of states that can ever be signed from this cohort. */
  ceiling: number;
  /** Multiplier on ARPU for this cohort — expansion markets price differently. */
  arpuMultiplier: number;
}

/** Representative economies for cohorts not yet in the corpus. */
export const REPRESENTATIVE_COUNTRY: Record<Exclude<CohortKey, "caribbean">, MarketCountry> = {
  pacific: {
    code: "PAC",
    name: "Representative Pacific SIDS",
    gdpUsd: 2_400_000_000,
    publicSpendPct: 30,
    topSectorSharePct: 42,
  },
  west_africa: {
    code: "WAF",
    name: "Representative West African state",
    gdpUsd: 18_000_000_000,
    publicSpendPct: 22,
    topSectorSharePct: 38,
  },
};

/** Fallback Caribbean market if the countries table carries no GDP yet. */
export const CARIBBEAN_FALLBACK: MarketCountry[] = [
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
  { code: "SUR", name: "Suriname", gdpUsd: 4_100_000_000, publicSpendPct: 26, topSectorSharePct: 44 },
  { code: "VGB", name: "British Virgin Islands", gdpUsd: 1_500_000_000, publicSpendPct: 20, topSectorSharePct: 60 },
  { code: "MSR", name: "Montserrat", gdpUsd: 70_000_000, publicSpendPct: 40, topSectorSharePct: 50 },
];

export interface ProformaInput {
  /** New states signed per month, by phase. */
  paceMonths1to6: number;
  paceMonths7to12: number;
  paceYears2to3: number;
  paceYears4to5: number;

  /** Average revenue per adopting country, USD per month, at cohort par. */
  arpuUsdMonth: number;
  /** One-time instrumentation and onboarding fee, USD. */
  onboardingFeeUsd: number;
  /** Annual price escalator applied on each contract anniversary, percent. */
  escalatorPct: number;
  /** Monthly logo churn, percent. */
  churnPctMonth: number;
  /** Delivery gross margin, percent. */
  grossMarginPct: number;

  /** How many of the eight chambers a typical adopter stands up. */
  chamberDepth: number;
  /** Adoption intensity within each stood-up chamber, 0–100. */
  chamberIntensityPct: number;

  stance: Stance;
  cohorts: CohortSetting[];
}

export const DEFAULT_PROFORMA_INPUT: ProformaInput = {
  paceMonths1to6: 0.5,
  paceMonths7to12: 1,
  paceYears2to3: 1.5,
  paceYears4to5: 2,
  arpuUsdMonth: 35_000,
  onboardingFeeUsd: 150_000,
  escalatorPct: 4,
  churnPctMonth: 0.5,
  grossMarginPct: 68,
  chamberDepth: 5,
  chamberIntensityPct: 70,
  stance: "central",
  cohorts: [
    { key: "caribbean", startMonth: 1, ceiling: 16, arpuMultiplier: 1 },
    { key: "pacific", startMonth: 30, ceiling: 8, arpuMultiplier: 0.85 },
    { key: "west_africa", startMonth: 42, ceiling: 10, arpuMultiplier: 1.2 },
  ],
};

export interface MonthRow {
  month: number;
  newCountries: number;
  activeCountries: number;
  subscriptionUsd: number;
  onboardingUsd: number;
  revenueUsd: number;
  cumulativeRevenueUsd: number;
  grossProfitUsd: number;
  arrUsd: number;
  /** Annualised GDP uplift running across all live deployments this month. */
  upliftRunRateUsd: number;
  /** GDP uplift actually realised in this month. */
  upliftRealisedUsd: number;
  cumulativeUpliftUsd: number;
}

export interface PeriodRow {
  label: string;
  /** 1-indexed period number within the horizon. */
  index: number;
  newCountries: number;
  activeCountries: number;
  revenueUsd: number;
  cumulativeRevenueUsd: number;
  grossProfitUsd: number;
  arrUsd: number;
  upliftUsd: number;
  cumulativeUpliftUsd: number;
  benefitCostRatio: number;
}

export interface Milestone {
  key: string;
  label: string;
  month: number;
  activeCountries: number;
  arrUsd: number;
  cumulativeRevenueUsd: number;
  cumulativeUpliftUsd: number;
  benefitCostRatio: number;
}

export interface ProformaResult {
  model_version: typeof PROFORMA_MODEL_VERSION;
  months: MonthRow[];
  quarters: PeriodRow[];
  years: PeriodRow[];
  milestones: Milestone[];
  totals: {
    signedCountries: number;
    activeAtEnd: number;
    revenueUsd: number;
    grossProfitUsd: number;
    exitArrUsd: number;
    upliftUsd: number;
    upliftRunRateAtEndUsd: number;
    benefitCostRatio: number;
    marketSize: number;
  };
  /** Per-country full-strength annual uplift, for the ledger and Explain. */
  perCountry: Array<{
    code: string;
    name: string;
    cohort: CohortKey;
    gdpUsd: number;
    signedMonth: number | null;
    fullAnnualUpliftUsd: number;
    upliftPpOfGdp: number;
  }>;
  trace: Record<string, unknown>;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/** New signings available in a given month, before cohort ceilings bite. */
export function paceForMonth(input: ProformaInput, month: number): number {
  if (month <= 6) return Math.max(0, input.paceMonths1to6);
  if (month <= 12) return Math.max(0, input.paceMonths7to12);
  if (month <= 36) return Math.max(0, input.paceYears2to3);
  return Math.max(0, input.paceYears4to5);
}

/** Chamber adoption map implied by depth + intensity. */
export function chamberMap(input: ProformaInput): Record<string, number> {
  const depth = clamp(Math.round(input.chamberDepth), 0, CHAMBER_COEFFICIENTS.length);
  const intensity = clamp(input.chamberIntensityPct, 0, 100);
  const map: Record<string, number> = {};
  CHAMBER_COEFFICIENTS.forEach((c, i) => {
    map[c.index] = i < depth ? intensity : 0;
  });
  return map;
}

/**
 * Realisation ramp from a country's own signature date. Year one lands 35% of
 * the modelled uplift, year two 75%, year three onward the full figure — the
 * same ramp the public calculator uses.
 */
export function realisationFactor(monthsLive: number): number {
  if (monthsLive <= 0) return 0;
  const year = Math.min(3, Math.ceil(monthsLive / 12));
  const prev = year === 1 ? 0 : RAMP[year - 2];
  const target = RAMP[year - 1];
  const within = ((monthsLive - 1) % 12) / 12;
  return prev + (target - prev) * within;
}

/** Full-strength annual GDP uplift for one country, via the value model. */
export function countryUplift(country: MarketCountry, input: ProformaInput) {
  const result = computeValue({
    gdpUsd: country.gdpUsd,
    publicSpendPct: country.publicSpendPct,
    decisionsPerQuarter: 24,
    latencyMonths: 6,
    unmeasuredPct: 35,
    topSectorSharePct: country.topSectorSharePct,
    chambers: chamberMap(input),
    stance: input.stance,
  });
  return { annualUsd: result.upliftUsd, ppOfGdp: result.upliftPpOfGdp };
}

interface Signed {
  country: MarketCountry;
  cohort: CohortKey;
  signedMonth: number;
  arpuMultiplier: number;
  fullAnnualUpliftUsd: number;
  upliftPpOfGdp: number;
}

/**
 * Runs the full 60-month model.
 *
 * `caribbean` is the real market pulled from the countries table; expansion
 * cohorts are synthesised from a representative economy because those states
 * are not in the corpus yet.
 */
export function runProforma(input: ProformaInput, caribbean: MarketCountry[]): ProformaResult {
  const cohortOf = new Map<CohortKey, CohortSetting>(input.cohorts.map((c) => [c.key, c]));

  // Build the sellable universe, richest-first inside each cohort — the agency
  // does not sell in alphabetical order.
  const universe: Array<{ country: MarketCountry; cohort: CohortKey; arpuMultiplier: number }> = [];

  const carSetting = cohortOf.get("caribbean");
  if (carSetting) {
    const pool = (caribbean.length ? caribbean : CARIBBEAN_FALLBACK)
      .slice()
      .sort((a, b) => b.gdpUsd - a.gdpUsd)
      .slice(0, Math.max(0, Math.round(carSetting.ceiling)));
    for (const c of pool) {
      universe.push({ country: c, cohort: "caribbean", arpuMultiplier: carSetting.arpuMultiplier });
    }
  }

  for (const key of ["pacific", "west_africa"] as const) {
    const setting = cohortOf.get(key);
    if (!setting) continue;
    const rep = REPRESENTATIVE_COUNTRY[key];
    for (let i = 0; i < Math.max(0, Math.round(setting.ceiling)); i += 1) {
      universe.push({
        country: { ...rep, code: `${rep.code}-${i + 1}`, name: `${COHORT_LABEL[key]} state ${i + 1}` },
        cohort: key,
        arpuMultiplier: setting.arpuMultiplier,
      });
    }
  }

  // Value each candidate once. computeValue is pure, so this is safe to memo
  // by GDP profile — expansion cohorts share one profile.
  const upliftCache = new Map<string, { annualUsd: number; ppOfGdp: number }>();
  function upliftFor(c: MarketCountry) {
    const key = `${Math.round(c.gdpUsd)}|${c.publicSpendPct}|${c.topSectorSharePct}`;
    const hit = upliftCache.get(key);
    if (hit) return hit;
    const v = countryUplift(c, input);
    upliftCache.set(key, v);
    return v;
  }

  const signed: Signed[] = [];
  const remaining = universe.slice();
  let carry = 0;

  const churn = clamp(input.churnPctMonth, 0, 20) / 100;
  const escalator = 1 + clamp(input.escalatorPct, 0, 25) / 100;
  const margin = clamp(input.grossMarginPct, 0, 100) / 100;

  const months: MonthRow[] = [];
  let cumRevenue = 0;
  let cumUplift = 0;

  for (let m = 1; m <= HORIZON_MONTHS; m += 1) {
    // Signings: fractional pace accumulates rather than rounding away.
    carry += paceForMonth(input, m);
    let newCount = 0;
    while (carry >= 1) {
      const idx = remaining.findIndex(
        (r) => (cohortOf.get(r.cohort)?.startMonth ?? 1) <= m,
      );
      if (idx === -1) break;
      const [pick] = remaining.splice(idx, 1);
      const u = upliftFor(pick.country);
      signed.push({
        country: pick.country,
        cohort: pick.cohort,
        signedMonth: m,
        arpuMultiplier: pick.arpuMultiplier,
        fullAnnualUpliftUsd: u.annualUsd,
        upliftPpOfGdp: u.ppOfGdp,
      });
      carry -= 1;
      newCount += 1;
    }

    let active = 0;
    let subscription = 0;
    let onboarding = 0;
    let upliftRunRate = 0;

    for (const s of signed) {
      const monthsLive = m - s.signedMonth + 1;
      const survival = Math.pow(1 - churn, Math.max(0, monthsLive - 1));
      active += survival;
      const anniversaries = Math.floor((monthsLive - 1) / 12);
      subscription +=
        input.arpuUsdMonth * s.arpuMultiplier * Math.pow(escalator, anniversaries) * survival;
      if (s.signedMonth === m) onboarding += input.onboardingFeeUsd * s.arpuMultiplier;
      upliftRunRate += s.fullAnnualUpliftUsd * realisationFactor(monthsLive) * survival;
    }

    const revenue = subscription + onboarding;
    cumRevenue += revenue;
    const upliftRealised = upliftRunRate / 12;
    cumUplift += upliftRealised;

    months.push({
      month: m,
      newCountries: newCount,
      activeCountries: active,
      subscriptionUsd: subscription,
      onboardingUsd: onboarding,
      revenueUsd: revenue,
      cumulativeRevenueUsd: cumRevenue,
      grossProfitUsd: revenue * margin,
      arrUsd: subscription * 12,
      upliftRunRateUsd: upliftRunRate,
      upliftRealisedUsd: upliftRealised,
      cumulativeUpliftUsd: cumUplift,
    });
  }

  function roll(size: number, labelFor: (i: number) => string): PeriodRow[] {
    const out: PeriodRow[] = [];
    for (let start = 0; start < months.length; start += size) {
      const slice = months.slice(start, start + size);
      const last = slice[slice.length - 1];
      out.push({
        label: labelFor(out.length + 1),
        index: out.length + 1,
        newCountries: slice.reduce((s, r) => s + r.newCountries, 0),
        activeCountries: last.activeCountries,
        revenueUsd: slice.reduce((s, r) => s + r.revenueUsd, 0),
        cumulativeRevenueUsd: last.cumulativeRevenueUsd,
        grossProfitUsd: slice.reduce((s, r) => s + r.grossProfitUsd, 0),
        arrUsd: last.arrUsd,
        upliftUsd: slice.reduce((s, r) => s + r.upliftRealisedUsd, 0),
        cumulativeUpliftUsd: last.cumulativeUpliftUsd,
        benefitCostRatio:
          last.cumulativeRevenueUsd > 0 ? last.cumulativeUpliftUsd / last.cumulativeRevenueUsd : 0,
      });
    }
    return out;
  }

  const quarters = roll(3, (i) => `Y${Math.ceil(i / 4)} Q${((i - 1) % 4) + 1}`);
  const years = roll(12, (i) => `Year ${i}`);

  const milestoneMonths: Array<{ key: string; label: string; month: number }> = [
    { key: "q1", label: "End of quarter one", month: 3 },
    { key: "y1", label: "End of year one", month: 12 },
    { key: "y3", label: "End of year three", month: 36 },
    { key: "y5", label: "End of year five", month: 60 },
  ];

  const milestones: Milestone[] = milestoneMonths.map((ms) => {
    const row = months[ms.month - 1];
    return {
      key: ms.key,
      label: ms.label,
      month: ms.month,
      activeCountries: row.activeCountries,
      arrUsd: row.arrUsd,
      cumulativeRevenueUsd: row.cumulativeRevenueUsd,
      cumulativeUpliftUsd: row.cumulativeUpliftUsd,
      benefitCostRatio:
        row.cumulativeRevenueUsd > 0 ? row.cumulativeUpliftUsd / row.cumulativeRevenueUsd : 0,
    };
  });

  const last = months[months.length - 1];
  const signedByCode = new Map(signed.map((s) => [s.country.code, s]));

  const perCountry = universe.map((u) => {
    const s = signedByCode.get(u.country.code);
    const v = upliftFor(u.country);
    return {
      code: u.country.code,
      name: u.country.name,
      cohort: u.cohort,
      gdpUsd: u.country.gdpUsd,
      signedMonth: s ? s.signedMonth : null,
      fullAnnualUpliftUsd: v.annualUsd,
      upliftPpOfGdp: v.ppOfGdp,
    };
  });

  return {
    model_version: PROFORMA_MODEL_VERSION,
    months,
    quarters,
    years,
    milestones,
    totals: {
      signedCountries: signed.length,
      activeAtEnd: last.activeCountries,
      revenueUsd: last.cumulativeRevenueUsd,
      grossProfitUsd: months.reduce((s, r) => s + r.grossProfitUsd, 0),
      exitArrUsd: last.arrUsd,
      upliftUsd: last.cumulativeUpliftUsd,
      upliftRunRateAtEndUsd: last.upliftRunRateUsd,
      benefitCostRatio:
        last.cumulativeRevenueUsd > 0 ? last.cumulativeUpliftUsd / last.cumulativeRevenueUsd : 0,
      marketSize: universe.length,
    },
    trace: {
      model_version: PROFORMA_MODEL_VERSION,
      value_engine: "v1_value · computeValue()",
      stance: input.stance,
      stance_multiplier: STANCE_MULTIPLIER[input.stance],
      horizon_months: HORIZON_MONTHS,
      market_size: universe.length,
      pace: {
        months_1_6: input.paceMonths1to6,
        months_7_12: input.paceMonths7to12,
        years_2_3: input.paceYears2to3,
        years_4_5: input.paceYears4to5,
      },
      pricing: {
        arpu_usd_month: input.arpuUsdMonth,
        onboarding_fee_usd: input.onboardingFeeUsd,
        escalator_pct: input.escalatorPct,
        churn_pct_month: input.churnPctMonth,
        gross_margin_pct: input.grossMarginPct,
      },
      chambers: { depth: input.chamberDepth, intensity_pct: input.chamberIntensityPct },
      realisation_ramp: { year_1: RAMP[0], year_2: RAMP[1], year_3: RAMP[2] },
    },
  };
}

export function formatUsdShort(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1_000_000_000) return `US$${(v / 1_000_000_000).toFixed(abs >= 10_000_000_000 ? 0 : 1)}bn`;
  if (abs >= 1_000_000) return `US$${(v / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)}m`;
  if (abs >= 1_000) return `US$${(v / 1_000).toFixed(0)}k`;
  return `US$${Math.round(v)}`;
}

export function formatCount(v: number): string {
  return v >= 10 ? v.toFixed(0) : v.toFixed(1);
}
