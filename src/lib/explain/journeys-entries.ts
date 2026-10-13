// @domain explain
// @tables none
// @ui src/components/marketing/journeys/ChamberRouter.tsx

import { registerRationales, type Rationale } from "@/lib/explain/registry";

const entries: Array<Rationale<Record<string, never>>> = [
  {
    key: "journeys.fit",
    title: "Why this workspace leads the example",
    short: "An example route, not a measured suitability score.",
    formula:
      "Lead Chamber = the Chamber built for this question. Supporting Chambers = those the journey actually passes through. All others sit low.",
    basis: "Derived from the scenario's own route through the decision flow map.",
    caveat:
      "In the live platform, routing is decided by the user and the question, not by this bar.",
    derive: () => [],
  },
  {
    key: "journeys.clock",
    title: "What the illustrative time comparison means",
    short: "Illustrative time to decision, not a measurement.",
    formula:
      "The two times illustrate a possible difference when evidence is prepared. They are not measured before-and-after results.",
    basis: "Indicative only; not measured for any specific country.",
    caveat: "Actual time depends on available evidence, review requirements and government processes; no saving is promised.",
    derive: () => [],
  },
];

registerRationales(entries as never);
