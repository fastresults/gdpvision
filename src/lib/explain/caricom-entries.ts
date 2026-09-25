// @domain explain
// @tables none
// @ui src/components/home/BlocEconomicSummaryModal.tsx

import { registerRationales, type Rationale } from "@/lib/explain/registry";

const entries: Array<Rationale<never>> = [
  {
    key: "caricom.bloc-summary",
    title: "How bloc figures are calculated",
    short:
      "Totals, weighted averages and medians use current, comparable public readings with at least 70% member coverage.",
    formula:
      "Population is summed. Comparable GDP is implied from each member's normalized population and GDP-per-person readings, then summed. GDP growth is GDP-weighted; GDP per person is population-weighted. Ratios use the median.",
    basis:
      "Membership follows the GDPVision CARICOM/OECS registry. Projected, blank, incompatible-unit and materially stale readings are excluded by the same scrub used for Caribbean peer comparisons.",
    caveat:
      "CARICOM and OECS overlap, so their figures must not be added together. Each chart reports its own coverage and comparison period.",
  },
  {
    key: "caricom.bloc-gap",
    title: "How the bloc comparison is interpreted",
    short:
      "The comparison describes scale, rates and member spread separately; it does not collapse them into an opaque strength score.",
    basis:
      "The larger current value is identified on a shared scale. Member distributions show whether that bloc-level reading is broad-based or driven by a small number of economies.",
    caveat:
      "A larger value is not always better. Debt and unemployment are burdens, while growth and GDP per person generally describe positive capacity.",
  },
];

registerRationales(entries);
