// @domain explain
// @tables none
// @ui src/components/calculator/ValueCalculator.tsx
//
// Rationale entries for the Sovereign Value Instrument. Every line here reads
// from `computeValue`'s output — nothing recomputes the model, so the modal can
// never disagree with the verdict.

import {
  CHAMBER_COEFFICIENTS,
  POOL_LABEL,
  RAMP,
  STANCE_LABEL,
  STANCE_MULTIPLIER,
  UPLIFT_CEILING_PCT_OF_GDP,
  adoptionLabel,
  formatUsd,
  formatUsdExact,
  type PoolKey,
  type ValueInput,
  type ValueResult,
} from "@/lib/calculator/model";
import { registerRationales, type DerivedLine, type Rationale } from "@/lib/explain/registry";

export interface CalcCtx {
  input: ValueInput;
  result: ValueResult;
  countryName: string;
}

const pct = (v: number) => `${Math.round(v * 100)}%`;

function stanceLine(ctx: CalcCtx): DerivedLine {
  return {
    label: `Stance · ${STANCE_LABEL[ctx.input.stance]}`,
    value: `× ${STANCE_MULTIPLIER[ctx.input.stance].toFixed(2)}`,
    note: "Applied to every chamber contribution and to the ceiling alike.",
  };
}

const POOL_RULE: Record<PoolKey, string> = {
  latency:
    "Public expenditure × (latency months − 1) ÷ 17, capped at 1 × 8%. A one-month cycle releases nothing; eighteen months releases the full 8%.",
  unmeasured: "Public expenditure × the share of programme spend with no measured outcome.",
  commitment: "Public expenditure × (decisions per quarter ÷ 120), capped at 1 × 5%.",
  fdi: "Nominal GDP × 2%, held deliberately flat rather than scaled to ambition.",
  concentration: "Nominal GDP × (top-sector share − 25 percentage points), floored at zero.",
};

const POOL_CAVEAT: Record<PoolKey, string> = {
  latency:
    "This is value held up, not value destroyed. If your Cabinet already decides on one agreed set of numbers, set latency low and the pool collapses.",
  unmeasured:
    "Spend without a measured outcome is not wasted spend. The model claims only a recoverable fraction of it, never the whole.",
  commitment:
    "A high decision cadence with strong follow-through already banks this value. The pool assumes the follow-through is the weak link.",
  fdi: "Two per cent of GDP is a conservative addressable pool for a small open economy. Larger pipelines are not modelled.",
  concentration:
    "Concentration below 25 per cent of output is treated as normal specialisation, not exposure.",
};

function poolEntry(pool: PoolKey): Rationale<CalcCtx> {
  return {
    key: `calc.pool.${pool}`,
    title: POOL_LABEL[pool],
    short: `An addressable pool the chambers draw against. ${POOL_RULE[pool]}`,
    formula: POOL_RULE[pool],
    basis: "Pools size the loss. Chambers claim a stated, bounded fraction of them — never the whole pool.",
    caveat: POOL_CAVEAT[pool],
    derive: (ctx) => [
      {
        label: "Nominal GDP",
        value: formatUsdExact(ctx.input.gdpUsd),
      },
      {
        label: `Public expenditure (${ctx.input.publicSpendPct}% of GDP)`,
        value: formatUsdExact((ctx.input.gdpUsd * ctx.input.publicSpendPct) / 100),
      },
      {
        label: "Pool, per year",
        value: formatUsdExact(ctx.result.pools[pool]),
        note: `${((ctx.result.pools[pool] / Math.max(ctx.input.gdpUsd, 1)) * 100).toFixed(2)}% of GDP`,
      },
    ],
  };
}

function chamberEntry(index: string): Rationale<CalcCtx> {
  const c = CHAMBER_COEFFICIENTS.find((x) => x.index === index)!;
  return {
    key: `calc.chamber.${index}`,
    title: `${c.index} · ${c.short}`,
    short: `${c.mechanism}. Claims a stated share of ${c.draws.map((d) => POOL_LABEL[d.pool].toLowerCase()).join(" and ")}.`,
    formula:
      "Contribution = Σ (pool × recoverable share) × adoption × stance, then scaled by the ceiling.",
    basis: c.basis,
    caveat:
      "Adoption is the honest lever. A chamber that is piloted rather than institutionalised earns a quarter of what it could.",
    derive: (ctx) => {
      const contribution = ctx.result.chambers.find((x) => x.index === index);
      const adoption = Math.min(100, Math.max(0, ctx.input.chambers[index] ?? 0));
      const lines: DerivedLine[] = c.draws.map((d) => ({
        label: POOL_LABEL[d.pool],
        value: `${formatUsdExact(ctx.result.pools[d.pool])} × ${pct(d.share)}`,
        note: `= ${formatUsdExact(ctx.result.pools[d.pool] * d.share)} at full institutionalisation`,
      }));
      lines.push({
        label: `Adoption · ${adoptionLabel(adoption)}`,
        value: `× ${(adoption / 100).toFixed(2)}`,
      });
      lines.push(stanceLine(ctx));
      lines.push({
        label: "Contribution, year three",
        value: contribution && contribution.usd > 0 ? formatUsdExact(contribution.usd) : "—",
        note:
          contribution && contribution.share > 0
            ? `${(contribution.share * 100).toFixed(1)}% of the total verdict, after the ceiling is applied`
            : "This chamber is not adopted, so it contributes nothing.",
      });
      return lines;
    },
  };
}

const QUESTION_ENTRIES: Array<Rationale<CalcCtx>> = [
  {
    key: "calc.q.decisionsPerQuarter",
    title: "GDP-moving decisions per quarter",
    short: "Sets the follow-through pool: the more a Cabinet decides, the more there is to lose between decision and delivery.",
    formula: "Follow-through pool = public expenditure × (decisions ÷ 120), capped at 1 × 5%.",
    basis: "Cadence is a proxy for exposure. A Cabinet taking 120 GDP-moving decisions a quarter carries the full 5% at risk.",
    caveat: "Count only decisions that commit capital, change an incentive, or reallocate a programme.",
    derive: (ctx) => [
      { label: "Your answer", value: `${ctx.input.decisionsPerQuarter} per quarter` },
      { label: "Follow-through pool", value: formatUsdExact(ctx.result.pools.commitment) },
    ],
  },
  {
    key: "calc.q.latencyMonths",
    title: "Months from question asked to decision taken",
    short: "Sets the latency pool — the value held up while numbers are reconciled rather than acted on.",
    formula: "Latency pool = public expenditure × (months − 1) ÷ 17 × 8%.",
    basis: "One month is treated as frictionless. Eighteen months releases the full 8% band.",
    caveat: "Count reconciliation time, not deliberation time. Deliberation is the job; reconciliation is the tax.",
    derive: (ctx) => [
      { label: "Your answer", value: `${ctx.input.latencyMonths} months` },
      { label: "Latency pool", value: formatUsdExact(ctx.result.pools.latency) },
    ],
  },
  {
    key: "calc.q.unmeasuredPct",
    title: "Programme spend with no measured outcome",
    short: "Sets the reallocation pool. Chambers 02, 07 and 08 claim small, stated fractions of it.",
    formula: "Unmeasured pool = public expenditure × your percentage.",
    basis: "Money disbursed and reported, but never scored against a stated result.",
    caveat: "Unmeasured is not wasted. At most 24% of this pool is ever claimed, across three chambers combined.",
    derive: (ctx) => [
      { label: "Your answer", value: `${ctx.input.unmeasuredPct}% of public spend` },
      { label: "Unmeasured pool", value: formatUsdExact(ctx.result.pools.unmeasured) },
    ],
  },
  {
    key: "calc.q.topSectorSharePct",
    title: "Share of output in your largest sector",
    short: "Sets the concentration pool — output exposed above a 25 per cent single-sector threshold.",
    formula: "Concentration pool = GDP × (share − 25pp), floored at zero.",
    basis: "Below a quarter of output, single-sector weight is specialisation. Above it, it is exposure.",
    caveat: "Only Chamber 04 draws on this, and at 6 per cent — de-risking is slow work.",
    derive: (ctx) => [
      { label: "Your answer", value: `${ctx.input.topSectorSharePct}% of GDP` },
      { label: "Exposed above threshold", value: formatUsdExact(ctx.result.pools.concentration) },
    ],
  },
];

const CORE_ENTRIES: Array<Rationale<CalcCtx>> = [
  {
    key: "calc.uplift",
    title: "Modelled uplift, year three",
    short:
      "The sum of every adopted chamber's contribution, soft-capped at 1.2 per cent of GDP. A decision-framing figure, not a forecast.",
    formula:
      "Uplift = ceiling × (1 − e^(−raw ÷ ceiling)), where raw is the sum of chamber contributions and ceiling = GDP × 1.2% × stance.",
    basis:
      "The soft cap is monotone — more adoption always adds something — but it approaches the ceiling instead of crossing it. An over-claiming calculator destroys the argument it sits beside.",
    caveat:
      "This is year three, at the adoption levels you set. Year one lands at 35 per cent of it.",
    derive: (ctx) => [
      { label: "Raw sum of chamber contributions", value: formatUsdExact(ctx.result.rawUsd) },
      stanceLine(ctx),
      {
        label: `Ceiling (${UPLIFT_CEILING_PCT_OF_GDP}% of GDP × stance)`,
        value: formatUsdExact(
          ctx.input.gdpUsd * (UPLIFT_CEILING_PCT_OF_GDP / 100) * STANCE_MULTIPLIER[ctx.input.stance],
        ),
      },
      {
        label: "Uplift after soft cap",
        value: formatUsdExact(ctx.result.upliftUsd),
        note: `${ctx.result.upliftPpOfGdp.toFixed(2)} percentage points of GDP`,
      },
      {
        label: "Chambers adopted",
        value: `${ctx.result.adoptedCount} of ${CHAMBER_COEFFICIENTS.length}`,
      },
    ],
  },
  {
    key: "calc.pp",
    title: "Uplift as percentage points of GDP",
    short: "The same figure expressed against your economy, so it can be compared across countries of any size.",
    formula: "pp of GDP = year-three uplift ÷ nominal GDP × 100.",
    basis: "No configuration may exceed 1.2 percentage points at the central stance. The optimistic stance lifts that ceiling to 1.74.",
    caveat: "Absolute dollars flatter large economies; percentage points flatter small ones. Read both.",
    derive: (ctx) => [
      { label: "Uplift, year three", value: formatUsdExact(ctx.result.upliftUsd) },
      { label: "Nominal GDP", value: formatUsdExact(ctx.input.gdpUsd) },
      { label: "Result", value: `${ctx.result.upliftPpOfGdp.toFixed(2)} pp of GDP` },
    ],
  },
  {
    key: "calc.return",
    title: "Return multiple",
    short: "Year-three uplift divided by the annual cost of the instrument at your adoption level.",
    formula: "Return = year-three uplift ÷ annual cost.",
    basis: "Compared against the recurring annual cost, not the year-one cost, because the uplift is also recurring.",
    caveat: "A high multiple on a low base is still a low number. Read it beside the absolute uplift.",
    derive: (ctx) => [
      { label: "Uplift, year three", value: formatUsdExact(ctx.result.upliftUsd) },
      { label: "Annual cost", value: formatUsdExact(ctx.result.annualCostUsd) },
      {
        label: "Return",
        value: ctx.result.returnMultiple >= 1 ? `${ctx.result.returnMultiple.toFixed(1)}×` : "—",
      },
    ],
  },
  {
    key: "calc.payback",
    title: "Payback period",
    short: "How long the year-one uplift takes to cover the year-one cost, including implementation.",
    formula: "Payback months = year-one cost ÷ (year-one uplift ÷ 12).",
    basis: "Year one is deliberately the hardest test: the cost carries a 40 per cent implementation uplift while the benefit runs at 35 per cent of maturity.",
    caveat: "Shown as '—' beyond ten years, or where nothing is adopted.",
    derive: (ctx) => [
      { label: "Year-one cost", value: formatUsdExact(ctx.result.yearOneCostUsd) },
      {
        label: "Year-one uplift (35% ramp)",
        value: formatUsdExact(ctx.result.path[0]?.usd ?? 0),
      },
      {
        label: "Payback",
        value:
          ctx.result.paybackMonths === null || ctx.result.paybackMonths >= 120
            ? "—"
            : `${Math.round(ctx.result.paybackMonths)} months`,
      },
    ],
  },
  {
    key: "calc.cost",
    title: "Annual cost of the instrument",
    short: "A base platform charge plus a per-chamber charge for each chamber actually stood up.",
    formula: "Annual = US$300,000 + US$95,000 × chambers adopted. Year one carries a 40% implementation uplift.",
    basis: "A chamber counts as adopted at 10 per cent or more. Piloting a chamber costs the same as running it.",
    caveat: "An indicative band for modelling, not a quotation. Scope, data condition and pace all move it.",
    derive: (ctx) => [
      { label: "Base", value: formatUsdExact(300_000) },
      {
        label: `Chambers adopted (${ctx.result.adoptedCount} × US$95,000)`,
        value: formatUsdExact(ctx.result.adoptedCount * 95_000),
      },
      { label: "Annual cost", value: formatUsdExact(ctx.result.annualCostUsd) },
      {
        label: "Year one, with implementation",
        value: formatUsdExact(ctx.result.yearOneCostUsd),
        note: "Annual × 1.4",
      },
    ],
  },
  {
    key: "calc.path",
    title: "The three-year path",
    short: "Chambers land over three years. The ramp is fixed at 35, 75 and 100 per cent of the year-three figure.",
    formula: `Year n uplift = year-three uplift × ramp[n], ramp = ${RAMP.join(" / ")}.`,
    basis: "Institutionalisation is slower than installation. The ramp encodes that, rather than assuming day-one maturity.",
    caveat: "The ramp is not sensitive to how many chambers you adopt — sequencing changes the shape in practice.",
    derive: (ctx) =>
      ctx.result.path.map((p, i) => ({
        label: `Year ${p.year}`,
        value: formatUsdExact(p.usd),
        note: `${Math.round(RAMP[i] * 100)}% of the year-three figure`,
      })),
  },
  {
    key: "calc.stance",
    title: "Stance",
    short: "One multiplier applied to every contribution and to the ceiling: conservative 0.60, central 1.00, optimistic 1.45.",
    formula: "Every chamber contribution × stance; ceiling = GDP × 1.2% × stance.",
    basis:
      "Rather than three sets of coefficients, one honest multiplier — so the difference between the cases is visible instead of buried.",
    caveat: "Present the conservative case. If the conservative case does not carry, the argument is not ready.",
    derive: (ctx) => [
      stanceLine(ctx),
      {
        label: "Conservative would give",
        value: formatUsd(
          (ctx.result.upliftUsd / STANCE_MULTIPLIER[ctx.input.stance]) * STANCE_MULTIPLIER.conservative,
        ),
        note: "Approximate — the ceiling moves with the stance too.",
      },
    ],
  },
  {
    key: "calc.ceiling",
    title: "The 1.2 per cent ceiling",
    short: "No configuration of sliders may claim more than 1.2 per cent of GDP at the central stance. The cap is soft, not a clip.",
    formula: "Uplift = ceiling × (1 − e^(−raw ÷ ceiling)). Every chamber is then scaled by uplift ÷ raw.",
    basis:
      "The exponential form keeps the model monotone and continuous: adding adoption always adds value, and no single chamber can be made to dominate by pushing one slider.",
    caveat:
      "If your raw sum is far above the ceiling, the marginal value of further adoption is small — which is itself the finding.",
    derive: (ctx) => {
      const ceiling =
        ctx.input.gdpUsd * (UPLIFT_CEILING_PCT_OF_GDP / 100) * STANCE_MULTIPLIER[ctx.input.stance];
      return [
        { label: "Raw sum", value: formatUsdExact(ctx.result.rawUsd) },
        { label: "Ceiling", value: formatUsdExact(ceiling) },
        {
          label: "Scaling applied to every chamber",
          value: ctx.result.rawUsd > 0 ? `× ${(ctx.result.upliftUsd / ctx.result.rawUsd).toFixed(3)}` : "—",
        },
        { label: "Capped uplift", value: formatUsdExact(ctx.result.upliftUsd) },
      ];
    },
  },
  {
    key: "calc.preset",
    title: "Reference economy",
    short: "Order-of-magnitude seeds for GDP, public expenditure and sector concentration. Every one of them is editable.",
    formula: "Selecting a reference economy sets three sliders. It does nothing else.",
    basis: "Published national accounts, rounded hard. The model never depends on the preset being exact.",
    caveat: "If you know your own figures, set them. The verdict follows the sliders, not the country name.",
    derive: (ctx) => [
      { label: "Selected", value: ctx.countryName },
      { label: "Nominal GDP", value: formatUsdExact(ctx.input.gdpUsd) },
      { label: "Public expenditure", value: `${ctx.input.publicSpendPct}% of GDP` },
      { label: "Top sector share", value: `${ctx.input.topSectorSharePct}% of GDP` },
    ],
  },
  {
    key: "calc.gdp",
    title: "Nominal GDP",
    short: "The base every pool and the ceiling are measured against.",
    formula: "Pools scale linearly with GDP; the ceiling is 1.2% of it.",
    basis: "Nominal, current prices, in US dollars — the unit a Principal argues in.",
    caveat: "Doubling GDP roughly doubles the verdict. Comparison across economies should use the pp-of-GDP figure.",
    derive: (ctx) => [
      { label: "Nominal GDP", value: formatUsdExact(ctx.input.gdpUsd) },
      {
        label: "Ceiling at this GDP (central)",
        value: formatUsdExact(ctx.input.gdpUsd * (UPLIFT_CEILING_PCT_OF_GDP / 100)),
      },
    ],
  },
  {
    key: "calc.publicSpend",
    title: "Public expenditure",
    short: "General government spending as a share of GDP. It sizes three of the five pools.",
    formula: "Public expenditure = GDP × your percentage. Latency, unmeasured and follow-through pools all derive from it.",
    basis: "Clamped to a 5–60 per cent band, because outside it the pool logic stops describing a real fiscal state.",
    caveat: "Include transfers and programme spend; the model treats all of it as addressable in principle.",
    derive: (ctx) => [
      { label: "Share of GDP", value: `${ctx.input.publicSpendPct}%` },
      {
        label: "Public expenditure",
        value: formatUsdExact((ctx.input.gdpUsd * ctx.input.publicSpendPct) / 100),
      },
      { label: "Latency pool", value: formatUsdExact(ctx.result.pools.latency) },
      { label: "Unmeasured pool", value: formatUsdExact(ctx.result.pools.unmeasured) },
      { label: "Follow-through pool", value: formatUsdExact(ctx.result.pools.commitment) },
    ],
  },
  {
    key: "calc.waterfall",
    title: "Attribution by chamber",
    short: "How the capped verdict divides across the chambers you have stood up.",
    formula: "Each chamber's share = its scaled contribution ÷ the capped total.",
    basis: "Attribution is computed after the ceiling, so the shares always sum to the verdict — never to more than it.",
    caveat: "Shares move when you change any slider, not only the chamber's own.",
    derive: (ctx) =>
      ctx.result.chambers
        .filter((c) => c.usd > 0)
        .sort((a, b) => b.usd - a.usd)
        .map((c) => ({
          label: `${c.index} · ${c.short}`,
          value: formatUsdExact(c.usd),
          note: `${(c.share * 100).toFixed(1)}% of the verdict · ${adoptionLabel(c.adoption)}`,
        })),
  },
  {
    key: "calc.counsel",
    title: "How the counsel is produced",
    short:
      "A language model reads the arithmetic you have already produced and interprets it. It computes nothing and it does not browse the web.",
    formula:
      "Model input = your slider configuration plus the computed verdict, chamber contributions and mechanisms. Model output = prose only.",
    basis:
      "Keeping the model outside the arithmetic is deliberate: the verdict must be reproducible, and a language model is not. If the counsel service fails, every number on this page is unchanged.",
    caveat:
      "Treat the counsel as a reading, not as evidence. Where it names a figure, that figure came from the model above it — check it against the arithmetic.",
    derive: (ctx) => [
      { label: "Economy passed to the model", value: ctx.countryName },
      { label: "Verdict passed to the model", value: formatUsdExact(ctx.result.upliftUsd) },
      { label: "Stance passed to the model", value: STANCE_LABEL[ctx.input.stance] },
      {
        label: "Highest-leverage chamber (computed, not authored)",
        value: ctx.result.highestLeverageIndex
          ? `${ctx.result.highestLeverageIndex} · ${
              CHAMBER_COEFFICIENTS.find((c) => c.index === ctx.result.highestLeverageIndex)?.short ?? ""
            }`
          : "—",
        note: "Found by probing each chamber one notch (+25) and keeping the largest gain.",
      },
    ],
  },
];

export const CALCULATOR_RATIONALES: Array<Rationale<CalcCtx>> = [
  ...CORE_ENTRIES,
  ...QUESTION_ENTRIES,
  ...(Object.keys(POOL_LABEL) as PoolKey[]).map(poolEntry),
  ...CHAMBER_COEFFICIENTS.map((c) => chamberEntry(c.index)),
];

registerRationales(CALCULATOR_RATIONALES as Array<Rationale<never>>);
