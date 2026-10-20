// @domain marketing
// @tables none
// @ui src/routes/business-case.tsx
// Public decision-paper copy and its data links. Deployment terms are not delivered outcomes.

export const BUSINESS_CASE_META = {
  eyebrow: "The business case for GDPVision",
  title: "Better national decisions. Stronger economic progress.",
  standfirst:
    "GDPVision connects national data, policy choices and government delivery in one system. It helps Cabinet and ministries direct resources, prepare investment and keep action accountable—with sources they can check and decisions that remain in government hands.",
  author: "Adam Anderson",
  org: "OPEN Interactive",
};
export interface LabelledPara {
  label: string;
  body: string;
}
export const EXECUTIVE_SUMMARY: LabelledPara[] = [
  {
    label: "The problem",
    body: "Government must make choices about spending, investment and resilience while the data sits across ministries. Reconciling that data can take attention away from the decision itself.",
  },
  {
    label: "The practical change",
    body: "Bring the data together, compare options, record an approved decision and follow its delivery. GDPVision connects these activities so Cabinet and ministries can work from a shared picture.",
  },
  {
    label: "The economic value",
    body: "Better-prepared investment, more focused public spending and clearer delivery responsibility can support economic progress. The value comes from the choices government makes and the action it delivers—not from software alone.",
  },
  {
    label: "What to verify",
    body: "Test the sources, methods, access controls and decision workflow. Agree the deployment, security, ownership and exit terms before committing; do not treat a demonstration as proof of national results.",
  },
  {
    label: "The next step",
    body: "Bring one real government decision to a briefing. Follow with a time-limited pilot, clear responsibilities and agreed tests. Decide on wider use only after reviewing the data from that pilot.",
  },
];
export const NOT_CLAIMED =
  "Potential value is not a proven result. This paper does not claim measured GDP growth, savings, revenue gained or time saved by GDPVision. Test the case against your country’s data and one real decision.";
export interface StakeFigure {
  value: number;
  unit?: string;
  decimals?: number;
  label: string;
  grade: "A" | "B" | "C" | "D";
  citation: string;
  sourceUrl: string;
  note: string;
}
const MARIA_URL =
  "https://www.gfdrr.org/en/publication/dominica-post-disaster-needs-assessment-following-hurricane-maria";
export const STAKES: StakeFigure[] = [
  {
    value: 226,
    unit: "%",
    label: "Damage and losses relative to Dominica’s 2016 GDP",
    grade: "A",
    citation: "Dominica Post-Disaster Needs Assessment · Hurricane Maria, 2017",
    sourceUrl: MARIA_URL,
    note: "The assessment estimated combined damage and economic losses equivalent to 226% of the previous year’s GDP. This is the cost of a specific disaster—not a fall of 226% in annual GDP, nor a forecast for another country.",
  },
];
export const PRESSURES: LabelledPara[] = [
  {
    label: "Revenue resilience",
    body: "Reliance on a narrow revenue base makes government vulnerable when conditions or external rules change. Citizenship-investment income should be assessed country by country; replacement options need realistic costs and delivery times.",
  },
  {
    label: "Investment readiness",
    body: "Investors need answers about land, approvals, infrastructure and workforce. A credible proposal connects those requirements to data and identifies what government must resolve.",
  },
  {
    label: "Delivery capacity",
    body: "Budget constraints and staff turnover make coordination essential. A shared record helps ministries see priorities, dependencies and responsibility instead of rebuilding the picture for each decision.",
  },
];
export const STAKES_CLOSE =
  "The lesson is not that every country faces the same exposure. It is that major decisions need a clear view of revenue, risk and delivery capacity. Use regional experience as context; build the national decision on the country’s own data.";
export const INSTRUMENTATION_INTRO = [
  "Capable officials cannot make scattered information useful by effort alone. Ministries may hold different versions, reporting periods and definitions of the same issue.",
  "A useful system connects those records, identifies gaps and keeps assumptions visible. It should help government answer a question while there is still time to act—not simply produce another report.",
];
export const THREE_FAILURES: LabelledPara[] = [
  {
    label: "Agree the starting point",
    body: "Show where each figure comes from, when it was updated and what it measures. Differences between sources should be visible, not hidden behind a single confident number.",
  },
  {
    label: "Separate data from assumptions",
    body: "An official statistic and a working estimate should not look equally certain. Ministers need to know which conclusions are well supported and which depend on further checks.",
  },
  {
    label: "Compare before committing",
    body: "Make the choices, assumptions and trade-offs explicit. A scenario supports judgement; it does not remove uncertainty or replace government approval.",
  },
];
export const CHEAP_ANSWER_INTRO = [
  "AI tools can help officials summarise reports, draft notes and explore options. That assistance has real value. GDPVision also uses AI; the case is not that government should reject it.",
  "The additional requirement is a connected government workflow: shared data, defined methods, access controls, approvals and delivery records. A personal AI account does not establish that workflow on its own.",
  "Enterprise AI services can offer administration, retention controls and audit features. Those features still need to be assessed and connected to government’s data, responsibilities and legal requirements.",
];
export const CANNOTS: LabelledPara[] = [
  {
    label: "A shared data base",
    body: "Chat histories can persist, but individual conversations are not automatically a reconciled national record. GDPVision brings data into a common structure with sources and access rules.",
  },
  {
    label: "Appropriate handling of sensitive material",
    body: "Whether an AI service may receive Cabinet material depends on law, approved terms and configuration. Sensitive records require an agreed handling arrangement; the Sovereign Vault is the proposed in-country route for private-data analysis.",
  },
  {
    label: "Calculations that can be checked",
    body: "A fluent answer is not a verified economic calculation. GDPVision’s calculation tools expose inputs and assumptions; repeatability should be tested for the particular tool and version. AI-generated advice may vary.",
  },
  {
    label: "Authority and responsibility",
    body: "Government needs to know who can view, change, approve and act on information. Access controls and approval workflows must be verified against the actual users and records in the pilot.",
  },
  {
    label: "A decision that leads to action",
    body: "A draft note is only a starting point. The useful outcome is an approved decision with an owner, a delivery record and a way to review progress.",
  },
];
export const SHADOW_AI_INTRO = [
  "Where officials use personal AI accounts without an approved process, government can lose visibility over data and sensitive material. The response should be practical: approved tools, clear handling rules and responsibilities—not a blanket claim that all AI use is unsafe.",
];
export const SHADOW_LIABILITIES: LabelledPara[] = [
  {
    label: "Information handling",
    body: "Check what may be uploaded, where it is processed and retained, and who has access. A subscription alone is not permission to share sensitive records.",
  },
  {
    label: "Advice without a source",
    body: "A figure used in a Cabinet paper needs a source and a method. An AI answer should be checked before it becomes an official position.",
  },
  {
    label: "Competing versions",
    body: "Separate conversations can produce inconsistent assumptions and drafts. Agree the data and record the approved version.",
  },
  {
    label: "Knowledge tied to individuals",
    body: "Useful work should remain accessible to authorised successors when an official leaves. Continuity needs a shared record and agreed retention rules.",
  },
];
export const SHADOW_CLOSE =
  "The choice is how to make AI assistance useful, accountable and safe within government’s wider decision process. GDPVision should be judged on that added capability—not on a comparison with the price of a personal subscription alone.";
export const TIER_ONE_INTRO = [
  "The more consequential the decision, the more important it is to inspect the data, control access and record who approved action. Government needs these safeguards whether it builds a system or procures one.",
  "The comparison below concerns personal AI use without a government workflow. It is not a claim that enterprise AI services lack controls, or that every GDPVision deployment already meets every requirement.",
];
export const TIER_ONE_TESTS: Array<{ test: string; chat: string; instrument: string }> = [
  {
    test: "Shared national data",
    chat: "Individual histories; a shared, checked record must be organised separately",
    instrument: "Connected data records; verify coverage, source quality and update dates",
  },
  {
    test: "Access by responsibility",
    chat: "Personal accounts do not establish government roles",
    instrument: "Record-access controls; test permissions for the pilot’s users",
  },
  {
    test: "Traceable work",
    chat: "History may be retained; official decisions need a separate record",
    instrument: "Source and workflow records; inspect available audit coverage",
  },
  {
    test: "Checkable calculations",
    chat: "Generated answers may differ and require verification",
    instrument: "Inspect inputs, methods and supported calculation repeatability",
  },
  {
    test: "Sensitive-data custody",
    chat: "Depends on approved terms, law and configuration",
    instrument: "Agree cloud and Vault boundaries, hosting, keys and security testing",
  },
  {
    test: "Continuity and exit",
    chat: "Depends on account administration, retention and export arrangements",
    instrument: "Specify ownership, export, deletion, support and any escrow in the contract",
  },
];
export const TIER_ONE_CLOSE =
  "Require demonstrations and written commitments for the controls that matter to your government. A stronger model does not replace a sound method, an accountable official or an agreed deployment.";
export interface OptionPath {
  key: string;
  title: string;
  owns: string[];
  body: string;
}
export const OPTION_PATHS: OptionPath[] = [
  {
    key: "A",
    title: "Use AI tools with an approved process",
    owns: ["Drafting", "Research", "Internal controls"],
    body: "A practical way to improve individual work. Government must still organise shared data, calculations, approvals and delivery tracking. Enterprise features and export rights vary; assess the service rather than assuming they are absent.",
  },
  {
    key: "B",
    title: "Build and maintain a government system",
    owns: ["Internal capability", "Control", "Maintenance"],
    body: "Government can retain expertise and tailor the system to its needs. It must sustain the economic methods, security, data quality, integration and specialist staffing—not only the initial software build. Compare full lifecycle costs and delivery risk.",
  },
  {
    key: "C",
    title: "Evaluate GDPVision",
    owns: ["Connected data", "Decision workflow", "Delivery records"],
    body: "Test an existing connected approach rather than assembling each function separately. Value depends on trusted data quality, adoption and implementation. Agree costs, ownership, hosting, support and exit terms, and verify the pilot before wider deployment.",
  },
];
export const OPTIONS_CLOSE =
  "Compare what each option enables, what government must still provide and what remains usable if the arrangement ends. The right choice is the one that meets the country’s needs at an acceptable cost and risk.";
export const INSTRUMENT_INTRO =
  "Ten connected digital workspaces support different government responsibilities—from understanding the economy to approving action and tracking delivery.";
export const CHAMBER_LINES: Record<string, string> = {
  "01": "Bring national figures, sector data and sources into a shared picture. See the starting point, data gaps and confidence behind a decision.",
  "02": "Connect ministry responsibilities to economic priorities. See dependencies, coordinate action and keep delivery ownership clear.",
  "03": "Compare policy scenarios before committing. Examine projected effects, assumptions and trade-offs; treat the outputs as estimates, not forecasts guaranteed to occur.",
  "04": "Assess revenue exposure and investment readiness. Prepare proposals that connect funding needs to practical requirements and delivery timelines.",
  "05": "Track reporting, assess issues and prepare data-backed communications. Keep review and approval separate from drafting.",
  "06": "Prepare Cabinet decisions, record owners and commitments, and keep progress visible between meetings.",
  "07": "Explore how a policy or message could be received through simulated personas. Use the exercise to find questions and risks—not as polling or measured public opinion.",
  "08": "Turn government priorities into ministry-owned deliverables. Review progress and retain a clear record of approved changes.",
  "09": "Plan digital government services from national data. Define requirements and approved information flows rather than treating a generated plan as a delivered public service.",
  "10": "Compare sector priorities and prepare development plans. Connect data, delivery requirements and review before proposals become government commitments.",
};
export const CORPUS_FOOTNOTE =
  "The Second Brain is the connected national data library underneath these workspaces. Sources and records can be reused across authorised work. Public data and sensitive government material require distinct access and handling arrangements; private Vault records stay within the in-country boundary.";
export const WORTH_INTRO =
  "These are practical pathways to value, not measured GDPVision outcomes. A pilot should establish whether the system improves the specific work your government needs to do.";
export const WORTH: LabelledPara[] = [
  {
    label: "Put resources where they can deliver more",
    body: "Connect priorities to data, costs and delivery responsibilities. Government can compare where additional spending is justified and where the data needs strengthening.",
  },
  {
    label: "Prepare investment with fewer unanswered questions",
    body: "Bring land, infrastructure, approvals, workforce and timing into the proposal. Address readiness gaps before asking an investor to commit; preparation does not guarantee financing.",
  },
  {
    label: "Compare risks before committing",
    body: "Use scenarios to examine assumptions and exposure. Prepare response options in advance while recognising that a model cannot predict the exact course of a shock.",
  },
  {
    label: "Keep ministries working toward the same priorities",
    body: "Link decisions to owners and progress reviews. A visible commitment record helps government identify delays and decide when intervention is needed.",
  },
  {
    label: "Communicate from trusted data",
    body: "Prepare a consistent explanation of the decision, its basis and its uncertainties. Authorised officials remain responsible for what is approved and published.",
  },
  {
    label: "Retain knowledge beyond personnel changes",
    body: "Preserve sources, assumptions and approved decisions for authorised successors. Continuity depends on good records, access administration and agreed ownership and retention terms.",
  },
];
export const APPROVALS: LabelledPara[] = [
  {
    label: "Government leadership",
    body: "Is this useful for a real national priority? Can ministers inspect the data and retain responsibility for the decision?",
  },
  {
    label: "Cabinet coordination",
    body: "Does it fit the way officials prepare, approve and follow up decisions? Who owns the work and maintains the record?",
  },
  {
    label: "Finance and technical review",
    body: "Are the sources and methods credible? Can the relevant calculations be checked, and are costs, assumptions and uncertainty clear?",
  },
  {
    label: "Procurement and legal review",
    body: "Is the procurement route lawful? Specify supplier obligations, costs, ownership, support, export and exit rights, and any required escrow.",
  },
  {
    label: "Data protection and security",
    body: "Confirm what data is held where, who controls access and keys, and what testing is required. Verify the actual deployment and handling terms before using sensitive material.",
  },
];
export const APPROVALS_CLOSE =
  "These are five areas of responsibility, not a universal rule requiring five signatories. Your government’s laws, procurement process and data-protection requirements determine who must approve.";
export const PROVENANCE_PARAS = [
  "A government system needs more than well-designed screens. It must reflect how data is checked, how authority is exercised and how a decision becomes work that ministries can deliver.",
  "OPEN Interactive has convened the Caribbean Investment Summit since 2009 and delivered national digital government infrastructure through a confidential engagement with the Office of the Prime Minister of St. Kitts & Nevis. SEDE was the Saint Lucia prototype for the approach.",
  "That experience informs GDPVision’s focus on small-state government. It is relevant context—not a substitute for technical review, procurement checks or data from your own pilot.",
];
export const RISKS_PROCEEDING =
  "Poor data, limited adoption or unclear responsibility can undermine value. Control scope, verify methods and permissions, train the people who will use the system and agree supplier support, security and exit terms. The pilot should expose these risks before wider commitment.";
export const RISKS_NOT_PROCEEDING =
  "Keeping disconnected arrangements can leave government reconciling data repeatedly, losing knowledge when staff leave and struggling to follow decisions through delivery. These risks vary by country; assess the current process rather than assuming every ministry faces the same problem.";
export const STAGES: LabelledPara[] = [
  {
    label: "Briefing — choose the decision",
    body: "Bring one Cabinet or ministry priority. Review the available public data, the work required and the people who would use the system. Agree confidentiality arrangements before sharing sensitive information.",
  },
  {
    label: "Pilot — test the work",
    body: "Set a clear duration, scope and review point. Agree the data base, permissions, users and acceptance tests. Check sources, calculations, approvals and whether decisions can be followed through to owners and progress.",
  },
  {
    label: "Deployment — decide on the data",
    body: "Review the pilot before expanding. Agree national deployment boundaries, security, responsibilities, costs, ownership, support and export and exit terms in writing. Wider use is a government decision, not an automatic next step.",
  },
];
export const SEVEN_QUESTIONS = [
  "Can we open the source behind this figure and understand its date, scope and confidence?",
  "Can we inspect the inputs and repeat this supported calculation using the same method and version?",
  "Can we test who may view, change and approve this record, and inspect the available audit history?",
  "Can we trace this decision to its owner and review progress?",
  "Where will each type of data be held, who controls access and keys, and what security checks are required?",
  "If the arrangement ends, what can we keep, export or recover—and on what written terms?",
  "Who is responsible for checking the work, resolving errors and supporting government?",
];
export const RECOMMENDATION =
  "Start with one real decision and a briefing. Require these tests of GDPVision and every alternative. Proceed only when the data, controls and terms meet your government’s needs.";
export const SOURCES: Array<{ figure: string; grade: string; source: string; url: string }> = [
  {
    figure: "Hurricane Maria: damage and losses equivalent to 226% of Dominica’s 2016 GDP",
    grade: "A",
    source: "Government of Dominica · Post-Disaster Needs Assessment, 2017; hosted by GFDRR.",
    url: MARIA_URL,
  },
];
export const SOURCES_NOTE =
  "Grades are GDPVision’s assessment of the data, not a certification by the source. A means the stated historical figure is traceable to an official assessment; it does not establish the likely impact in another country. Check the source, date and definition before using it.";
