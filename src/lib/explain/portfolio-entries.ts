// @domain explain
// @tables none
// @ui src/components/portfolio/MinisterGdpExposureCurve.tsx

import { registerRationales, type Rationale } from "@/lib/explain/registry";

type PortfolioExposureContext = {
  points: Array<{ portfolio: string; minister: string | null; sectorCount: number; gdp: number }>;
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
        label: point.minister ?? point.portfolio,
        value: point.gdp > 0 ? `${point.gdp.toFixed(1)}%` : "Not measured",
        note: `${point.sectorCount} mapped sector${point.sectorCount === 1 ? "" : "s"}`,
      })) ?? [],
  },
];

registerRationales(entries);
export default entries;
