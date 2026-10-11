import { CHAMBER_NAMES, SCENARIOS, type Scenario } from "./dataDecisionScenarios";
import { MORE_BENEFITS, PROFILES, type JourneyProfile } from "./chamberJourneyExtras";

export const JOURNEY_ACTS = [
  "The question",
  "Ask GDPVision",
  "Governed evidence",
  "Select the Chamber",
  "Open the Chamber",
  "Prime Minister value",
] as const;

export interface ChamberMethod {
  index: string;
  name: string;
  stages: [string, string, string, string, string];
  output: string;
}

export const CHAMBER_METHODS: Record<string, ChamberMethod> = {
  "01": {
    index: "01",
    name: "National Ledger",
    stages: [
      "Frame the question",
      "Assemble cited figures",
      "Trace linked sectors",
      "Explain the movement",
      "Defend one position",
    ],
    output: "A defensible national position",
  },
  "02": {
    index: "02",
    name: "Portfolio Workspaces",
    stages: [
      "Read the mandate",
      "Map ministerial influence",
      "Expose dependencies",
      "Name one owner",
      "Set ministerial action",
    ],
    output: "An accountable ministerial course",
  },
  "03": {
    index: "03",
    name: "Scenario Engine",
    stages: [
      "Establish the baseline",
      "Apply shock and levers",
      "Model GDP, debt and FX",
      "Compare the trade-offs",
      "Prepare the Cabinet option",
    ],
    output: "A rehearsed policy choice",
  },
  "04": {
    index: "04",
    name: "FDI Transition Studio",
    stages: [
      "Measure the exposure",
      "Test national readiness",
      "Set the replacement target",
      "Shape the proposition",
      "Package for investors",
    ],
    output: "An investable national proposition",
  },
  "05": {
    index: "05",
    name: "Narrative Chamber",
    stages: [
      "Receive the signal",
      "Establish verified facts",
      "Set the national position",
      "Challenge-test the case",
      "Authorise the response",
    ],
    output: "A truthful, authorised response",
  },
  "06": {
    index: "06",
    name: "Cabinet Room",
    stages: [
      "Order the decision queue",
      "Check evidence readiness",
      "Compare viable options",
      "Record the decision",
      "Assign the commitment",
    ],
    output: "A governed decision with an owner",
  },
  "07": {
    index: "07",
    name: "Persona Lab",
    stages: [
      "Frame the proposition",
      "Design the audiences",
      "Simulate response",
      "Find friction and acceptance",
      "Improve before release",
    ],
    output: "A policy tested before exposure",
  },
  "08": {
    index: "08",
    name: "Mandate Compact",
    stages: [
      "Read the pledge",
      "Set the governing pillar",
      "Define the deliverable",
      "Name owner, KPI and date",
      "Review every quarter",
    ],
    output: "A mandate converted into delivery",
  },
  "09": {
    index: "09",
    name: "Digital Government Studio",
    stages: [
      "Define the service problem",
      "Write governed requirements",
      "Design the public service",
      "Verify and approve",
      "Release and measure",
    ],
    output: "A trusted digital public service",
  },
  "10": {
    index: "10",
    name: "Sector Studio",
    stages: [
      "Read sector evidence",
      "Choose the priority",
      "Diagnose the constraint",
      "Build projects and roadmap",
      "Commit through Cabinet",
    ],
    output: "An accountable sector growth plan",
  },
};

interface BenefitSeed {
  knows: string;
  choice: string;
  risk: string;
  owner: string;
  measure: string;
}

const BENEFITS: Record<string, BenefitSeed> = {
  "Defending the growth figure": {
    knows: "Which sources and assumptions support the national growth figure.",
    choice: "How to answer lenders and ratings agencies with one position.",
    risk: "A credibility challenge is exposed before it becomes a confidence shock.",
    owner: "The finance and statistics principals leave with one defensible brief.",
    measure: "Questions, revisions and source quality return to the national record.",
  },
  "Tourism shock": {
    knows: "The GDP, revenue, foreign-exchange and employment exposure in one cited view.",
    choice: "Which response protects the economy with the least fiscal damage.",
    risk: "Second-round effects on jobs, imports and confidence are visible before action.",
    owner: "A named owner, timetable and measures carry the choice into delivery.",
    measure: "Actual arrivals, receipts and jobs improve the next shock response.",
  },
  "A new minister": {
    knows: "Which sectors, programmes and growth levers sit within the new portfolio.",
    choice: "What belongs in the minister's first hundred days.",
    risk: "Overlaps and unattended responsibilities appear before time is lost.",
    owner: "The minister and delivery leads receive named commitments.",
    measure: "Portfolio KPIs show whether the first priorities are moving.",
  },
  "Overlapping programmes": {
    knows: "Where two mandates, budgets and delivery chains collide.",
    choice: "Which ministry should lead and which should support.",
    risk: "Duplicate spending and split accountability are removed.",
    owner: "One programme has one accountable owner and budget.",
    measure: "Delivery and expenditure are tracked once, not twice.",
  },
  "Revenue shock": {
    knows: "The size, timing and sector effects of the revenue gap.",
    choice: "Which replacement mix protects growth and fiscal stability.",
    risk: "A slow-moving revenue loss is treated before it becomes a crisis.",
    owner: "Cabinet assigns each replacement action to a principal.",
    measure: "Revenue recovery and GDP effects update the next scenario.",
  },
  "Closing the deficit": {
    knows: "How each fiscal option affects debt, jobs, prices and growth.",
    choice: "The least damaging balance of revenue and expenditure measures.",
    risk: "Hidden distributional and growth costs are exposed before commitment.",
    owner: "Treasury and spending ministries receive explicit actions.",
    measure: "Deficit, debt and activity results test the original assumptions.",
  },
  "Global promotion": {
    knows: "How the project compares with competing offers and investor requirements.",
    choice: "What must be fixed before the project reaches the market.",
    risk: "Legal, land, workforce and incentive gaps are exposed early.",
    owner: "One investment lead owns a complete, governed package.",
    measure: "Investor interest, diligence questions and commitments refine the proposition.",
  },
  "Investor exit": {
    knows: "The investor's real contribution to jobs, revenue and supply chains.",
    choice: "Whether to retain, replace or manage an orderly exit.",
    risk: "The state avoids both panic and an excessive retention subsidy.",
    owner: "A negotiating mandate and contingency plan have clear owners.",
    measure: "Jobs, revenue and replacement capital track the response.",
  },
  "Cabinet scandal": {
    knows: "Which facts are verified, private and safe to release.",
    choice: "The truthful national position and sequence of response.",
    risk: "Contradiction, unlawful disclosure and decision paralysis are contained.",
    owner: "Authorised principals own the response and continuing government business.",
    measure: "Public reaction and operational continuity inform the next update.",
  },
  "Disaster preparation": {
    knows: "Which people, places and supplies face the greatest immediate risk.",
    choice: "What the public must hear and do first.",
    risk: "Confusion and uncoordinated ministry action are reduced.",
    owner: "Every preparation commitment has a ministry and deadline.",
    measure: "Readiness, reach and recovery results improve the next plan.",
  },
  "Crowded agenda": {
    knows: "Which Cabinet decisions carry the greatest value and urgency.",
    choice: "What must be decided now, deferred or returned for evidence.",
    risk: "Low-value debate no longer crowds out national priorities.",
    owner: "Every selected decision leaves with a recorded owner.",
    measure: "Decision delay and commitment progress remain visible between sessions.",
  },
  "Slipping commitment": {
    knows: "Why the flagship commitment is late and what it now threatens.",
    choice: "Whether to intervene, replace the owner or re-plan honestly.",
    risk: "A recoverable delay is stopped before it becomes a silent failure.",
    owner: "The revised commitment has one owner and a credible date.",
    measure: "Progress and changes remain visible on the national record.",
  },
  "Testing a new tax": {
    knows: "Who bears the reform and where acceptance is most fragile.",
    choice: "How to redesign and explain the tax before announcement.",
    risk: "Reversal, non-compliance and avoidable public resistance are reduced.",
    owner: "Finance, delivery and communications responsibilities are explicit.",
    measure: "Understanding, acceptance and revenue results improve the policy.",
  },
  "Diaspora bond": {
    knows: "Which diaspora segments are willing to invest and on what terms.",
    choice: "The purpose, tenor and trust signals most likely to succeed.",
    risk: "A weak offer is corrected before national credibility is spent.",
    owner: "One issuance team owns the proposition and investor dialogue.",
    measure: "Demand, conversion and use of proceeds remain on the record.",
  },
  "Manifesto to delivery": {
    knows: "Every promise, responsible ministry and required measure.",
    choice: "Which commitments enter the first delivery cycle.",
    risk: "Promises without owners, dates or evidence are exposed.",
    owner: "Each pledge becomes a signed ministerial commitment.",
    measure: "Quarterly results return to the public national record.",
  },
  "Quarterly review": {
    knows: "Which commitments are off track and the constraint behind each one.",
    choice: "Where to intervene, reallocate or revise transparently.",
    risk: "Delivery slippage is corrected before the annual reckoning.",
    owner: "Every correction has a principal, date and measure.",
    measure: "The next quarterly review tests whether intervention worked.",
  },
  "One-day registration": {
    knows: "Where six weeks of delay and cost enter the service.",
    choice: "Which governed redesign can reduce registration to one day.",
    risk: "Digitising a broken process without reforming it is avoided.",
    owner: "Agencies, approvals and release dates form one commitment chain.",
    measure: "Completion time, drop-off and new trading activity are recorded.",
  },
  "National digital ID": {
    knows: "The service need, privacy boundary and approval requirements.",
    choice: "A phased identity design that citizens can trust.",
    risk: "Data misuse, exclusion and institutional ambiguity are confronted early.",
    owner: "Identity, privacy and service principals have separate accountable roles.",
    measure: "Uptake, service access and safeguards remain independently visible.",
  },
  "Budget priorities": {
    knows: "Which sectors can move output and where evidence is strongest.",
    choice: "The three priorities the next budget should back.",
    risk: "Political dispersion and low-return allocation are made explicit.",
    owner: "Each selected sector receives a plan and Cabinet owner.",
    measure: "Spending, milestones and sector output test the priority choice.",
  },
  "Agriculture growth plan": {
    knows: "Where imports, production constraints and investable opportunities intersect.",
    choice: "Which projects can lower the import bill and grow rural output.",
    risk: "Unfunded ambition is separated from bankable delivery.",
    owner: "Projects leave with public and private delivery leads.",
    measure: "Imports, production, jobs and investment update the sector plan.",
  },
};

Object.entries(MORE_BENEFITS).forEach(([title, [knows, choice, risk, owner, measure]]) => {
  BENEFITS[title] = { knows, choice, risk, owner, measure };
});

export interface StageDetail {
  stage: string;
  input: string;
  output: string;
}

export interface ChamberJourney extends Scenario {
  id: string;
  method: ChamberMethod;
  benefits: BenefitSeed;
  featured: boolean;
  profile: JourneyProfile;
  stageDetail: StageDetail[];
}

const FEATURED = new Set([
  "72-hour tourism shock",
  "Closing the deficit",
  "Investor exit",
  "National digital ID",
  "Hurricane in 96 hours",
  "Article IV mission",
]);

/** Map the journey's own route steps onto the Chamber's five method stages. */
function buildStages(scenario: Scenario, method: ChamberMethod): StageDetail[] {
  const steps = scenario.steps.map((step) => step.text);
  return method.stages.map((stage, index) => {
    const step = steps[Math.min(steps.length - 1, Math.round((index * (steps.length - 1)) / 4))];
    const [left, rest = left] = step.split("→").map((part) => part.trim());
    const colon = rest.indexOf(":");
    const out = colon >= 0 ? rest.slice(colon + 1).trim() : rest;
    return {
      stage,
      input: left,
      output: index === 4 ? scenario.outcome : out.charAt(0).toUpperCase() + out.slice(1),
    };
  });
}

const toJourney = (scenario: Scenario, overrides: Partial<ChamberJourney> = {}): ChamberJourney => {
  const method = CHAMBER_METHODS[scenario.chamber];
  return {
    ...scenario,
    id: `${scenario.chamber}-${scenario.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")}`,
    method,
    benefits: BENEFITS[scenario.title],
    featured: FEATURED.has(scenario.title),
    profile: PROFILES[scenario.title],
    stageDetail: buildStages(scenario, method),
    ...overrides,
  };
};

const STANDARD_JOURNEYS: ChamberJourney[] = SCENARIOS.map((scenario) => toJourney(scenario));

const tourismSource = SCENARIOS.find((scenario) => scenario.title === "Tourism shock");
const openingJourney: ChamberJourney | null = tourismSource
  ? toJourney(
      { ...tourismSource, chamber: "03" },
      {
        id: "03-72-hour-tourism-shock",
        title: "72-hour tourism shock",
        question:
          "Tourism receipts fall sharply — what should the Prime Minister do in the next 72 hours?",
        benefits: BENEFITS["Tourism shock"],
        profile: PROFILES["Tourism shock"],
        featured: true,
      },
    )
  : null;

export const CHAMBER_JOURNEYS: ChamberJourney[] = openingJourney
  ? [openingJourney, ...STANDARD_JOURNEYS]
  : STANDARD_JOURNEYS;

if (import.meta.env.DEV) {
  CHAMBER_JOURNEYS.forEach((journey) => {
    if (
      !journey.method ||
      !journey.benefits ||
      !journey.profile ||
      journey.method.stages.length !== 5
    ) {
      console.error(`[ChamberDecisionJourneys] incomplete journey: ${journey.title}`);
    }
  });
  Object.keys(CHAMBER_NAMES).forEach((index) => {
    const count = SCENARIOS.filter((scenario) => scenario.chamber === index).length;
    if (count < 5) {
      console.error(`[ChamberDecisionJourneys] Chamber ${index} needs at least five journeys`);
    }
  });
}
