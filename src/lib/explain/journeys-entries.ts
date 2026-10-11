// @domain explain
// @tables none
// @ui src/components/marketing/journeys/ChamberRouter.tsx

import { registerRationales, type Rationale } from "@/lib/explain/registry";

const entries: Array<Rationale<Record<string, never>>> = [
  {
    key: "journeys.fit",
    title: "How the Chamber fit is shown",
    short: "Illustrative fit — not a measured score.",
    formula:
      "Lead Chamber = the Chamber built for this question. Supporting Chambers = those the journey actually passes through. All others sit low.",
    basis: "Derived from the scenario's own route through the decision flow map.",
    caveat:
      "In the live platform, routing is decided by the user and the question, not by this bar.",
    derive: () => [],
  },
  {
    key: "journeys.clock",
    title: "What the decision clock means",
    short: "Illustrative time to decision, not a measurement.",
    formula:
      "Usual time = typical experience described by government teams. With GDPVision = the same work with evidence already assembled.",
    basis: "Indicative only; not measured for any specific country.",
    caveat: "Actual time depends on how complete the national record is.",
    derive: () => [],
  },
];

registerRationales(entries as never);
