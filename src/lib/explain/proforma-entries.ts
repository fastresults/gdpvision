// @domain explain
// @tables none
// @ui src/routes/_authenticated/admin/proforma.tsx
//
// Rationale entries for the Agency Pro Forma. Every line reads from
// `runProforma`'s output — nothing recomputes, so the modal cannot disagree
// with the board on screen.

import {
  COHORT_LABEL,
  HORIZON_MONTHS,
  formatUsdShort,
  paceForMonth,
  type ProformaInput,
  type ProformaResult,
} from "@/lib/proforma/model";
import { registerRationales, type DerivedLine, type Rationale } from "@/lib/explain/registry";

export interface ProformaCtx {
  input: ProformaInput;
  result: ProformaResult;
}

const n1 = (v: number) => v.toFixed(1);

const ENTRIES: Array<Rationale<ProformaCtx>> = [
  {
    key: "pf.arr",
    title: "Exit ARR",
    short:
      "Subscription revenue in the final month of the horizon, annualised. Onboarding fees are excluded — they are not recurring.",
    formula: "Exit ARR = month-60 subscription revenue × 12.",
    basis:
      "Annualising the last month rather than summing the year avoids crediting the run rate with earlier, smaller cohorts.",
    caveat:
      "ARR assumes the month-60 book renews. Raise monthly churn and the same signings produce a lower exit.",
    derive: (ctx) => {
      const last = ctx.result.months[ctx.result.months.length - 1];
      return [
        { label: "Live deployments, month 60", value: n1(last.activeCountries) },
        { label: "Subscription revenue, month 60", value: formatUsdShort(last.subscriptionUsd) },
        { label: "× 12", value: formatUsdShort(last.arrUsd), note: "Exit annual recurring revenue" },
      ];
    },
  },
  {
    key: "pf.revenue",
    title: "Cumulative revenue",
    short:
      "Every subscription month plus every onboarding fee across the sixty-month horizon, at the stated pace and price.",
    formula:
      "Σ over months of (ARPU × cohort multiplier × escalator^anniversaries × survival) + onboarding fees at signature.",
    basis:
      "Price escalates on each contract anniversary; survival decays at the monthly churn rate from the month after signature.",
    caveat: "Nothing here is contracted. It is the arithmetic of an assumed pace, not a pipeline.",
    derive: (ctx) => {
      const t = ctx.result.totals;
      const onboarding = ctx.result.months.reduce((s, m) => s + m.onboardingUsd, 0);
      return [
        { label: "States signed over the horizon", value: `${t.signedCountries} of ${t.marketSize}` },
        { label: "Subscription revenue", value: formatUsdShort(t.revenueUsd - onboarding) },
        { label: "Onboarding fees", value: formatUsdShort(onboarding) },
        { label: "Cumulative revenue", value: formatUsdShort(t.revenueUsd) },
        {
          label: `Gross profit at ${ctx.input.grossMarginPct}% margin`,
          value: formatUsdShort(t.grossProfitUsd),
        },
      ];
    },
  },
  {
    key: "pf.pace",
    title: "Adoption pace",
    short:
      "New states signed per month, stepped by phase. Fractional pace accumulates rather than rounding away.",
    formula:
      "Months 1–6, 7–12, years 2–3 and years 4–5 each carry their own monthly signing rate, bounded by cohort ceilings and open dates.",
    basis:
      "Sovereign procurement is slow first and compounding later; a single flat rate flatters year one and undersells year five.",
    caveat:
      "A cohort that has not opened yet cannot absorb signings, so raising pace early only pulls forward Caribbean states.",
    derive: (ctx) => [
      { label: "Months 1–6", value: `${n1(paceForMonth(ctx.input, 1))} / month` },
      { label: "Months 7–12", value: `${n1(paceForMonth(ctx.input, 7))} / month` },
      { label: "Years 2–3", value: `${n1(paceForMonth(ctx.input, 13))} / month` },
      { label: "Years 4–5", value: `${n1(paceForMonth(ctx.input, 37))} / month` },
      {
        label: "Addressable market",
        value: `${ctx.result.totals.marketSize} states`,
        note: ctx.input.cohorts
          .map((c) => `${COHORT_LABEL[c.key]} opens month ${c.startMonth}, ceiling ${c.ceiling}`)
          .join(" · "),
      },
    ],
  },
  {
    key: "pf.active",
    title: "Live deployments",
    short:
      "Signed states net of churn. Each deployment carries a survival weight of (1 − monthly churn) raised to its months live.",
    formula: "Active = Σ over signed states of (1 − churn)^(months live − 1).",
    basis:
      "A continuous survival weight rather than discrete cancellation keeps the model deterministic — no sampling, no randomness.",
    caveat: "Sovereign contracts rarely churn monthly; treat churn as an availability discount on the book.",
    derive: (ctx) => {
      const t = ctx.result.totals;
      return [
        { label: "Signed over the horizon", value: String(t.signedCountries) },
        { label: `Monthly churn`, value: `${ctx.input.churnPctMonth}%` },
        { label: "Live at month 60", value: n1(t.activeAtEnd) },
        {
          label: "Implied attrition",
          value: n1(Math.max(0, t.signedCountries - t.activeAtEnd)),
          note: "Expressed as fractional deployments, not whole cancellations.",
        },
      ];
    },
  },
  {
    key: "pf.uplift",
    title: "Correlated GDP uplift",
    short:
      "Each adopting state is run through the public value model at the same chamber depth and stance, then ramped from its own signature date.",
    formula:
      "Uplift = Σ over live states of (that state's modelled year-three uplift × realisation ramp × survival).",
    basis:
      "The value engine is v1_value — identical coefficients, identical stance multipliers, identical 1.2%-of-GDP ceiling as the public calculator.",
    caveat:
      "This is a decision-framing figure, not a forecast, and it is the sovereign's benefit — not agency revenue.",
    derive: (ctx) => {
      const t = ctx.result.totals;
      const signedCountries = ctx.result.perCountry.filter((c) => c.signedMonth !== null);
      const avg =
        signedCountries.length > 0
          ? signedCountries.reduce((s, c) => s + c.fullAnnualUpliftUsd, 0) / signedCountries.length
          : 0;
      const lines: DerivedLine[] = [
        {
          label: "Chambers stood up per adopter",
          value: `${ctx.input.chamberDepth} of 8 at ${ctx.input.chamberIntensityPct}%`,
        },
        { label: "Realisation ramp", value: "35% year one · 75% year two · 100% year three" },
        { label: "Average uplift per adopter, at full strength", value: formatUsdShort(avg) },
        {
          label: "Run rate at month 60",
          value: `${formatUsdShort(t.upliftRunRateAtEndUsd)} / year`,
        },
        { label: "Cumulative uplift over the horizon", value: formatUsdShort(t.upliftUsd) },
      ];
      return lines;
    },
  },
  {
    key: "pf.bcr",
    title: "Benefit–cost ratio",
    short:
      "Sovereign GDP uplift realised for every dollar the sovereigns pay the agency, cumulative to the period end.",
    formula: "BCR = cumulative GDP uplift ÷ cumulative fees paid.",
    basis:
      "Both sides use the same clock, so early periods look weak by construction: fees start at signature, uplift ramps over three years.",
    caveat:
      "A ratio, not an IRR. It ignores the sovereign's own implementation cost beyond the licence.",
    derive: (ctx) => {
      const t = ctx.result.totals;
      return [
        ...ctx.result.milestones.map((m) => ({
          label: m.label,
          value: m.benefitCostRatio > 0 ? `${m.benefitCostRatio.toFixed(1)}×` : "—",
          note: `${formatUsdShort(m.cumulativeUpliftUsd)} uplift ÷ ${formatUsdShort(m.cumulativeRevenueUsd)} fees`,
        })),
        {
          label: `Horizon (${HORIZON_MONTHS} months)`,
          value: `${t.benefitCostRatio.toFixed(1)}×`,
        },
      ];
    },
  },
  {
    key: "pf.margin",
    title: "Gross profit",
    short: "Revenue after the cost of delivering the instrument — research, ingest, stewardship and support.",
    formula: "Gross profit = revenue × gross margin.",
    basis:
      "Margin is an assumption, not an observation. Deep research and human stewardship both scale with the book.",
    caveat: "Onboarding fees usually carry a thinner margin than subscription; the model applies one blended rate.",
    derive: (ctx) => [
      { label: "Cumulative revenue", value: formatUsdShort(ctx.result.totals.revenueUsd) },
      { label: "Gross margin", value: `${ctx.input.grossMarginPct}%` },
      { label: "Gross profit", value: formatUsdShort(ctx.result.totals.grossProfitUsd) },
    ],
  },
  {
    key: "pf.arpu",
    title: "Price per state",
    short:
      "Average monthly licence per adopting state at cohort par, escalating on each contract anniversary.",
    formula: "Monthly fee = ARPU × cohort multiplier × (1 + escalator)^anniversaries.",
    basis:
      "Expansion cohorts price off the Caribbean par: Pacific below it, West Africa above it, reflecting economy size.",
    caveat: "One blended ARPU stands in for tiering by chamber count and population.",
    derive: (ctx) => [
      { label: "ARPU at par", value: `${formatUsdShort(ctx.input.arpuUsdMonth)} / month` },
      { label: "Onboarding fee", value: formatUsdShort(ctx.input.onboardingFeeUsd) },
      { label: "Annual escalator", value: `${ctx.input.escalatorPct}%` },
      ...ctx.input.cohorts.map((c) => ({
        label: COHORT_LABEL[c.key],
        value: `× ${c.arpuMultiplier.toFixed(2)}`,
        note: `${formatUsdShort(ctx.input.arpuUsdMonth * c.arpuMultiplier)} / month at signature`,
      })),
    ],
  },
];

registerRationales(ENTRIES as unknown as Array<Rationale<never>>);
