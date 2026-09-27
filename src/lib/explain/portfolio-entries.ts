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

const entries: Array<Rationale<PortfolioExposureContext>> = [
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
      ctx?.points.map((point) => ({
        label: point.minister ?? point.name,
        value: point.gdp > 0 ? `${point.gdp.toFixed(1)}%` : "Not measured",
        note: `${point.sectorCount} mapped sector${point.sectorCount === 1 ? "" : "s"}`,
      })) ?? [],
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
    derive: (context: DeliveryContext) => [
      { label: "Qualified", value: String(context?.qualified ?? 0) },
      { label: "Unscored", value: String(context?.unscored ?? 0) },
      {
        label: "Default bands",
        value: `${context?.warningTolerancePct ?? 10}% / ${context?.criticalTolerancePct ?? 20}%`,
        note: "Each ratified KPI may set stricter approved tolerances.",
      },
    ],
  },
];

registerRationales(entries);
export default entries;
