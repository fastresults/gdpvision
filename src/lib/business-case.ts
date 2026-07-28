// @domain marketing
// @tables none
// @ui src/routes/business-case.tsx
//
// Public copy for the GDPVision decision paper ("The business case").
// Single source of truth for the page — the route component is presentational.

export const BUSINESS_CASE_META = {
  eyebrow: "A decision paper",
  title: "The business case for GDPVision",
  standfirst:
    "On instrumenting sovereign economic decision-making — prepared for heads of government, Cabinet Secretaries, ministries of finance, and the officials who must satisfy themselves that this is the right class of system before it is procured.",
  author: "Adam Anderson",
  org: "OPEN Interactive",
};

export interface LabelledPara {
  label: string;
  body: string;
}

export const EXECUTIVE_SUMMARY: LabelledPara[] = [
  {
    label: "The decision",
    body: "Whether to instrument national economic decision-making as a governed, sovereign system of record — or to continue carrying it on arrangements built for statistical record-keeping and, increasingly, on uncontrolled personal use of consumer AI inside the ministries.",
  },
  {
    label: "Why now",
    body: "Five OECS states operate a Citizenship by Investment programme that reaches half of government revenue at the upper band. It has a scheduled end and no priced replacement. That transition must be engineered against debt at ninety per cent of GDP, with a quarter of revenue already committed to interest, inside a hurricane corridor where a single night has cost 226 per cent of GDP — and using authoritative data that arrives roughly eighteen months after the period it describes.",
  },
  {
    label: "The central argument",
    body: "A government's capacity to act on its economy is bounded by the quality of its instrumentation. The region's instrumentation was built to keep a record, not to govern from. It is now being asked to carry the largest economic transition in its modern history, and it cannot.",
  },
  {
    label: "On the obvious cheap answer",
    body: "A capable official with a frontier language model can draft a note, summarise a report and compare two options. That is true and worth conceding. But a language model is a component, not a system. It holds no shared corpus, cannot reproduce its own answer, has one actor and no roles, produces text rather than a record, and cannot lawfully receive Cabinet material. The choice is not whether a government uses AI — that is settled, and it is already happening on personal accounts. The choice is whether that use is governed.",
  },
  {
    label: "What is recommended",
    body: "A confidential Cabinet briefing, then a time-boxed pilot against one live decision with agreed conversion criteria, then national deployment: one isolated instance per nation, owned outright by the government, with contracted export, escrow and exit.",
  },
];

export const NOT_CLAIMED =
  "No measured outcome is published for GDPVision. No percentage improvement, no time saved, no revenue attributed. The case below argues from mechanism and from the size of the decisions involved, not from results we cannot yet evidence.";

export interface StakeFigure {
  value: number;
  unit?: string;
  decimals?: number;
  label: string;
  grade: "A" | "B" | "C" | "D";
  citation: string;
  note: string;
}

export const STAKES: StakeFigure[] = [
  {
    value: 50,
    unit: "%",
    label: "of government revenue, upper band",
    grade: "B",
    citation: "IMF Article IV consultations, 2022–2024",
    note: "Citizenship by Investment at the upper band across the five OECS states operating a programme. That money is in hospitals, in schools, and in the reserve a small island reaches for in the weeks after a storm.",
  },
  {
    value: 90,
    unit: "%",
    label: "debt-to-GDP, upper band",
    grade: "A",
    citation: "IMF WEO, 2024",
    note: "In high-debt cases interest consumes around a quarter of revenue before Cabinet takes its first discretionary decision of the year. Remove up to half of what remains, and no version of the arithmetic resolves through prudence.",
  },
  {
    value: 226,
    unit: "%",
    label: "of GDP lost in a single night",
    grade: "A",
    citation: "Government of Dominica Post-Disaster Needs Assessment, 2017",
    note: "Hurricane Maria. The storm is the most predictable feature of the regional fiscal environment; only its timing and landfall are uncertain.",
  },
  {
    value: 0,
    label: "OECS votes on the Inclusive Framework steering committee",
    grade: "A",
    citation: "OECD Inclusive Framework governance roster, 2024",
    note: "Rules are written elsewhere. External decisions arrive as facts, on timetables the region does not set.",
  },
  {
    value: 70,
    unit: "%",
    label: "of tertiary-educated citizens have emigrated",
    grade: "A",
    citation: "World Bank / OECD DIOC, 2020",
    note: "Institutional capability is being lost faster than it is being replaced.",
  },
  {
    value: 18,
    unit: "mo",
    label: "lag before authoritative sector data reaches Cabinet",
    grade: "B",
    citation: "ECCB & NSO release cadence review, 2024",
    note: "A decision taken today rests on a settled picture of the year before last.",
  },
];

export const STAKES_CLOSE =
  "Set those together and the shape of the problem is clear. The region is being asked to execute the most consequential economic transition in its modern history, against an external deadline it does not control, with no fiscal slack, in a physical-risk corridor, while losing the people who would do the work — and using an evidence base that describes a country that no longer exists.";

export const INSTRUMENTATION_INTRO = [
  "It would be easy to attribute the gap to capacity or to will. In my experience that is both wrong and unfair.",
  "Officials in these ministries are capable and overworked. The analysis has not been done because the underlying evidence does not exist in a usable form. Ministries hold fragments in incompatible formats. The dependency relationships between sectors — what happens to construction when tourism moves, what happens to public revenue when construction moves — live in the heads of a small number of people, some of them close to retirement.",
  "So when a Cabinet asks what happens if half the revenue goes, the honest answer from the ministry is: give us some months, and we will commission something. The commissioned study arrives after the decision window has closed, describing a situation that has already moved.",
];

export const THREE_FAILURES: LabelledPara[] = [
  {
    label: "The evidence is scattered",
    body: "No single place a Cabinet can look, and no single number everyone accepts. A great deal of the most expensive time in the country is consumed reconciling figures that were each built on a different basis at a different time, and all of which are defensible.",
  },
  {
    label: "The evidence is ungraded",
    body: "A precisely measured figure and a well-intentioned estimate appear in identical type in the same Cabinet paper. Nothing tells a minister which is which — which is why leaders hesitate before saying a number in public, and why a dispute about a national figure can run for days.",
  },
  {
    label: "And nothing is rehearsed",
    body: "Policy is committed to and its consequences discovered afterwards. The question that actually matters — what happens if we do this, and what happens if we do the other thing — goes unanswered at the moment it is asked.",
  },
];

export const CHEAP_ANSWER_INTRO = [
  "Frontier language models are extraordinary. A competent permanent secretary with a consumer subscription can summarise an Article IV consultation, draft a Cabinet note, compare two policy options, sketch an investment case and produce a press line — in an afternoon, for the price of a monthly fee. Why procure anything?",
  "Most of that is true, and any vendor who denies it should be treated with suspicion. An official who is not using these tools is at a disadvantage to one who is.",
  "But the objection contains a category error worth naming precisely. A language model is a component. It is not a system. GDPVision itself uses language models — several, behind a gateway, with a documented fallback order and provenance recorded on every fact they return. The question was never model versus system. It is ungoverned model use against governed model use.",
];

export const CANNOTS: LabelledPara[] = [
  {
    label: "It cannot hold what your government knows",
    body: "It has a context window you must refill from scratch every time, which vanishes when the tab closes. Nothing accumulates, nothing is shared, and fifteen officials each holding a private conversation produce fifteen unreconciled views faster than before.",
  },
  {
    label: "It cannot lawfully receive your Cabinet material",
    body: "To get a useful answer an official must paste in the thing that makes it useful — the draft budget, the term sheet, the memorandum — into a service hosted elsewhere, under terms no ministry has reviewed, with retention the government cannot audit.",
  },
  {
    label: "It cannot reproduce its own answer",
    body: "Ask the same fiscal question twice and you get two answers. GDPVision separates the two things a chat session conflates: the model proposes, and a deterministic engine computes — pure, versioned, containing no randomness, with the engine version pinned to every scenario artefact. A projection made in March re-runs identically in September.",
  },
  {
    label: "It has one actor",
    body: "Government work is irreducibly multi-actor and differently permissioned: a steward maintains a series, a minister reads a portfolio, a principal decides, a secretary records. A session has no concept of role, ministry or country access. GDPVision enforces access at the database layer through row-level security, not in the interface where a hidden button is not access control.",
  },
  {
    label: "It produces text, not a record",
    body: "A session's output is a message. The instrument's output is a row, in a system of record every chamber reads. A scenario becomes an artefact with pinned assumptions; a Cabinet decision becomes a commitment with a named owner; the commitment is scored against the mandate at quarter end. Work moves between chambers rather than being retyped — and that carrying by hand is where government work is actually lost.",
  },
  {
    label: "It waits to be asked",
    body: "Coverage builds overnight; a source goes unreachable; a research stage fails at three in the morning. The instrument runs continuously — press discovery and clustering across entity feeds, watchlists refreshed on schedule, source health retried, stale locks reclaimed on an eight-minute heartbeat, failed stages redriven with escalating fallback.",
  },
  {
    label: "And it cannot be governed",
    body: "It has no doctrine, no approval gate, no register discipline, and no record of what it advised. GDPVision holds a doctrine enforced in code — the chamber drafts, principals decide, nothing releases autonomously — with no path from a detected signal to a public statement that does not pass through a named, accountable human being.",
  },
];

export const SHADOW_AI_INTRO = [
  "This is the part most often missing from the comparison, and it is the one that should concern a Cabinet Secretary most.",
  "Personal use of consumer AI is not a hypothetical future state. It is the current state in ministries across the region, undertaken by conscientious people trying to do difficult work with inadequate tools. The government therefore already carries four liabilities, none of which appears in any budget line.",
];

export const SHADOW_LIABILITIES: LabelledPara[] = [
  {
    label: "Disclosure exposure",
    body: "Sovereign material outside the jurisdiction with retention nobody can audit. This is discoverable, and it will eventually be discovered by someone unfriendly.",
  },
  {
    label: "Unattributable advice",
    body: "When a figure in a Cabinet paper proves wrong, there is no record of where it came from. “The AI said so” is not a defence in Parliament, and the official who relied on it carries the exposure personally.",
  },
  {
    label: "Fragmented positions",
    body: "The reconciliation problem accelerated rather than solved.",
  },
  {
    label: "Key-person concentration",
    body: "The capability sits with whichever official is good at prompting — in a region where seven in ten tertiary-educated citizens have already emigrated.",
  },
];

export const SHADOW_CLOSE =
  "So the choice is not “spend money or spend nothing”. It is: continue carrying an uncontrolled liability at no visible cost, or convert it into a governed capability at a visible one. Finance ministries make that trade in every other domain. It is the same argument as moving from informal borrowing to a documented facility.";

export const TIER_ONE_INTRO = [
  "Every government runs a small number of tier-one systems: treasury and financial management, revenue collection, the national identity register, settlement infrastructure.",
  "Nobody evaluates a treasury system against a spreadsheet. Not because spreadsheets are bad at arithmetic, but because the two objects are in different classes — and the class is determined by consequence, not capability.",
];

export const TIER_ONE_TESTS: Array<{ test: string; chat: string; instrument: string }> = [
  { test: "System of record others read as authoritative", chat: "No", instrument: "Yes" },
  {
    test: "Multi-actor, permissioned, enforced",
    chat: "No",
    instrument: "Yes — row-level, database-enforced",
  },
  { test: "Outputs auditable after the fact", chat: "No", instrument: "Yes — immutable audit log" },
  {
    test: "Outputs reproducible",
    chat: "No",
    instrument: "Yes — deterministic engine, pinned version",
  },
  {
    test: "Holds sovereign data lawfully",
    chat: "No",
    instrument: "Yes — isolated instance, chosen region",
  },
  {
    test: "Survives a change of administration",
    chat: "No",
    instrument: "Yes — the data is the government's",
  },
  { test: "Named supplier accountable", chat: "No", instrument: "Yes" },
  { test: "Defined exit, export and escrow", chat: "No", instrument: "Yes — contracted" },
];

export const TIER_ONE_CLOSE =
  "The relevant question is therefore not whether GDPVision beats a subscription. It is whether the evidence base beneath half of government revenue is a tier-one system or not. A government answering “not” has made a decision, whether or not it intended to.";

export interface OptionPath {
  key: string;
  title: string;
  owns: string[];
  body: string;
}

export const OPTION_PATHS: OptionPath[] = [
  {
    key: "A",
    title: "Subscriptions and capable officials",
    owns: ["Seats", "Sessions", "Prose"],
    body: "Recurring per-seat cost. At the end of three years the government owns nothing: no corpus, no decision record, no scored mandate, nothing that transfers to a successor. Stop paying and the capability stops that afternoon, leaving no residue, because the work lived in individual sessions that were never institutional. It is genuinely cheap, and it is cheap precisely because it accumulates nothing. You are renting cognition; you are not buying an asset.",
  },
  {
    key: "B",
    title: "Build it internally",
    owns: ["Code", "Staffing", "Liability"],
    body: "Significant capital and permanent staffing. What would be commissioned is not a chat interface over a document store — that is a quarter's work. It is a governed schema with grants, row-level security and policies; scores of server-function modules of domain logic; a twelve-sector ontology with a decade of history; a deterministic projection engine; a corpus gateway with deduplication on normalised keys; a twenty-stage country onboarding pipeline including a capital-flows stage that refuses to commit unless the draft balances within ten per cent; an immutable audit log; and cross-chamber promotion paths. Then permanent maintenance, in a labour market already losing skilled people. And the harder part is not the code — it is the judgement encoded in it, which a from-scratch build gets wrong on the first attempt.",
  },
  {
    key: "C",
    title: "Procure the instrument",
    owns: ["Corpus", "Record", "Mandate"],
    body: "A deployment the government owns outright, contractually and technically, with full export and verified deletion on termination. At the end of three years it holds a structured corpus of its own economy, a decision record spanning two or three Cabinets, a mandate scored quarter by quarter, and a modelled dependency map — all of which transfer to the next administration.",
  },
];

export const OPTIONS_CLOSE =
  "For a government carrying debt at ninety per cent of GDP, the distinction between recurring expenditure that leaves a residue and recurring expenditure that does not is not philosophical. It is how the estimates are argued.";

export const INSTRUMENT_INTRO = "A live National Ledger beneath eight chambers, with a voice-first Counsel above them.";

export const CHAMBER_LINES: Record<string, string> = {
  "01": "A twelve-sector ontology with a decade of history, a confidence grade on every series, exposure indices drillable to source, and four-layer sector dossiers. The single source of truth every other chamber reads from.",
  "02": "Every minister's contribution to GDP as a standing figure, their dependency web, and their levers ranked by effect with the cost of each attached.",
  "03": "Rehearsal before commitment. Ripple propagation through the inter-sector web, goal-seek that runs the decision backwards from a target, sensitivity views, and a compensation ledger showing what each gain costs elsewhere.",
  "04": "The Gap priced year by year under the actual glide-path; an investment package builder with capital-to-GDP conversion and honest time-to-impact lags; readiness scored across legal framework, land, workforce, incentives and institutional capacity; and the book sequenced across years.",
  "05": "Monitoring, response and syndication in one place. Entity feeds and watchlists refreshed on schedule, a signal desk ordered by economic consequence, structured strategy, channel drafts, an explicit approval workflow, scheduled publication, and a retained archive of what was issued.",
  "06": "Session Mode running the meeting itself, decisions recorded live with named owners, a commitments cockpit visible between sessions, and a National Scorecard that moves against constant indicators.",
  "07": "Rehearsing how a policy, incentive or message lands, privately, before announcement. Explicitly a rehearsal instrument and not a substitute for polling.",
  "08": "The manifesto decomposed into pillars, pledges and ministry-owned deliverables; quarterly scorecards and a PM Report Card; a signed, versioned compact whose every revision is diffable; and a transformational plan that hands directly to the Narrative Chamber, so what a government announces is the same object as what it decided.",
};

export const CORPUS_FOOTNOTE =
  "Underneath all of it, one sovereign corpus: public evidence and private Cabinet material held apart and read together, deduplicated, chunked, embedded, with visibility and ownership on every row.";

export const WORTH_INTRO =
  "These are mechanisms, not measured results. We publish no outcome figures and will not until one is cleared.";

export const WORTH: LabelledPara[] = [
  {
    label: "A transition that is priced rather than described",
    body: "The Gap year by year, a costed replacement book with lags made explicit, and readiness scored so a government can say precisely why a package is not yet investable. Investors do not walk away because a country is small; they walk away because nobody could tell them whether the land title would clear.",
  },
  {
    label: "A channel, not only a document",
    body: "OPEN Interactive has convened the Caribbean Investment Summit since 2009 — the room where the packages this instrument produces meet capital. A strategy document dies in a drawer; a package with a channel does not.",
  },
  {
    label: "Senior time returned",
    body: "The volume of Cabinet and permanent-secretary time lost to reconciling incompatible numbers is among the largest hidden costs in small-state government, and is almost never measured because nobody has been asked to account for it.",
  },
  {
    label: "Fiscal leakage closed",
    body: "Where a quarter of revenue is committed to interest before Cabinet decides anything, a decision taken and then quietly forgotten is money the country did not have to lose. A commitments record makes that visible while it is still recoverable.",
  },
  {
    label: "Shocks priced before they arrive",
    body: "Recovery financing negotiated after a storm is negotiated from the weakest position a country ever occupies. Negotiated against a modelled position, it is a different conversation with the same lenders.",
  },
  {
    label: "A defensible national position in hours rather than days",
    body: "Investor confidence, currency sentiment and the tone of the next credit review move on narrative before they move on fundamentals.",
  },
  {
    label: "Institutional memory retained",
    body: "Against seven-in-ten skilled emigration, a corpus does not resign.",
  },
  {
    label: "And an asset that survives an election",
    body: "A decision record is politically neutral by construction: it states what was decided, by whom, and what happened — as useful to an incoming government as to the one that built it.",
  },
];

export const APPROVALS: LabelledPara[] = [
  {
    label: "The Principal",
    body: "Buying defensibility and control of their own record: a number they can state in Parliament and immediately source, and a scorecard against their own manifesto published before a journalist builds one.",
  },
  {
    label: "The Gatekeeper — Chief of Staff or Cabinet Secretary",
    body: "Buying time and the absence of embarrassment: a State of the Nation brief generated rather than assembled over days, and a commitments record so the principal is never surprised eleven months later.",
  },
  {
    label: "The Technical Validator — Ministry of Finance or central bank",
    body: "Buying method they can interrogate: documented confidence grading, reproducible projections, sensitivity views, provenance to source. This is the person a chat session loses fastest, because they will ask the same question twice and notice the answers differ.",
  },
  {
    label: "Procurement",
    body: "Buying a lawful route to award, a named accountable supplier, written exit terms, escrow, and a contract that survives a change of government.",
  },
  {
    label: "The Sovereignty Gate — national security adviser or data protection commissioner",
    body: "Buying an answer they can give in public: one isolated deployment per nation; separate database, storage and encryption keys; no cross-instance queries anywhere in the architecture — not disabled, absent; hosting region chosen with the government; no third-party trackers inside the instance.",
  },
];

export const APPROVALS_CLOSE =
  "Note the pattern. The validator and the sovereignty gate do not reject a subscription for being less capable. They reject it for being the wrong class of system — an objection no better model can answer.";

export const PROVENANCE_PARAS = [
  "A reasonable technologist will ask why a competent team could not assemble this in two quarters.",
  "Some of it they could. The hard parts are not the screens. They are the ontology that lets figures from different ministries occupy one picture; the confidence-grading method; the deduplication contract that keeps a corpus trustworthy in year three; the reconciliation gate that knows when a capital-flow draft is not yet commit-worthy; the decision that scenarios must be deterministic and the model may only propose; and the judgement that a minister's realistic unit of use is ninety seconds on a phone between engagements, not an afternoon at a dashboard.",
  "Those do not come from software experience. They come from having been in the room.",
  "OPEN Interactive has convened the Caribbean Investment Summit since 2009, delivered digital government infrastructure at national scale under confidential engagement with the Office of the Prime Minister of St. Kitts & Nevis, and maintained head-of-government relationships across the OECS for seventeen years. SEDE — the Saint Lucia prototype, a working sovereign decision engine with a live macro model, voice console, dossier corpus and ingest pipeline — is the interaction-proven core that GDPVision v1 absorbs.",
  "This is not a global product adapted downward. It is an instrument designed against the exposures small island states actually carry.",
];

export const RISKS_PROCEEDING =
  "Adoption is the real one: an instrument ministers do not open is worth nothing, which is why the console is three tabs built for ninety seconds on a phone. Second, scope — a single-chamber entry that never instruments the Ledger underneath has nowhere to expand to. Third, ordinary supplier risk, answered with escrow, export and defined exit terms agreed early rather than late.";

export const RISKS_NOT_PROCEEDING =
  "The shadow-AI liability continues, uncosted and undocumented. Institutional memory continues to leave with departing officials. The transition continues to be planned against evidence describing the year before last. And the first serious public dispute about a national figure is met with days of ministries telephoning one another while the doubt hardens.";

export const STAGES: LabelledPara[] = [
  {
    label: "Stage 1 — Confidential Cabinet briefing",
    body: "Sixty minutes, in person or over secure video, under NDA on request, nothing recorded. Prepared against the nation's own public data, so what is seen is that economy rather than a generic demonstration.",
  },
  {
    label: "Stage 2 — Time-boxed pilot",
    body: "Against one live decision, with the Ledger instrumented underneath from day one and agreed criteria for what converts it. A pilot without conversion criteria becomes a free consulting engagement that ends when the sponsor changes job; we would rather name that in advance.",
  },
  {
    label: "Stage 3 — National deployment",
    body: "One isolated instance per nation, owned outright by the government, with contracted export, escrow and exit, and a hosting region chosen with the government.",
  },
];

export const SEVEN_QUESTIONS = [
  "Show me the source document behind this figure, and its confidence grade.",
  "Run this projection again and give me the identical numbers.",
  "Tell me who in this government has read this analysis, and when.",
  "Show me the decision this analysis led to, its named owner, and where it stands.",
  "Where is this data held, under whose keys, and in which jurisdiction?",
  "If we stop paying you, what do we keep — and in what format?",
  "Who is accountable, by name, when this is wrong?",
];

export const RECOMMENDATION =
  "Proceed to a confidential Cabinet briefing, and require the seven-question test above of us and of every alternative considered.";

export const SOURCES: Array<{ figure: string; grade: string; source: string }> = [
  {
    figure: "CBI share of government revenue, upper band — 50%",
    grade: "B",
    source: "IMF Article IV consultations, 2022–2024.",
  },
  { figure: "Debt-to-GDP, upper band — 90%", grade: "A", source: "IMF World Economic Outlook, 2024." },
  {
    figure: "Interest as a share of revenue, high-debt cases — c. 25%",
    grade: "B",
    source: "IMF Article IV consultations.",
  },
  {
    figure: "Hurricane Maria cost to Dominica — 226% of GDP",
    grade: "A",
    source: "Government of Dominica Post-Disaster Needs Assessment, 2017.",
  },
  {
    figure: "Authoritative sector data lag to Cabinet — c. 18 months",
    grade: "B",
    source: "ECCB & national statistical office release cadence review, 2024.",
  },
  {
    figure: "Tertiary-educated emigration rate, upper-band Caribbean states — 70%",
    grade: "A",
    source: "World Bank / OECD DIOC skilled-migration database, 2020.",
  },
  {
    figure: "OECS votes on the OECD Inclusive Framework steering committee — 0",
    grade: "A",
    source: "OECD Inclusive Framework governance roster, 2024.",
  },
];

export const SOURCES_NOTE =
  "Every figure in this paper is published with the grade GDPVision assigns it. A grade is not a claim of accuracy — it is a statement of how much weight a number will bear. We publish ours because we ask governments to do the same.";
