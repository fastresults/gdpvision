// @domain marketing
// @tables op_ed_requests, op_ed_events
// @ui src/routes/op-eds.index.tsx, src/routes/op-eds.$slug.tsx
//
// GENERATED FILE — do not edit by hand.
// Source of truth: content/op-eds/*.md
// Regenerate with:  bun run scripts/build-op-eds.ts
//
// An entry is "published" only when it carries real prose and a real source
// list. Sources are transcribed character-for-character from the manuscript.

export interface OpEd {
  slug: string;
  /** Chamber index this argument bridges into, e.g. "04". */
  chamber: string;
  chamberName: string;
  /** Hex accent from the chamber's --sector-* token, as authored. */
  accent: string;
  status: "draft" | "published";
  title: string;
  standfirst: string;
  promise: string;
  /** The paragraphs before the first heading, ungated. */
  excerpt: string[];
  /** Engraved plate — its citation and grade are drawn into the artwork. */
  figure?: { caption: string; image: string };
  /** Visible before the gate — the evidence is never withheld. */
  sources: string[];
  /** Engraved emblem, rendered through <Illustration>. */
  emblem: string;
  /** Absolute https URL used for og:image / twitter:image. */
  ogImage: string;
  /** Object key inside the private `op-eds` storage bucket. */
  pdfKey: string;
}

export const OP_EDS: OpEd[] = [
  {
    slug: "national-ledger",
    chamber: "01",
    chamberName: "The National Ledger",
    accent: "#1e3350",
    status: "published",
    title: "Governing from a photograph.",
    standfirst:
      "Authoritative sector data reaches a Caribbean Cabinet roughly eighteen months after the period it describes. We ask governments to steer an economy using a picture of where it used to be — and then to defend the picture as though it were a window.",
    promise: "One argument, twelve minutes, every figure sourced.",
    excerpt: [
      "A Prime Minister I worked with years ago had a habit I have never forgotten. Before saying any number in public, he would pause — half a second, no more — and you could see him deciding whether he was willing to defend it.",
      "He was right to pause. He had no way of knowing where most of his numbers came from.",
      "This is not a criticism of him, and it is not a criticism of his statisticians, who were serious people doing careful work with inadequate resources. It is a description of a structural condition that almost every small state governs under, and which is so normal that it has stopped being remarked upon.",
    ],
    emblem: "/op-eds/art/01-emblem.svg",
    ogImage: "https://gdpvision.com/op-eds/art/01-emblem.png",
    figure: {
      caption: "The lag between the period described and the picture a Cabinet sees.",
      image: "/op-eds/art/01-figure.svg",
    },
    sources: [
      "Typical staleness of authoritative sector data — 18 months, grade B. ECCB & NSO release cadence review, 2024.",
    ],
    pdfKey: "GDPVision-01-national-ledger.pdf",
  },
  {
    slug: "portfolio-workspaces",
    chamber: "02",
    chamberName: "Portfolio Workspaces",
    accent: "#b98a2f",
    status: "published",
    title: "Ask a minister what their portfolio contributes.",
    standfirst:
      "In most governments that question starts a procurement. Weeks later a consultant returns a figure and the Ministry of Finance disputes it. Meanwhile one sector carries most of the economy and every other ministry is arguing blind.",
    promise: "One argument, twelve minutes, every figure sourced.",
    excerpt: [
      "Ask any minister in the region what their portfolio contributes to national GDP.",
      "In most governments, that question begins a procurement. A consultant is engaged. Some weeks later a figure returns, and the Ministry of Finance disputes the methodology. The minister, who wanted a number for a Cabinet paper due on Thursday, has spent money to acquire an argument.",
      "I have watched this cycle enough times to be confident it is the norm rather than the exception, and it produces a specific kind of government: one in which ministers advocate for their portfolios without knowing what those portfolios are worth.",
    ],
    emblem: "/op-eds/art/02-emblem.svg",
    ogImage: "https://gdpvision.com/op-eds/art/02-emblem.png",
    figure: { caption: "Concentration, drawn to scale.", image: "/op-eds/art/02-figure.svg" },
    sources: [
      "Direct and indirect tourism contribution, upper-band Caribbean states — 80% of GDP, grade B. WTTC Economic Impact Reports, 2019–2023.",
      "United States share of stopover arrivals, dominant across the region — 1 source market, grade B. CTO Latest Statistics, 2023.",
    ],
    pdfKey: "GDPVision-02-portfolio-workspaces.pdf",
  },
  {
    slug: "scenario-engine",
    chamber: "03",
    chamberName: "The Scenario Engine",
    accent: "#5b4fa8",
    status: "published",
    title: "Two hundred and twenty-six per cent, in a single night.",
    standfirst:
      "Hurricane Maria cost Dominica more than two years of national output in one evening. Every fiscal plan in this region is written inside a hurricane corridor. Almost none of them is rehearsed against one.",
    promise: "One argument, twelve minutes, every figure sourced.",
    excerpt: [
      "On the evening of 18 September 2017, Hurricane Maria crossed Dominica. The Post-Disaster Needs Assessment produced afterwards put the damage at 226 per cent of GDP.",
      "Not a bad quarter. Not a downgrade or a missed target. More than two years of everything the country produces, erased between dinner and dawn.",
      "Thirteen years earlier, Hurricane Ivan had done substantially the same thing to Grenada, at 200 per cent of GDP on the OECS and World Bank assessment. And the NOAA record for the past two decades shows Category 4 and 5 Atlantic storms arriving around thirty per cent more frequently than in the preceding baseline.",
    ],
    emblem: "/op-eds/art/03-emblem.svg",
    ogImage: "https://gdpvision.com/op-eds/art/03-emblem.png",
    figure: {
      caption: "The plan as written, and the event it was not drawn against.",
      image: "/op-eds/art/03-figure.svg",
    },
    sources: [
      "Damage from Hurricane Maria in Dominica, 2017 — 226% of GDP, grade A. Government of Dominica Post-Disaster Needs Assessment, 2017.",
      "Damage from Hurricane Ivan in Grenada, 2004 — 200% of GDP, grade A. OECS / World Bank Ivan Damage Assessment, 2004.",
      "Rise in Cat 4–5 Atlantic hurricane frequency, last two decades — 30% higher, grade B. NOAA Atlantic hurricane record, 2004–2024 vs. prior baseline.",
    ],
    pdfKey: "GDPVision-03-scenario-engine.pdf",
  },
  {
    slug: "fdi-transition-studio",
    chamber: "04",
    chamberName: "The FDI Transition Studio",
    accent: "#a86a2f",
    status: "published",
    title: "The date is set. The replacement is not.",
    standfirst:
      "Five OECS states built a revenue pillar that Brussels has now scheduled for demolition. The question is no longer whether to diversify. It is whether anyone has priced the hole.",
    promise: "One argument, twelve minutes, every figure sourced.",
    excerpt: [
      "There is a particular silence that follows a certain kind of meeting. I have sat in it more than once. A minister has just been told, politely and by someone from a larger country, that an arrangement their government depends upon will be ending. Not negotiated. Ending. The delegation thanks them for their time. And in the room afterwards, nobody speaks for a while, because everyone is doing the same arithmetic and arriving at the same answer.",
      "Citizenship by Investment is that arrangement. Five OECS states operate a programme today. At the upper band, receipts reach half of government revenue — a figure drawn from IMF Article IV consultations across those five states, and one that should stop any reader who has not seen it before. Half. Not of a discretionary fund. Of revenue.",
      "That money is not abstract. It is in hospitals. It is in schools. It is in the reserve that a small island reaches for in the weeks after a hurricane, when the roads are gone and the reinsurance has not yet arrived. And it now has a scheduled end.",
    ],
    emblem: "/op-eds/art/04-emblem.svg",
    ogImage: "https://gdpvision.com/op-eds/art/04-emblem.png",
    figure: {
      caption: "The Gap — receipts falling faster than the replacement arrives.",
      image: "/op-eds/art/04-figure.svg",
    },
    sources: [
      "CBI receipts as share of government revenue, upper band — 50%, grade B. IMF Article IV consultations, 2022–2024. Range across the five OECS CBI states.",
      "OECS states operating a CBI programme today — 5, grade A. St. Kitts & Nevis, Dominica, Antigua & Barbuda, Grenada, Saint Lucia.",
    ],
    pdfKey: "GDPVision-04-fdi-transition-studio.pdf",
  },
  {
    slug: "narrative-chamber",
    chamber: "05",
    chamberName: "The Narrative Chamber",
    accent: "#8e2f3c",
    status: "published",
    title: "Zero seats.",
    standfirst:
      "The OECS holds no votes on the body setting the global minimum tax. When the rules that price your economy are written elsewhere, the one thing still within your control is whether you arrive at the argument prepared.",
    promise: "One argument, twelve minutes, every figure sourced.",
    excerpt: [
      "The Organisation of Eastern Caribbean States holds zero votes on the steering committee of the OECD Inclusive Framework.",
      "Zero. It is on the published governance roster for anyone who wishes to check.",
      "That body has overseen the implementation of a fifteen per cent global minimum corporate tax, now in force. Over the past five years, four Caribbean jurisdictions have appeared on active EU tax or anti-money-laundering lists. Correspondent banks have withdrawn from the region on their own commercial timetable, informing governments rather than consulting them.",
    ],
    emblem: "/op-eds/art/05-emblem.svg",
    ogImage: "https://gdpvision.com/op-eds/art/05-emblem.png",
    figure: {
      caption: "Twenty-four seats on the committee. None of them ours.",
      image: "/op-eds/art/05-figure.svg",
    },
    sources: [
      "OECS votes on the OECD Inclusive Framework steering committee — 0, grade A. OECD Inclusive Framework governance roster, 2024.",
      "OECD Pillar Two global minimum corporate tax rate now in force — 15%, grade A. OECD/G20 Inclusive Framework, 2024 implementation.",
      "Caribbean jurisdictions on active EU tax or AML lists in the last five years — 4, grade B. EU Council tax and AML list revisions, 2019–2024.",
    ],
    pdfKey: "GDPVision-05-narrative-chamber.pdf",
  },
  {
    slug: "cabinet-room",
    chamber: "06",
    chamberName: "The Cabinet Room",
    accent: "#7a4a6b",
    status: "published",
    title: "What happened to the decision?",
    standfirst:
      "Minutes record what was said. They do not record what was decided, who carries it, or whether it landed. In economies where a quarter of revenue is spoken for before Cabinet sits, that gap is not untidiness. It is money.",
    promise: "One argument, twelve minutes, every figure sourced.",
    excerpt: [
      "Ask a Cabinet Secretary what was decided at the meeting three months ago, who owned it, and whether it happened.",
      "You will get an answer about the first. Minutes exist and they are usually well kept. The second becomes vaguer. The third is often genuinely unknown, and the honest ones will say so.",
      "This is not a Caribbean problem. It is close to universal, and I have found it in governments of every size and sophistication. But it is far more expensive in a small, highly indebted state, and that is the case I want to make.",
    ],
    emblem: "/op-eds/art/06-emblem.svg",
    ogImage: "https://gdpvision.com/op-eds/art/06-emblem.png",
    figure: {
      caption: "What a decision is supposed to do after the meeting ends.",
      image: "/op-eds/art/06-figure.svg",
    },
    sources: [
      "Interest payments as share of government revenue, high-debt cases — 25%, grade B. IMF Article IV consultations, 2022–2024.",
      "Debt-to-GDP, upper-band Caribbean sovereigns — 90%, grade A. IMF WEO database, 2024.",
    ],
    pdfKey: "GDPVision-06-cabinet-room.pdf",
  },
  {
    slug: "persona-lab",
    chamber: "07",
    chamberName: "Persona Lab",
    accent: "#6f8a3a",
    status: "published",
    title: "We are exporting the people we need, and guessing at how to keep them.",
    standfirst:
      "Up to seventy per cent of tertiary-educated citizens have left the upper band of Caribbean states. Retention policy is written, announced, and only then discovered to have missed the people it was written for.",
    promise: "One argument, twelve minutes, every figure sourced.",
    excerpt: [
      "In the upper band of Caribbean states, around seventy per cent of citizens with tertiary education have emigrated. The figure is from the World Bank and OECD skilled-migration database, and it carries a high confidence grade.",
      "Seven in ten. The nurses, the teachers, the engineers, the accountants — the people a state spends most heavily on educating and depends on most completely.",
      "Some of the value returns. Remittances reach twenty per cent of GDP in the top-receiving economies. That inflow is real and it is stable, and any honest account has to acknowledge it. But it is also stagnant, exposed to a diaspora that is ageing, and subject to immigration policy set in other countries. It is not a substitute for the people. It is compensation for their absence.",
    ],
    emblem: "/op-eds/art/07-emblem.svg",
    ogImage: "https://gdpvision.com/op-eds/art/07-emblem.png",
    figure: { caption: "Seven in ten.", image: "/op-eds/art/07-figure.svg" },
    sources: [
      "Tertiary-educated emigration rate, upper-band Caribbean states — 70%, grade A. World Bank / OECD DIOC skilled-migration database, 2020.",
      "Remittances as share of GDP, top-receiving Caribbean economies — 20% of GDP, grade A. World Bank Migration & Development Brief, 2023.",
      "Public-sector nursing vacancy rate across the OECS — 8% shortfall, grade B. PAHO Caribbean health workforce assessments, 2022.",
    ],
    pdfKey: "GDPVision-07-persona-lab.pdf",
  },
  {
    slug: "mandate-compact",
    chamber: "08",
    chamberName: "The Mandate Compact",
    accent: "#2e7d5b",
    status: "published",
    title: "Someone will grade your manifesto. It should be you.",
    standfirst:
      "Every government publishes a programme and then loses track of it. The scorecard gets built regardless — by a journalist, an NGO, or the opposition. The only real choice is whose numbers the public sees first.",
    promise: "One argument, twelve minutes, every figure sourced.",
    excerpt: [
      "The manifesto is the most carefully written document a party ever produces and the least used document a government ever owns.",
      "It is drafted over months. It is argued over line by line. It is costed, at least notionally. It wins the election. And then, within about a year, it becomes something nobody can quite locate — a PDF on a party website, referred to in speeches, consulted almost never.",
      "I have watched this happen in more administrations than I care to count, on both sides of the aisle, in countries whose politics have nothing in common. It is not a failure of sincerity. Governments do not abandon their manifestos out of cynicism. They lose them structurally, and the mechanism is worth describing precisely, because a problem understood structurally can be fixed structurally.",
    ],
    emblem: "/op-eds/art/08-emblem.svg",
    ogImage: "https://gdpvision.com/op-eds/art/08-emblem.png",
    figure: {
      caption: "The scorecard, whoever ends up building it.",
      image: "/op-eds/art/08-figure.svg",
    },
    sources: [
      "Debt-to-GDP, upper-band Caribbean sovereigns — 90%, grade A. IMF WEO database, 2024.",
      "Interest payments as share of government revenue, high-debt cases — 25%, grade B. IMF Article IV consultations, 2022–2024.",
    ],
    pdfKey: "GDPVision-08-mandate-compact.pdf",
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
