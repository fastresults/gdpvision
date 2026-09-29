// @domain marketing
// @tables none
// @ui src/routes/business-case.tsx
//
// Public copy for the GDPVision decision paper ("The business case").
// Single source of truth for the page — the route component is presentational.

export const BUSINESS_CASE_META = {
  eyebrow: "A decision paper",
  title: "Decide whether GDPVision belongs in government.",
  standfirst:
    "Why national economic decisions need a governed, government-controlled system—prepared for heads of government, Cabinet Secretaries, ministries of finance, and officials responsible for deciding whether GDPVision should be procured.",
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
    body: "Whether to manage national economic decisions through a governed system under government control—or continue relying on arrangements built only to publish statistics and on uncontrolled personal use of consumer AI inside ministries.",
  },
  {
    label: "Why now",
    body: "Three pressures now arrive at once. Citizenship by Investment, which can provide half of government revenue, faces a scheduled end without a costed replacement. Trade rules are being rewritten in capitals the region does not control. The hurricane threat is rising after one storm cost 226 per cent of GDP. Government must respond while debt can reach ninety per cent of GDP, interest already takes a quarter of revenue, and official data may arrive eighteen months late.",
  },
  {
    label: "The central argument",
    body: "A government can act only as well as the information and decision tools available to it. The region’s existing systems were built to publish a record of the past, not to guide live decisions. They are not enough for the economic transition now under way.",
  },
  {
    label: "On the obvious cheap answer",
    body: "A capable official using a leading AI model can draft a note, summarise a report, and compare two options. But an AI model is only one part of a government system. It keeps no shared national evidence record, may answer the same question differently, cannot enforce official roles, and should not receive Cabinet material through a personal account. Government is already using AI. The decision is whether that use will be governed.",
  },
  {
    label: "What is recommended",
    body: "Begin with a confidential Cabinet briefing. Then run a time-limited pilot against one live decision, with agreed tests for moving to national use. If those tests are met, deploy a separate system for the country, owned by government, with written rights to export its data and leave the service.",
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
  "Taken together, the problem is clear. A revenue model that can fund half the state is ending. Trade rules that shape competitiveness are being written elsewhere. Hurricanes are now a permanent risk to national finances, not a seasonal concern. Government faces all three with little room in the budget, fewer skilled people, and evidence that may describe the country as it was two years ago. The problem is not a lack of effort. It is a lack of decision tools fit for the transition ahead.";

export const INSTRUMENTATION_INTRO = [
  "It would be easy to attribute the gap to capacity or to will. In my experience that is both wrong and unfair.",
  "Officials in these ministries are capable and overworked. The analysis has not been done because the underlying evidence does not exist in a usable form. Ministries hold fragments in incompatible formats. The dependency relationships between sectors — what happens to construction when tourism moves, what happens to public revenue when construction moves — live in the heads of a small number of people, some of them close to retirement.",
  "When Cabinet asks what happens if half the revenue disappears, a ministry may need months to commission an answer. The study can arrive after the decision window has closed, describing conditions that have already changed.",
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
  "Leading AI models are powerful. With a consumer subscription, a competent permanent secretary can summarise an IMF review, draft a Cabinet note, compare two policy options, outline an investment case, and prepare a press line in an afternoon. Why procure anything more?",
  "Most of that is true, and any vendor who denies it should be treated with suspicion. An official who is not using these tools is at a disadvantage to one who is.",
  "The comparison misses an important distinction. An AI model is one component, not a complete government system. GDPVision uses several models through a controlled service, records the source and history of returned facts, and has a documented backup order. The real choice is between ungoverned and governed AI use.",
];

export const CANNOTS: LabelledPara[] = [
  {
    label: "It cannot hold what your government knows",
    body: "A personal chat starts again each time and disappears when the session closes. Nothing builds into a shared government record. Fifteen officials can quickly produce fifteen different, unreconciled views.",
  },
  {
    label: "It cannot lawfully receive your Cabinet material",
    body: "To get a useful answer an official must paste in the thing that makes it useful — the draft budget, the term sheet, the memorandum — into a service hosted elsewhere, under terms no ministry has reviewed, with retention the government cannot audit.",
  },
  {
    label: "It cannot reproduce its own answer",
    body: "Ask the same fiscal question twice and a chat tool may give two answers. GDPVision separates advice from calculation: AI proposes, while a fixed, versioned calculation produces the numbers. A projection made in March can be run again with the same inputs in September and return the same result.",
  },
  {
    label: "It has one actor",
    body: "Government work involves many people with different authority: one official maintains a data series, a minister reviews a portfolio, a principal decides, and a secretary records. A personal chat does not understand those roles. GDPVision enforces each person’s access in the underlying data system, not merely by hiding buttons on a screen.",
  },
  {
    label: "It produces text, not a record",
    body: "A chat session produces a message. GDPVision produces a permanent government record. A scenario keeps its assumptions; a Cabinet decision becomes a commitment with a named owner; and delivery is measured against the mandate each quarter. Work moves between the ten Chambers without being retyped, reducing the handoffs where government work is often lost.",
  },
  {
    label: "It waits to be asked",
    body: "A source may become unavailable or an overnight research task may fail. GDPVision keeps working: it gathers and groups new reporting, refreshes watchlists, retries unavailable sources, and restarts failed work through a documented backup process.",
  },
  {
    label: "And it cannot be governed",
    body: "A personal chat has no approval process and no permanent record of its advice. GDPVision applies a clear rule: the system drafts, authorised principals decide, and nothing is released automatically. Every route from a new signal to a public statement passes through a named, accountable official.",
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
  "Every government runs a small number of tier-one systems—systems important enough to require formal control, continuity, and senior approval. These include treasury and financial management, revenue collection, the national identity register, and payment infrastructure.",
  "Nobody evaluates a treasury system against a spreadsheet. Not because spreadsheets are bad at arithmetic, but because the two objects are in different classes — and the class is determined by consequence, not capability.",
];

export const TIER_ONE_TESTS: Array<{ test: string; chat: string; instrument: string }> = [
  { test: "System of record others read as authoritative", chat: "No", instrument: "Yes" },
  {
    test: "Multi-actor, permissioned, enforced",
    chat: "No",
    instrument: "Yes — enforced for each record in the data system",
  },
  { test: "Outputs auditable after the fact", chat: "No", instrument: "Yes — immutable audit log" },
  {
    test: "Outputs reproducible",
    chat: "No",
    instrument: "Yes — fixed calculation, recorded version",
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
  "The question is not whether GDPVision beats the price of a subscription. It is whether the evidence behind decisions affecting half of government revenue requires the same formal control as other critical national systems. Answering “no” is itself a decision, whether intended or not.";

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
    owns: ["Accounts", "Sessions", "Drafts"],
    body: "This has a low recurring cost per person. After three years, however, government owns no shared evidence record, decision history, or measured mandate that can transfer to a successor. Stop paying and the capability ends because the work remained in individual sessions. Government is renting assistance, not building a national asset.",
  },
  {
    key: "B",
    title: "Build it internally",
    owns: ["Code", "Staffing", "Liability"],
    body: "This requires major upfront investment and permanent specialist staff. The work goes far beyond adding chat to a document library. It requires secure access rules, economic methods, a shared structure for national data, repeatable calculations, duplicate controls, a twenty-stage country setup process, checks that reject unbalanced capital-flow drafts, permanent activity records, and reliable movement of work between Chambers. It also requires continuing maintenance in a labour market already losing skilled people. The hardest part is not writing software; it is encoding sound government and economic judgement.",
  },
  {
    key: "C",
    title: "Procure the instrument",
    owns: ["Evidence", "Decisions", "Mandate"],
    body: "Government owns the deployment in both contract and practice, with full data export and verified deletion when the service ends. After three years, it holds a structured record of its economy, a decision history spanning several Cabinets, quarterly results against the mandate, and a map of how sectors depend on one another. All can transfer to the next administration.",
  },
];

export const OPTIONS_CLOSE =
  "For a government carrying debt at ninety per cent of GDP, the distinction between recurring expenditure that leaves a residue and recurring expenditure that does not is not philosophical. It is how the estimates are argued.";

export const INSTRUMENT_INTRO =
  "Ten Chambers connect national evidence, decisions, delivery, and accountability.";

export const CHAMBER_LINES: Record<string, string> = {
  "01": "A shared structure for twelve sectors, with a decade of history, a confidence grade on every data series, major risks linked to their sources, and detailed sector records. It is the trusted evidence base used by every other Chamber.",
  "02": "Every minister's contribution to GDP as a standing figure, their dependency web, and their levers ranked by effect with the cost of each attached.",
  "03": "Test a decision before committing. See how effects move between sectors, work backwards from the result Cabinet needs, compare which assumptions matter most, and show what each gain may cost elsewhere.",
  "04": "Price the revenue gap year by year under the planned transition. Build investment packages with realistic links between capital and GDP, make time to impact clear, assess readiness across law, land, workforce, incentives, and institutions, and sequence the investment pipeline across years.",
  "05": "Monitoring, response and syndication in one place. Entity feeds and watchlists refreshed on schedule, a signal desk ordered by economic consequence, structured strategy, channel drafts, an explicit approval workflow, scheduled publication, and a retained archive of what was issued.",
  "06": "Support the Cabinet meeting itself, record decisions live with named owners, keep commitments visible between sessions, and update a National Scorecard against consistent measures.",
  "07": "Rehearsing how a policy, incentive or message lands, privately, before announcement. Explicitly a rehearsal instrument and not a substitute for polling.",
  "08": "Turn the manifesto into priorities, pledges, and ministry-owned deliverables. Use quarterly scorecards and a Prime Minister’s Report Card, keep a signed record of every change, and pass the approved plan directly to the Narrative Chamber so public statements match government decisions.",
  "09": "Define the nation’s e-government platform from its own evidence in eleven sourced sections, with independent approval. A secure, read-only connection supplies approved indicators, commitments, government structure, open data, procurement, and projects so the public site is not maintained by retyping records.",
  "10": "Run sector development as a continuing government programme. Rank every sector from the evidence, choose up to four national priorities with a written rule for ending support, and prepare a complete plan for each sector. Two people approve the plan before it goes to Cabinet as a commitment.",
};

export const CORPUS_FOOTNOTE =
  "Underneath all of it is one national evidence record. Public evidence and private Cabinet material remain separate but can be considered together. Duplicate information is removed, and every record states who owns it and who may see it.";

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
    body: "When seven in ten highly educated citizens have emigrated, a national evidence record helps preserve knowledge when officials leave.",
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
    body: "Buying a method they can examine: documented confidence grades, repeatable projections, views showing which assumptions matter, and a clear link to every source. They will ask the same question twice and notice if the answers differ.",
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
  "Some of it they could. The hard parts are not the screens. They are the shared structure that lets figures from different ministries appear in one picture; the confidence-grading method; the rules that prevent duplicate evidence; the checks that reject an unbalanced capital-flow draft; the separation between AI advice and repeatable calculation; and the judgement that a minister may have ninety seconds on a phone between engagements, not an afternoon at a dashboard.",
  "Those do not come from software experience. They come from having been in the room.",
  "OPEN Interactive has convened the Caribbean Investment Summit since 2009, delivered national digital government infrastructure through a confidential engagement with the Office of the Prime Minister of St. Kitts & Nevis, and maintained relationships with heads of government across the OECS for seventeen years. SEDE, the Saint Lucia prototype, proved the core approach through a live economic model, voice access, detailed evidence records, and a controlled process for adding documents and data.",
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
    body: "Test GDPVision against one live decision, with the National Ledger in place from day one and agreed tests for moving to national use. Without those tests, a pilot can become an open-ended exercise that ends when its sponsor changes role. The path should be agreed in advance.",
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
  {
    figure: "Debt-to-GDP, upper band — 90%",
    grade: "A",
    source: "IMF World Economic Outlook, 2024.",
  },
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
