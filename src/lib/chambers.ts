// @domain marketing
// @tables none
// @ui src/components/marketing/MarketingHome.tsx, src/routes/op-eds.$slug.tsx
//
// Canonical public-facing description of the eight chambers. Single source of
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
  image: string;
  purpose: string;
  bullets: string[];
}

export const CHAMBERS: Chamber[] = [
  {
    index: "01",
    title: "The National Ledger",
    accentVar: "--sector-01",
    image: ch01.url,
    purpose: "The single source of GDP truth every other decision reads from.",
    bullets: [
      "A 12-sector ontology with a decade of history and a data-confidence grade on every series.",
      "Exposure indices — single, methodologically-documented numbers, drillable to source.",
      "Four-layer sector dossiers: economic, policy, comms, and regional.",
    ],
  },
  {
    index: "02",
    title: "Portfolio Workspaces",
    accentVar: "--sector-03",
    image: ch02.url,
    purpose: "Every minister sees their contribution to GDP — and the levers that raise it.",
    bullets: [
      "Sector position, dependency web, and the portfolio's share of national exposure.",
      "A shelf of the minister's scenarios, from draft through Cabinet-adopted.",
      "Play-of-the-day cards derived from live lever values.",
    ],
  },
  {
    index: "03",
    title: "The Scenario Engine",
    accentVar: "--sector-09",
    image: ch03.url,
    purpose: "Rehearse every GDP-moving decision before it costs a cent.",
    bullets: [
      "Sovereign Vitals — real GDP, debt-to-GDP, FX retention, primary balance, public confidence — live.",
      "Ripple propagation through the inter-sector dependency web.",
      "Goal-seek: set the target, discover the levers that reach it.",
    ],
  },
  {
    index: "04",
    title: "The FDI Transition Studio",
    accentVar: "--sector-07",
    image: ch04.url,
    purpose:
      "Replace fragile revenue with durable GDP through an assembled book of investment packages.",
    bullets: [
      "The Gap: the revenue and GDP hole under the selected wind-down glide-path, year by year.",
      "Investment package builder with capital-to-GDP conversion and time-to-impact lags.",
      "Readiness scoring across legal, land, workforce, incentives, and institutional capacity.",
    ],
  },
  {
    index: "05",
    title: "The Narrative Chamber",
    accentVar: "--sector-04",
    image: ch05.url,
    purpose: "Protect GDP by reaching a defensible national position inside a working day.",
    bullets: [
      "Signal Desk, Context Dossiers, and a persistent Second Brain that never starts from a blank page.",
      "Doctorate-grade strategy statements with a message architecture that carries across every channel.",
      "Human-command doctrine: the chamber drafts, principals decide, nothing releases autonomously.",
    ],
  },
  {
    index: "06",
    title: "The Cabinet Room",
    accentVar: "--sector-10",
    image: ch06.url,
    purpose: "Convert Cabinet time into recorded, tracked commitments that move the GDP dial.",
    bullets: [
      "Session Mode: agenda of promoted scenarios, full-bleed comparisons, decisions recorded live.",
      "National Scorecard — every ratified KPI, current pace, movement since last session.",
      "Commitments roll-up: what was adopted, who owns it, where it stands.",
    ],
  },
  {
    index: "07",
    title: "The Research Chamber",
    accentVar: "--sector-06",
    image: ch07.url,
    purpose:
      "Test resonance with citizens and investors before policies, incentives, or narratives ship.",
    bullets: [
      "Synthetic personas and segments modelled from the sovereign corpus and public evidence.",
      "Studies that stress-test policy, incentive, and narrative options against real audience logic.",
      "Every finding cited, exportable, and traceable back to the Ledger.",
    ],
  },
  {
    index: "08",
    title: "The Mandate Compact",
    accentVar: "--sector-02",
    image: ch08.url,
    purpose:
      "Turn the ruling party's manifesto into a signed, ministry-by-ministry delivery plan the PM can score every quarter.",
    bullets: [
      "Ingest the manifesto and decompose it into pillars, pledges, and ministry-owned deliverables.",
      "Quarterly scorecards and a PM Report Card that grade every ministry from delivered to broken.",
      "Signed, versioned compact with a full audit trail — every revision snapshotted and diffable.",
    ],
  },
];

export function chamberByIndex(index: string): Chamber | undefined {
  return CHAMBERS.find((c) => c.index === index);
}
