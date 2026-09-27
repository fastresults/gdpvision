// @domain explain
// @tables none
// @ui src/components/portfolio/MinisterGdpExposureCurve.tsx

import { registerRationales, type Rationale } from "@/lib/explain/registry";

type PortfolioExposureContext = {
  points: Array<{ name: string; minister: string | null; sectorCount: number; gdp: number }>;
};

type DeliveryContext = {
  qualified: number;
  unscored: number;
  warningTolerancePct?: number;
  criticalTolerancePct?: number;
};

const entries: Array<Rationale<PortfolioExposureContext | DeliveryContext>> = [
  {
    key: "portfolio.gdp-exposure",
    title: "How portfolio GDP exposure is calculated",
    short:
      "Each minister’s value sums the recorded GDP shares of every sector mapped to that portfolio.",
    formula: "Portfolio GDP exposure = Σ GDP share of each sector mapped to the ministry.",
    basis:
      "Sector shares come from the country’s GDP composition record. Ministry-to-sector mappings come from the portfolio map created during country onboarding.",
    caveat:
      "This is exposure under portfolio influence, not legal control, spending power or personal performance. Shared sectors appear under more than one ministry, so minister percentages overlap and must not be added together.",
    derive: (ctx) =>
      "points" in ctx
        ? ctx.points.map((point) => ({
            label: point.minister ?? point.name,
            value: point.gdp > 0 ? `${point.gdp.toFixed(1)}%` : "Not measured",
            note: `${point.sectorCount} mapped sector${point.sectorCount === 1 ? "" : "s"}`,
          }))
        : [],
  },
  {
    key: "portfolio.delivery-status",
    title: "How delivery status is qualified",
    short:
      "Only independently qualified ministry KPIs with current evidence, an actual result and a governed target receive a delivery status.",
    formula:
      "Expected now = baseline + (target − baseline) × elapsed share of target period. Direction-adjusted gap is compared with the KPI’s approved warning and critical tolerances.",
    basis:
      "Each KPI must name its ministry, baseline period, target date, direction, cadence, target basis and evidence reference. The latest reported actual must still be current for its cadence.",
    caveat:
      "Unqualified, incomplete or stale KPIs remain Unscored. Scores are not inferred from country macro indicators, synthetic histories or keyword matches.",
    derive: (context) => [
      { label: "Qualified", value: String("qualified" in context ? context.qualified : 0) },
      { label: "Unscored", value: String("unscored" in context ? context.unscored : 0) },
      {
        label: "Default bands",
        value: `${"warningTolerancePct" in context ? (context.warningTolerancePct ?? 10) : 10}% / ${"criticalTolerancePct" in context ? (context.criticalTolerancePct ?? 20) : 20}%`,
        note: "Each ratified KPI may set stricter approved tolerances.",
      },
    ],
  },
  {
    key: "portfolio.scorecard-proposal",
    title: "How an AI-drafted KPI is checked",
    short: "Proposals are drafted only from this country’s stored indicators, mapped sectors and mandate, then checked in code.",
    formula: "Baseline = stored latest value of the linked indicator (AI value overwritten if different). Peer median = Caribbean peer benchmark for the same indicator.",
    basis: "Indicators come from the national ledger; peer medians from the monthly regional benchmark run.",
    caveat: "Proposals without a linked indicator or source link are labelled Inferred. Nothing is scored until a second authorised person qualifies it.",
    derive: (ctx) => {
      const p = ctx as unknown as { source_kpi_code?: string | null; baseline?: number | null; peer_median?: number | null; inferred?: boolean };
      return [
        { label: "Linked indicator", value: p.source_kpi_code ?? "None" },
        { label: "Baseline", value: p.baseline == null ? "—" : String(p.baseline) },
        { label: "Peer median", value: p.peer_median == null ? "—" : p.peer_median.toFixed(2) },
        { label: "Inferred", value: p.inferred ? "Yes" : "No" },
      ];
    },
  },
  {
    key: "portfolio.scorecard-coverage",
    title: "Measurement coverage",
    short: "Share of a country’s ministries that have at least one qualified delivery KPI.",
    formula: "Coverage = ministries with ≥1 qualified KPI ÷ all ministries. Stale = qualified KPIs whose latest actual is overdue for its cadence.",
    basis: "Computed live from the KPI register and reported actuals.",
    caveat: "Coverage measures readiness to be scored, not performance.",
    derive: (ctx) => {
      const c = ctx as unknown as { qualifiedMinistries?: number; ministries?: number; stale?: number };
      return [
        { label: "Covered ministries", value: `${c.qualifiedMinistries ?? 0} / ${c.ministries ?? 0}` },
        { label: "Stale KPIs", value: String(c.stale ?? 0) },
      ];
    },
  },
];

registerRationales(entries);
export default entries;
