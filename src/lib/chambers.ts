// @domain marketing
// @tables none
// @ui src/components/marketing/MarketingHome.tsx, src/routes/op-eds.$slug.tsx
//
// Canonical public-facing description of the ten chambers. Single source of
// truth — the marketing home page and the op-ed landing pages both read it.

import ch01 from "@/assets/chambers/chamber-01.jpg.asset.json";
import ch02 from "@/assets/chambers/chamber-02.jpg.asset.json";
import ch03 from "@/assets/chambers/chamber-03.jpg.asset.json";
import ch04 from "@/assets/chambers/chamber-04.jpg.asset.json";
import ch05 from "@/assets/chambers/chamber-05.jpg.asset.json";
import ch06 from "@/assets/chambers/chamber-06.jpg.asset.json";
import ch07 from "@/assets/chambers/chamber-07.jpg.asset.json";
import ch08 from "@/assets/chambers/chamber-08.jpg.asset.json";

export interface Chamber {
  index: string;
  title: string;
  /** CSS custom property registered in @theme inline of src/styles.css. */
  accentVar: string;
  image?: string;
  purpose: string;
  bullets: string[];
}

export const CHAMBERS: Chamber[] = [
  {
    index: "01",
    title: "The National Ledger",
    accentVar: "--sector-01",
    image: ch01.url,
    purpose: "Know which national figures Cabinet can trust before a decision is framed.",
    bullets: [
      "National and sector evidence, organised over time with confidence grades and sources.",
      "Material exposures and ministry briefings that remain traceable to the underlying record.",
    ],
  },
  {
    index: "02",
    title: "Portfolio Workspaces",
    accentVar: "--sector-03",
    image: ch02.url,
    purpose: "Show each minister where the portfolio influences growth and what delivery requires.",
    bullets: [
      "Portfolio exposure, sector dependencies, delivery measures, and evidence strength in one view.",
      "Ministerial options carried from early analysis through Cabinet adoption and review.",
    ],
  },
  {
    index: "03",
    title: "The Scenario Engine",
    accentVar: "--sector-09",
    image: ch03.url,
    purpose: "Test the economic and delivery consequences of a decision before it is taken.",
    bullets: [
      "Compare credible choices against GDP, debt, foreign exchange, fiscal balance, and confidence.",
      "Set the result Cabinet needs and identify the combination of policy levers most likely to reach it.",
    ],
  },
  {
    index: "04",
    title: "The FDI Transition Studio",
    accentVar: "--sector-07",
    image: ch04.url,
    purpose:
      "Replace exposed revenue with investment propositions capable of creating durable growth.",
    bullets: [
      "Price the revenue gap and the time available to replace it, year by year.",
      "Prepare investment packages and test readiness across law, land, workforce, incentives, and institutions.",
    ],
  },
  {
    index: "05",
    title: "The Narrative Chamber",
    accentVar: "--sector-04",
    image: ch05.url,
    purpose: "Reach a defensible national position quickly when events threaten confidence or growth.",
    bullets: [
      "Signals, context, and prior government knowledge assembled into a cited strategic position.",
      "GDPVision drafts; authorised principals review, decide, and approve every release.",
    ],
  },
  {
    index: "06",
    title: "The Cabinet Room",
    accentVar: "--sector-10",
    image: ch06.url,
    purpose: "Turn Cabinet choices into owned commitments that remain visible between sessions.",
    bullets: [
      "Place approved options side by side and record the decision, conditions, and owner.",
      "Track ratified measures, delivery pace, and intervention needs until the next review.",
    ],
  },
  {
    index: "07",
    title: "The Persona Lab",
    accentVar: "--sector-06",
    image: ch07.url,
    purpose:
      "Test whether a policy or proposition will be understood and accepted before it is released.",
    bullets: [
      "Guided studies for citizens, diaspora, investors, and other priority audiences.",
      "Findings remain bounded by the approved brief and traceable to the evidence collected.",
    ],
  },
  {
    index: "08",
    title: "The Mandate Compact",
    accentVar: "--sector-02",
    image: ch08.url,
    purpose:
      "Turn the government’s mandate into a ministry-owned delivery compact that can be judged each quarter.",
    bullets: [
      "Translate pledges into pillars, measures, deliverables, owners, and review dates.",
      "Preserve approvals, revisions, evidence, and quarterly performance in one accountable record.",
    ],
  },
  {
    index: "09",
    title: "The Digital Government Studio",
    accentVar: "--sector-09",
    purpose:
      "Define the nation’s digital government platform from the country’s own needs and approved record.",
    bullets: [
      "Prepare cited requirements covering audiences, services, governance, institutions, and national identity.",
      "Require independent approval before verified government information reaches public services.",
    ],
  },
  {
    index: "10",
    title: "The Sector Studio",
    accentVar: "--sector-10",
    purpose:
      "Choose the sectors most capable of moving growth and govern each through an accountable plan.",
    bullets: [
      "Rank sectors from the national evidence while preserving the Head of Government’s choice.",
      "Carry each priority from cited diagnosis to roadmap, Cabinet commitment, and public accountability.",
    ],
  },
];

export function chamberByIndex(index: string): Chamber | undefined {
  return CHAMBERS.find((c) => c.index === index);
}
