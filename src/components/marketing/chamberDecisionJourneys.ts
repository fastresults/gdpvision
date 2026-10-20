import { CHAMBER_NAMES, SCENARIOS, type Scenario } from "./dataDecisionScenarios";
import { MORE_BENEFITS, PROFILES, type JourneyProfile } from "./chamberJourneyExtras";
import { visualAudit } from "./journeys/journeyVisuals";
import { evidenceChips } from "./journeys/journeyRouting";

export const JOURNEY_ACTS = [
  "The priority",
  "Frame the question",
  "Check the data",
  "Select the Chamber",
  "Work through options",
  "Government value",
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
    name: "National Data Ledger",
    stages: [
      "Frame the question",
      "Assemble cited figures",
      "Trace linked sectors",
      "Explain the movement",
      "Prepare one sourced position",
    ],
    output: "A defensible national position",
  },
  "02": {
    index: "02",
    name: "Ministry Growth & Delivery",
    stages: [
      "Read the mandate",
      "Show ministry responsibilities",
      "Show where ministries must work together",
      "Name one owner",
      "Agree ministry actions",
    ],
    output: "An accountable ministerial course",
  },
  "03": {
    index: "03",
    name: "Policy Scenario Engine",
    stages: [
      "Establish the baseline",
      "Test a change or disruption",
      "Compare projected economic effects",
      "Compare the trade-offs",
      "Prepare the Cabinet option",
    ],
    output: "A rehearsed policy choice",
  },
  "04": {
    index: "04",
    name: "Investment & Resilience Studio",
    stages: [
      "Measure the exposure",
      "Test national readiness",
      "Set the replacement target",
      "Prepare the investment offer",
      "Package for investors",
    ],
    output: "An investable national proposition",
  },
  "05": {
    index: "05",
    name: "National Confidence & Communications",
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
    name: "Cabinet Decisions & Delivery",
    stages: [
      "Order the decision queue",
      "Check data readiness",
      "Compare viable options",
      "Record the decision",
      "Assign the commitment",
    ],
    output: "A recorded decision with an owner",
  },
  "07": {
    index: "07",
    name: "Policy & Leadership Persona Lab",
    stages: [
      "Frame the proposition",
      "Build simulated profiles",
      "Explore possible reactions",
      "Find concerns and possible improvements",
      "Improve before release",
    ],
    output: "A policy explored before announcement",
  },
  "08": {
    index: "08",
    name: "Mandate Delivery & Accountability",
    stages: [
      "Read the pledge",
      "Link to an agreed priority",
      "Define the deliverable",
      "Name the lead, measure and date",
      "Review every quarter",
    ],
    output: "A mandate converted into delivery",
  },
  "09": {
    index: "09",
    name: "Digital Government Planning Studio",
    stages: [
      "Define the service problem",
      "Set service and privacy requirements",
      "Design the public service",
      "Verify and approve",
      "Release and measure",
    ],
    output: "A trusted digital public service",
  },
  "10": {
    index: "10",
    name: "Sector Growth & Delivery Studio",
    stages: [
      "Read sector data",
      "Choose the priority",
      "Find what holds growth back",
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
    knows: "Which sources and assumptions support the growth figure.",
    choice: "How to explain the figure and its limits to lenders.",
    risk: "Weak or conflicting data can be addressed before the meeting.",
    owner: "Finance and statistics leaders share one sourced brief.",
    measure: "Record questions and corrections for the next update.",
  },
  "Tourism shock": {
    knows: "Where falling visitor spending could affect output and jobs.",
    choice: "Which support options offer value within the available budget.",
    risk: "Possible knock-on effects are considered before committing money.",
    owner: "Name delivery leaders, dates and measures for the response.",
    measure: "Track visitor spending and jobs to check the assumptions.",
  },
  "A new minister": {
    knows: "Which sectors and programmes the minister is responsible for.",
    choice: "Which priorities should lead the first hundred days.",
    risk: "Find overlaps or neglected responsibilities before time is lost.",
    owner: "Agree actions with the minister and delivery teams.",
    measure: "Track progress against the agreed ministry priorities.",
  },
  "Overlapping programmes": {
    knows: "Where two ministries claim the same work or budget.",
    choice: "Which ministry leads and which supports the programme.",
    risk: "Challenge duplicate spending and unclear responsibility.",
    owner: "Record one delivery lead and an agreed budget.",
    measure: "Track programme spending and delivery in one place.",
  },
  "Revenue shock": {
    knows: "How large the revenue gap could be and when it arrives.",
    choice: "Which replacement options fit national priorities and budget limits.",
    risk: "Consider service and economic risks before choosing a response.",
    owner: "Cabinet assigns each agreed action to a responsible leader.",
    measure: "Compare revenue results with the original assumptions.",
  },
  "Closing the deficit": {
    knows: "What each tax or spending choice could mean for the economy.",
    choice: "How to balance budget savings with effects on households and businesses.",
    risk: "Expose assumptions and uncertainty before committing resources.",
    owner: "Treasury and ministries receive clearly agreed actions.",
    measure: "Review the budget and activity results against the plan.",
  },
  "Global promotion": {
    knows: "How the project compares with other investment opportunities.",
    choice: "What must be resolved before approaching investors.",
    risk: "Identify legal, land, workforce and incentive gaps early.",
    owner: "One investment lead owns the reviewed project information.",
    measure: "Use investor questions and feedback to improve the offer.",
  },
  "Investor exit": {
    knows: "The jobs, revenue and supply chains that could be affected.",
    choice: "Whether to negotiate, seek replacements or prepare for an exit.",
    risk: "Compare incentive costs before making an expensive offer.",
    owner: "Give negotiators clear limits and assign contingency actions.",
    measure: "Track jobs, revenue and replacement investment.",
  },
  "Cabinet scandal": {
    knows: "Which facts are verified and which must remain protected.",
    choice: "What government can truthfully say and do next.",
    risk: "Check disclosure risks and contradictory statements before release.",
    owner: "Responsible leaders own the response and continuing priorities.",
    measure: "Record feedback and progress on agreed corrective actions.",
  },
  "Disaster preparation": {
    knows: "Which communities, shelters and supplies need attention.",
    choice: "Which public guidance and preparation tasks come first.",
    risk: "Identify gaps in information and coordination before the emergency.",
    owner: "Assign every preparation action to a ministry and deadline.",
    measure: "Review readiness and recovery to improve the next plan.",
  },
  "Crowded agenda": {
    knows: "Which decisions are urgent and supported by enough data.",
    choice: "What Cabinet should decide now or return for more work.",
    risk: "Keep low-priority debate from crowding out important action.",
    owner: "Record the responsible leader for each approved action.",
    measure: "Track waiting decisions and delivery between meetings.",
  },
  "Slipping commitment": {
    knows: "What is delayed and what the delay could affect.",
    choice: "Whether to intervene or revise the plan and timetable.",
    risk: "Flag unresolved delays before they become larger failures.",
    owner: "Give the revised action a responsible leader and realistic date.",
    measure: "Record changes and review whether delivery improves.",
  },
  "Testing a new tax": {
    knows: "Possible household concerns identified through simulated profiles.",
    choice: "How the design and explanation could be improved before review.",
    risk: "Explore possible resistance; simulations do not prove public acceptance.",
    owner: "Finance, service teams and communications have clear roles.",
    measure: "Compare actual response and revenue with the assumptions after launch.",
  },
  "Diaspora bond": {
    knows: "Possible investor concerns explored with simulated profiles.",
    choice: "Which terms and project purpose need further investor review.",
    risk: "Identify weaknesses before asking citizens abroad to invest.",
    owner: "Assign the offer and investor discussions to a responsible team.",
    measure: "Track actual demand and use of any funds raised.",
  },
  "Manifesto to delivery": {
    knows: "Which ministry is responsible for each government promise.",
    choice: "Which commitments should enter the first delivery period.",
    risk: "Identify promises without costs, owners or a delivery plan.",
    owner: "Record agreed ministry actions and responsible leaders.",
    measure: "Bring reviewed results into the next public progress report.",
  },
  "Quarterly review": {
    knows: "Which commitments are delayed and what is holding them back.",
    choice: "Where to intervene, reallocate resources or revise dates.",
    risk: "Identify delivery risks while there is still time to respond.",
    owner: "Give every correction a leader, date and progress measure.",
    measure: "Check at the next review whether the changes worked.",
  },
  "One-day registration": {
    knows: "Where applicants lose time and money in the process.",
    choice: "Which service changes could move toward the one-day target.",
    risk: "Check that the process is improved—not just put online.",
    owner: "Assign agency actions, approvals and delivery dates.",
    measure: "Track completion time, abandoned applications and use of the service.",
  },
  "National digital ID": {
    knows: "The service need, privacy rules and required approvals.",
    choice: "Which phased plan could improve access without excluding people.",
    risk: "Identify data misuse and access risks before approving a design.",
    owner: "Separate identity, privacy and service responsibilities.",
    measure: "Track use, access issues and whether privacy checks are working.",
  },
  "Budget priorities": {
    knows: "Where sector data suggests opportunities for economic progress.",
    choice: "Which three priorities deserve funding and further review.",
    risk: "Challenge weak assumptions before allocating limited public money.",
    owner: "Each chosen sector has a plan and responsible ministry.",
    measure: "Compare spending and milestones with sector results.",
  },
  "Agriculture growth plan": {
    knows: "Where production barriers and food imports create opportunities.",
    choice: "Which projects could improve local output and attract funding.",
    risk: "Separate proposed benefits from projects ready for funding review.",
    owner: "Name public and private delivery responsibilities.",
    measure: "Track production, imports, jobs and investment against the plan.",
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
  const details: StageDetail[] = [];
  const sources = evidenceChips(scenario)
    .map((chip) => chip.label)
    .join(" · ");
  method.stages.forEach((stage, index) => {
    const step = scenario.steps[Math.min(index, scenario.steps.length - 1)];
    details.push({
      stage,
      input: index === 0 ? sources : details[index - 1].output,
      output: index === 4 ? scenario.outcome : step.text,
    });
  });
  return details;
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
      journey.method.stages.length !== 5 ||
      !visualAudit(journey).complete
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
