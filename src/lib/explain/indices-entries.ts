// @domain explain
// @tables none
// @ui src/components/indices/admin/SextantRadar.tsx
//
// Rationales for the Caribbean Indices ("indices.*"). Mirrors the Sextant rule in
// src/lib/indices/scoring.ts and must change with it.

import { registerRationales, type Rationale } from "@/lib/explain/registry";

const entries: Array<Rationale<never>> = [
  {
    key: "indices.sextant",
    title: "What the Sextant measures",
    short:
      "How well-measured the inputs behind a score are, 0–100. It does not change the score itself.",
    formula:
      "Sextant = 30% availability + 25% timeliness + 30% grade quality + 15% source health. The card shows the median across states in the latest complete run, and the radar shows the median of each part.",
    basis:
      "Availability: share of specified indicators with a valid value. Timeliness: input age against each indicator's tolerance. Grade quality: A = 100, B = 75, C = 50, D = 25. Source health: share of sources that answered on the run.",
    caveat:
      "Colour: red below 50, yellow from 50 to 61, green from 62 up, darker toward each end. Bands: clear ≥ 80, fair ≥ 60, hazy ≥ 40, obscured below.",
  },
];

registerRationales(entries);
