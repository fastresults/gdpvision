// @domain explain
// @tables none
// @ui src/routes/record.tsx

import { registerRationales, type Rationale } from "@/lib/explain/registry";

const entries: Array<Rationale<Record<string, never>>> = [
  {
    key: "record.counters",
    title: "How the record totals are counted",
    short: "Live counts of public items in the record for the chosen country.",
    formula:
      "Sources = public data sources on file. Passages = public searchable passages read from those sources. Figures = public tracked measures; Verified = those confirmed against their source.",
    basis:
      "Counted directly from the public part of the national record, refreshed every ten minutes.",
    caveat:
      "Restricted government records and Sovereign Vault data are never counted or shown here.",
    derive: () => [],
  },
  {
    key: "record.grade-ring",
    title: "How the grade mix is worked out",
    short: "Share of the headline figures at each confidence grade.",
    formula: "Each slice = figures at that grade ÷ all headline figures shown for the country.",
    basis: "The same graded figures shown in the tiles below.",
    caveat:
      "A large assumption slice means the country's own figures are not yet held, not that the country performs poorly.",
    derive: () => [],
  },
  {
    key: "record.before-after",
    title: "What the before/after bars mean",
    short: "Illustrative comparison, not a measurement.",
    formula: "Bar length shows the relative effort described in each row.",
    basis:
      "Typical experience described by government teams; not measured for any specific country.",
    caveat: "Actual gains depend on how complete the country's record is.",
    derive: () => [],
  },
  {
    key: "record.growth-pathway",
    title: "Why this is not a GDP forecast",
    short: "The line shows a decision pathway, not a predicted rate of economic growth.",
    formula:
      "Trusted evidence → better-targeted decisions → stronger investment, delivery, resilience and productivity conditions.",
    basis:
      "GDPVision supports the quality and speed of decisions; economic results still depend on policy, execution and outside conditions.",
    caveat:
      "No uplift, timetable or causal effect is claimed. A quantified forecast belongs in a country-specific Decision Brief with stated assumptions.",
    derive: () => [],
  },
];

registerRationales(entries as never);
