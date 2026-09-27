// @domain explain
// @tables none
// @ui src/components/studio/ConcentrationViews.tsx

import { registerRationales, type Rationale } from "@/lib/explain/registry";

type Ctx = { hhi: number; n50: number; n80: number; total: number; top?: string; topPct?: number };

const entries: Array<Rationale<Ctx>> = [
  {
    key: "fdi.hhi",
    title: "What the concentration index (HHI) means",
    short:
      "HHI adds up the squared GDP share of every sector. Higher means the economy leans on fewer sectors.",
    formula: "HHI = Σ (sector share of GDP)², shares as fractions. 1/N = perfectly even, 1.0 = single sector.",
    basis: "Sector shares come from the country's recorded GDP composition.",
    caveat:
      "Below ~0.15 is broadly diversified, 0.15–0.25 moderately concentrated, above 0.25 highly concentrated. Small economies are naturally more concentrated.",
    derive: (c) => [
      { label: "HHI", value: c.hhi.toFixed(3) },
      { label: "Sectors recorded", value: String(c.total) },
      ...(c.top ? [{ label: "Top sector", value: `${c.top} ${c.topPct?.toFixed(1)}%` }] : []),
    ],
  },
  {
    key: "fdi.concentration-curve",
    title: "How to read the concentration curve",
    short:
      "Sectors are ordered largest first and their GDP shares added up. The faster the curve rises, the more concentrated the economy.",
    formula: "Point k = Σ share of the k largest sectors. Diagonal = every sector equal size.",
    basis: "Uses the same sector GDP shares as the bars and treemap.",
    caveat: "Shares that don't sum to exactly 100% are shown as recorded; the curve is not rescaled.",
    derive: (c) => [
      { label: "Sectors to reach 50% of GDP", value: String(c.n50) },
      { label: "Sectors to reach 80% of GDP", value: String(c.n80) },
      { label: "Sectors recorded", value: String(c.total) },
    ],
  },
];

registerRationales(entries as never);
export default entries;
