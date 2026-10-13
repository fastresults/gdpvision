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

import screen01 from "@/assets/chamber-screens/chamber-01-new.jpg.asset.json";
import screen02 from "@/assets/chamber-screens/chamber-02-new.jpg.asset.json";
import screen03 from "@/assets/chamber-screens/chamber-03.webp.asset.json";
import screen04 from "@/assets/chamber-screens/chamber-04-new.jpg.asset.json";
import screen05 from "@/assets/chamber-screens/chamber-05-new.jpg.asset.json";
import screen06 from "@/assets/chamber-screens/chamber-06-new.jpg.asset.json";
import screen07 from "@/assets/chamber-screens/chamber-07-new.jpg.asset.json";
import screen08 from "@/assets/chamber-screens/chamber-08-new.jpg.asset.json";
import screen09 from "@/assets/chambers/chamber-09.jpg.asset.json";
import screen10 from "@/assets/chamber-screens/chamber-10-new.jpg.asset.json";

export interface Chamber {
  index: string;
  title: string;
  /** CSS custom property registered in @theme inline of src/styles.css. */
  accentVar: string;
  image?: string;
  screenshot?: string;
  /**
   * Command-length outcome shown directly beneath the chamber's header image —
   * one direct economic benefit, full stop. The line a
   * Principal reads while scrolling; `purpose` remains the explanation.
   */
  outcome: string;
  purpose: string;
  bullets: string[];
}

export const CHAMBERS: Chamber[] = [
  {
    index: "01",
    title: "National Evidence Ledger",
    accentVar: "--sector-01",
    image: ch01.url,
    screenshot: screen01.url,
    outcome: "Put trusted evidence behind every economic decision.",
    purpose: "Bring national and sector data into one sourced record so Cabinet can assess the economy and direct resources with confidence.",
    bullets: [
      "Compare trends, sources and evidence strength before setting priorities.",
      "Build briefings that link every key figure to its supporting evidence.",
    ],
  },
  {
    index: "02",
    title: "Ministry Growth & Delivery",
    accentVar: "--sector-03",
    image: ch02.url,
    screenshot: screen02.url,
    outcome: "Give every minister a clear role in growth.",
    purpose: "Connect each ministry’s responsibilities to economic priorities, sector dependencies and delivery measures so government can coordinate action.",
    bullets: [
      "Identify where ministry decisions influence growth and other portfolios.",
      "Carry options into Cabinet review with clear measures of progress.",
    ],
  },
  {
    index: "03",
    title: "Policy Scenario Engine",
    accentVar: "--sector-09",
    image: ch03.url,
    screenshot: screen03.url,
    outcome: "Understand the trade-offs before committing public resources.",
    purpose: "Compare policy choices and their modelled economic effects so Cabinet can choose a course with its trade-offs, uncertainty and assumptions visible.",
    bullets: [
      "Test projected GDP growth, sector effects and citizenship-investment revenue exposure.",
      "Compare policy combinations against Cabinet’s objectives and stated assumptions.",
    ],
  },
  {
    index: "04",
    title: "Investment & Resilience Studio",
    accentVar: "--sector-07",
    image: ch04.url,
    screenshot: screen04.url,
    outcome: "Build investment alternatives to vulnerable national revenue.",
    purpose: "Assess exposed income and prepare investment propositions that support a more resilient economy, with practical barriers identified before commitments are made.",
    bullets: [
      "Estimate revenue gaps and the time available to respond.",
      "Test investment readiness across land, law, skills, incentives and institutions.",
    ],
  },
  {
    index: "05",
    title: "National Confidence & Communications",
    accentVar: "--sector-04",
    image: ch05.url,
    screenshot: screen05.url,
    outcome: "Protect national confidence with a credible public position.",
    purpose: "Turn emerging developments into evidence-backed briefings so government can respond clearly when uncertainty threatens investment, confidence or growth.",
    bullets: [
      "Assemble relevant events, sources and prior government knowledge.",
      "Prepare responses for authorised review and approval before release.",
    ],
  },
  {
    index: "06",
    title: "Cabinet Decisions & Delivery",
    accentVar: "--sector-10",
    image: ch06.url,
    screenshot: screen06.url,
    outcome: "Make every Cabinet decision an accountable commitment.",
    purpose: "Connect the decision to its owner, conditions and delivery record so ministers can track progress and intervene where action stalls.",
    bullets: [
      "Compare options and record decisions, responsibilities and conditions.",
      "Track commitments and identify issues requiring Cabinet attention.",
    ],
  },
  {
    index: "07",
    title: "Policy & Leadership Persona Lab",
    accentVar: "--sector-06",
    image: ch07.url,
    screenshot: screen07.url,
    outcome: "Anticipate concerns before putting policy into practice.",
    purpose: "Explore how different audiences may respond and what leadership requires, helping government refine proposals before committing to implementation.",
    bullets: [
      "Run evidence-grounded simulations for citizens, diaspora and investors.",
      "Examine ministerial skills and policy concerns; simulated findings are not public opinion polls.",
    ],
  },
  {
    index: "08",
    title: "Mandate Delivery & Accountability",
    accentVar: "--sector-02",
    image: ch08.url,
    screenshot: screen08.url,
    outcome: "Turn public promises into measurable government delivery.",
    purpose: "Translate the mandate into ministry-owned commitments so government can review progress, explain changes and demonstrate what has been delivered.",
    bullets: [
      "Give each pledge clear deliverables, measures, owners and review dates.",
      "Keep approvals, evidence and quarterly progress in one accountable record.",
    ],
  },
  {
    index: "09",
    title: "Digital Government Planning Studio",
    accentVar: "--chamber-09",
    screenshot: screen09.url,
    outcome: "Define better public services on government’s terms.",
    purpose: "Turn national needs and verified government information into a clear digital-service blueprint, giving government control over scope, evidence and approval.",
    bullets: [
      "Specify services, audiences, institutions and governance using cited requirements.",
      "Approve information before sharing it through authorised digital connections.",
    ],
  },
  {
    index: "10",
    title: "Sector Growth & Delivery Studio",
    accentVar: "--chamber-10",
    screenshot: screen10.url,
    outcome: "Focus national effort on sectors with growth potential.",
    purpose: "Use national evidence to select priorities and build accountable sector plans, connecting economic ambition to practical action and Cabinet oversight.",
    bullets: [
      "Compare sector opportunities while preserving the Head of Government’s choice.",
      "Develop cited plans with milestones, responsibilities and approval before Cabinet commitment.",
    ],
  },
];

export function chamberByIndex(index: string): Chamber | undefined {
  return CHAMBERS.find((c) => c.index === index);
}
