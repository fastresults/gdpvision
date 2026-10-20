// @domain marketing
// @tables none
// @ui src/components/present/PresentDeck.tsx
//
// Presenter data for the ten chambers in the live briefing at /present:
// the live route to embed for the demonstration country, the question the
// chamber answers, and the three stages drawn in its circuit animation.

/** The demonstration country shown in the briefing. */
export const DEMO_COUNTRY = "ATG";

export interface ChamberDemo {
  index: string;
  /** Live route inside gdpvision.com, embedded in the briefing. */
  path: string;
  /** The question the chamber exists to answer. */
  ask: string;
  /** Three stages the data passes through, left to right. */
  stages: [string, string, string];
  /** What comes out the other side. */
  output: string;
}

const base = `/admin/countries/${DEMO_COUNTRY}`;

export const CHAMBER_DEMOS: ChamberDemo[] = [
  {
    index: "01",
    path: `${base}/ledger`,
    ask: "What can the nation prove?",
    stages: ["Source", "Method and grade", "Date"],
    output: "A figure Cabinet can rely on",
  },
  {
    index: "02",
    path: `${base}/portfolio`,
    ask: "Where does this portfolio move growth?",
    stages: ["Sector links", "Delivery measures", "Data strength"],
    output: "The minister's options, in one view",
  },
  {
    index: "03",
    path: `${base}/scenarios`,
    ask: "What happens if we commit?",
    stages: ["Policy levers", "GDP, debt, FX, budget", "The target"],
    output: "The combination most likely to get there",
  },
  {
    index: "04",
    path: `${base}/investments`,
    ask: "What replaces the exposed revenue?",
    stages: ["The gap, year by year", "Investment packages", "Readiness test"],
    output: "Propositions an investor can act on",
  },
  {
    index: "05",
    path: `${base}/narrative`,
    ask: "What do we say, and can we defend it?",
    stages: ["New signals", "The prior record", "Sourced draft"],
    output: "A position a principal has approved",
  },
  {
    index: "06",
    path: `${base}/cabinet`,
    ask: "What did Cabinet decide, and who owns it?",
    stages: ["Options side by side", "Decision and conditions", "Delivery pace"],
    output: "An owned commitment, visible between sessions",
  },
  {
    index: "07",
    path: `${base}/personas`,
    ask: "Will people understand and accept it?",
    stages: ["Approved brief", "Guided study", "Traceable findings"],
    output: "Policy that lands the first time",
  },
  {
    index: "08",
    path: `${base}/mandate-compact`,
    ask: "Is the mandate being delivered?",
    stages: ["Pledges to pillars", "Owners and dates", "Quarterly record"],
    output: "Results each ministry reports on",
  },
  {
    index: "09",
    path: `${base}/egov`,
    ask: "What should the platform do for people?",
    stages: ["Audiences and services", "Cited requirements", "Independent approval"],
    output: "Services people can trust",
  },
  {
    index: "10",
    path: `${base}/studio`,
    ask: "Which sectors can move growth?",
    stages: ["Rank from the data", "Head of Government's choice", "Roadmap"],
    output: "An accountable growth plan per sector",
  },
];

export function chamberDemo(index: string): ChamberDemo | undefined {
  return CHAMBER_DEMOS.find((c) => c.index === index);
}
