// @domain marketing
// @tables op_ed_requests, op_ed_events
// @ui src/routes/op-eds.index.tsx, src/routes/op-eds.$slug.tsx
//
// SINGLE SOURCE OF TRUTH for the op-ed landing pages.
//
// HOW TO PUBLISH AN OP-ED
// -----------------------
//  1. Paste the article's first three paragraphs into `excerpt`, verbatim.
//  2. Paste the source list into `sources`, transcribed character-for-character
//     from the manuscript. Never paraphrase a citation and never invent one.
//  3. Upload the PDF to the private `op-eds` storage bucket under `pdfKey`.
//  4. Flip `status` to "published".
//
// Until `status` is "published" the entry is hidden from the reading room and
// its route returns not-found. That is deliberate: an op-ed page with
// unsourced or placeholder prose must never be reachable.

import emblem01 from "@/assets/op-eds/oped-01.jpg.asset.json";
import emblem02 from "@/assets/op-eds/oped-02.jpg.asset.json";
import emblem03 from "@/assets/op-eds/oped-03.jpg.asset.json";
import emblem04 from "@/assets/op-eds/oped-04.jpg.asset.json";
import emblem05 from "@/assets/op-eds/oped-05.jpg.asset.json";
import emblem06 from "@/assets/op-eds/oped-06.jpg.asset.json";
import emblem07 from "@/assets/op-eds/oped-07.jpg.asset.json";
import emblem08 from "@/assets/op-eds/oped-08.jpg.asset.json";

export interface OpEdSource {
  /** Publisher or institution, e.g. "IMF". */
  org: string;
  /** Title of the cited work, transcribed exactly. */
  title: string;
  /** Year or period the figure refers to. */
  year?: string;
  /** Absolute https URL where the claim can be checked. */
  url?: string;
}

export interface OpEd {
  slug: string;
  /** Chamber index this argument bridges into, e.g. "04". */
  chamber: string;
  /** Publication state. Only "published" entries are reachable. */
  status: "draft" | "published";
  /** Headline as it appears on the page and in the browser tab. */
  title: string;
  /** One-sentence hook under the headline. */
  standfirst: string;
  /** The honest, unhyped one-liner beneath the hook. */
  promise: string;
  /** The first three paragraphs, ungated. Empty while status is "draft". */
  excerpt: string[];
  /** Optional figure shown on the paper band, with its confidence grade. */
  figure?: {
    caption: string;
    grade: "A" | "B" | "C" | "D";
    /** CDN url of the engraved chart or diagram. */
    image: string;
  };
  /** Visible before the gate — the evidence is never withheld. */
  sources: OpEdSource[];
  /** Engraved emblem, rendered through <Illustration>. */
  emblem: string;
  /** Object key inside the private `op-eds` storage bucket. */
  pdfKey: string;
}

export const OP_EDS: OpEd[] = [
  {
    slug: "the-ledger-a-nation-can-argue-with",
    chamber: "01",
    status: "draft",
    title: "The ledger a nation can argue with",
    standfirst:
      "Most governments cannot say, on the record, how confident they are in their own GDP figures.",
    promise: "One argument, twelve minutes, every figure sourced.",
    excerpt: [],
    sources: [],
    emblem: emblem01.url,
    pdfKey: "the-ledger-a-nation-can-argue-with.pdf",
  },
  {
    slug: "every-minister-owns-a-number",
    chamber: "02",
    status: "draft",
    title: "Every minister owns a number",
    standfirst:
      "Portfolio accountability fails when no one can name their contribution to national output.",
    promise: "One argument, twelve minutes, every figure sourced.",
    excerpt: [],
    sources: [],
    emblem: emblem02.url,
    pdfKey: "every-minister-owns-a-number.pdf",
  },
  {
    slug: "rehearse-before-you-decide",
    chamber: "03",
    status: "draft",
    title: "Rehearse before you decide",
    standfirst: "Cabinets take irreversible decisions on evidence they have never stress-tested.",
    promise: "One argument, twelve minutes, every figure sourced.",
    excerpt: [],
    sources: [],
    emblem: emblem03.url,
    pdfKey: "rehearse-before-you-decide.pdf",
  },
  {
    slug: "the-revenue-cliff-nobody-priced",
    chamber: "04",
    status: "draft",
    title: "The revenue cliff nobody priced",
    standfirst: "Fragile revenue lines are treated as permanent until the year they are not.",
    promise: "One argument, twelve minutes, every figure sourced.",
    excerpt: [],
    sources: [],
    emblem: emblem04.url,
    pdfKey: "the-revenue-cliff-nobody-priced.pdf",
  },
  {
    slug: "a-defensible-position-by-close-of-business",
    chamber: "05",
    status: "draft",
    title: "A defensible position by close of business",
    standfirst:
      "The cost of a slow national position is measured in investment, not in column inches.",
    promise: "One argument, twelve minutes, every figure sourced.",
    excerpt: [],
    sources: [],
    emblem: emblem05.url,
    pdfKey: "a-defensible-position-by-close-of-business.pdf",
  },
  {
    slug: "what-cabinet-time-is-worth",
    chamber: "06",
    status: "draft",
    title: "What Cabinet time is worth",
    standfirst:
      "A decision that is not recorded, owned and tracked is a decision that was not taken.",
    promise: "One argument, twelve minutes, every figure sourced.",
    excerpt: [],
    sources: [],
    emblem: emblem06.url,
    pdfKey: "what-cabinet-time-is-worth.pdf",
  },
  {
    slug: "test-the-policy-on-the-public-first",
    chamber: "07",
    status: "draft",
    title: "Test the policy on the public first",
    standfirst: "Resonance is knowable before a policy ships, and unknowable once it has.",
    promise: "One argument, twelve minutes, every figure sourced.",
    excerpt: [],
    sources: [],
    emblem: emblem07.url,
    pdfKey: "test-the-policy-on-the-public-first.pdf",
  },
  {
    slug: "the-manifesto-as-a-delivery-contract",
    chamber: "08",
    status: "draft",
    title: "The manifesto as a delivery contract",
    standfirst: "A manifesto that cannot be scored quarterly is a document, not a mandate.",
    promise: "One argument, twelve minutes, every figure sourced.",
    excerpt: [],
    sources: [],
    emblem: emblem08.url,
    pdfKey: "the-manifesto-as-a-delivery-contract.pdf",
  },
];

/** An op-ed is reachable only when it is published and carries real prose. */
export function isReadable(op: OpEd): boolean {
  return op.status === "published" && op.excerpt.length > 0;
}

export const PUBLISHED_OP_EDS = OP_EDS.filter(isReadable);

export function opEdBySlug(slug: string): OpEd | undefined {
  return OP_EDS.find((o) => o.slug === slug);
}

export const OP_ED_AUTHOR = {
  name: "Adam Anderson",
  note: "Adam Anderson is the founder of OPEN Interactive and the author of the GDPVision instrument. He writes for principals, not for procurement.",
};
