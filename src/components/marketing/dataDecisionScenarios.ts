// Scenario library for the Data & Decision Flow map — five journeys per Chamber.
import { MORE_SCENARIOS } from "./dataDecisionScenariosMore";
export interface Scenario {
  chamber: string;
  title: string;
  question: string;
  steps: { edges: [string, string][]; text: string }[];
  outcome: string;
  loop?: boolean;
}

export const CHAMBER_NAMES: Record<string, string> = {
  "01": "National Evidence Ledger",
  "02": "Ministry Growth & Delivery",
  "03": "Policy Scenario Engine",
  "04": "Investment & Resilience",
  "05": "Confidence & Communications",
  "06": "Cabinet Decisions & Delivery",
  "07": "Policy & Leadership Lab",
  "08": "Mandate & Accountability",
  "09": "Digital Government Planning",
  "10": "Sector Growth & Delivery",
};

export const CHAMBER_PURPOSES: Record<string, string> = {
  all: "See how the ten connected government workspaces bring evidence, decisions and delivery together.",
  "01": "Bring national figures and their sources together so government decisions start with reliable evidence.",
  "02": "Connect each ministry’s responsibilities to economic priorities and track delivery.",
  "03": "Compare potential costs, benefits and risks before committing to a policy.",
  "04": "Assess investment choices and prepare for shocks that could threaten economic progress.",
  "05": "Spot important media signals and prepare clear, evidence-backed government responses.",
  "06": "Turn Cabinet decisions into commitments with clear owners and progress tracking.",
  "07": "Explore how different groups and leadership perspectives may respond to policy choices.",
  "08": "Connect government promises to delivery milestones and accountable progress.",
  "09": "Plan public websites and services using national evidence and government approval.",
  "10": "Turn sector opportunities into practical plans with priorities, responsibilities and measures of progress.",
};

export const SCENARIOS: Scenario[] = [
  {
    chamber: "01",
    title: "Defending the growth figure",
    question: "The IMF questions our growth figure — can we defend it?",
    steps: [
      {
        edges: [
          ["stats", "corpus"],
          ["peers", "corpus"],
        ],
        text: "Gather official figures and country comparisons behind the growth estimate.",
      },
      {
        edges: [["corpus", "safeguards"]],
        text: "Check each source, its date and how reliable it is.",
      },
      {
        edges: [["safeguards", "c01"]],
        text: "Explain the growth figure and its assumptions in the evidence workspace.",
      },
      { edges: [["c01", "brief"]], text: "Prepare a short brief with figures ministers can check." },
      {
        edges: [["brief", "cabinet"]],
        text: "Cabinet agrees one evidence-based response to the IMF.",
      },
      { edges: [["cabinet", "delay"]], text: "Prepared evidence can help government respond without avoidable delay." },
    ],
    outcome: "A clearer case for lenders, with limitations openly explained.",
  },
  {
    chamber: "01",
    title: "Tourism shock",
    question: "Tourism arrivals drop 15% — how big is the hit to GDP?",
    steps: [
      {
        edges: [
          ["stats", "corpus"],
          ["flows", "corpus"],
        ],
        text: "Bring together visitor numbers and spending to understand the decline.",
      },
      {
        edges: [["corpus", "c01"]],
        text: "Trace the possible effects across tourism and related sectors.",
      },
      { edges: [["c01", "c03"]], text: "Compare possible responses and their projected economic effects." },
      { edges: [["c03", "brief"]], text: "Set out the options, costs and assumptions for review." },
      {
        edges: [["brief", "spend"]],
        text: "Use the brief to target support where jobs are most at risk.",
      },
    ],
    outcome: "Better-informed support for tourism and the businesses that depend on it.",
  },
  {
    chamber: "02",
    title: "A new minister",
    question: "A new minister takes office—which economic priorities should they lead?",
    steps: [
      {
        edges: [
          ["ministries", "corpus"],
          ["kpis", "corpus"],
        ],
        text: "Gather the ministry’s responsibilities and progress measures.",
      },
      {
        edges: [["corpus", "c02"]],
        text: "Show the sectors, programmes and actions the minister can influence.",
      },
      {
        edges: [["c02", "cabinet"]],
        text: "Cabinet agrees the minister’s first priorities.",
      },
      {
        edges: [["cabinet", "commit"]],
        text: "Record who delivers each action and by when.",
      },
      {
        edges: [["commit", "delay"]],
        text: "A clear brief helps the minister get to work sooner.",
      },
    ],
    outcome: "A clearer start, with priorities and responsibility agreed.",
  },
  {
    chamber: "02",
    title: "Overlapping programmes",
    question: "Two ministries claim the same programme — who delivers?",
    steps: [
      {
        edges: [
          ["ministries", "corpus"],
          ["manifestos", "corpus"],
        ],
        text: "Compare ministry responsibilities and government promises to find the overlap.",
      },
      {
        edges: [["corpus", "c02"]],
        text: "Clarify which ministry should lead and which should support.",
      },
      {
        edges: [["c02", "commit"]],
        text: "Assign one delivery lead and an agreed budget.",
      },
      { edges: [["commit", "spend"]], text: "Track spending once so duplicate costs can be challenged." },
    ],
    outcome: "Clear responsibility and a better chance of avoiding duplicate spending.",
  },
  {
    chamber: "03",
    title: "Revenue shock",
    question: "Revenue from citizenship investment falls—how should government respond?",
    steps: [
      {
        edges: [
          ["flows", "corpus"],
          ["stats", "corpus"],
        ],
        text: "Gather programme receipts and official figures to assess the revenue loss.",
      },
      {
        edges: [["corpus", "c01"]],
        text: "Estimate the gap over time, showing sources and assumptions.",
      },
      {
        edges: [["c01", "c03"]],
        text: "Compare replacement options and projected effects on the economy.",
      },
      {
        edges: [["c03", "brief"]],
        text: "Prepare a brief with the costs and limits of each option.",
      },
      {
        edges: [["brief", "cabinet"]],
        text: "Cabinet reviews the options before choosing a response.",
      },
      {
        edges: [["cabinet", "spend"]],
        text: "Direct approved resources to the agreed replacement actions.",
      },
    ],
    outcome: "A plan for the revenue gap before pressure on public services increases.",
  },
  {
    chamber: "03",
    title: "Closing the deficit",
    question: "Should we raise value-added tax or cut spending to reduce the budget gap?",
    steps: [
      {
        edges: [
          ["stats", "corpus"],
          ["private", "vault"],
        ],
        text: "Bring public figures together while keeping confidential Treasury records protected.",
      },
      {
        edges: [
          ["corpus", "c03"],
          ["vault", "c03"],
        ],
        text: "Compare policy options using the available model, with assumptions and uncertainty visible.",
      },
      {
        edges: [["c03", "brief"]],
        text: "Set out tax and spending choices side by side.",
      },
      { edges: [["brief", "cabinet"]], text: "Cabinet reviews the evidence and approves a course." },
      { edges: [["cabinet", "spend"]], text: "Assign resources to the agreed tax and spending measures." },
    ],
    outcome: "A clearer balance between reducing the budget gap and supporting economic activity.",
  },
  {
    chamber: "04",
    title: "Global promotion",
    question: "A new national project is ready for global promotion — what do we do?",
    steps: [
      {
        edges: [
          ["peers", "corpus"],
          ["flows", "corpus"],
        ],
        text: "Compare similar projects and investment conditions in other countries.",
      },
      {
        edges: [["corpus", "c04"]],
        text: "Check the project’s legal, land, workforce and incentive requirements.",
      },
      {
        edges: [["c04", "invest"]],
        text: "Prepare project costs, evidence and responsibilities for investor review.",
      },
      { edges: [["invest", "capital"]], text: "Take a clear, government-approved offer to prospective investors." },
    ],
    outcome: "Stronger preparation for attracting investment to a national priority.",
  },
  {
    chamber: "04",
    title: "Investor exit",
    question: "A major foreign investor threatens to leave — how exposed are we?",
    steps: [
      {
        edges: [["flows", "corpus"]],
        text: "Gather evidence on the investor’s contribution to jobs and revenue.",
      },
      { edges: [["corpus", "c04"]], text: "Assess which businesses, workers and public receipts are exposed." },
      {
        edges: [["c04", "c03"]],
        text: "Compare retaining the investor, finding a replacement or managing an exit.",
      },
      { edges: [["c03", "brief"]], text: "Prepare the costs, risks and assumptions for Cabinet review." },
      { edges: [["brief", "cabinet"]], text: "Cabinet agrees what negotiators may offer and where the limits lie." },
      { edges: [["cabinet", "commit"]], text: "Assign leaders and dates for the agreed response." },
      {
        edges: [["commit", "spend"]],
        text: "Check incentives against expected public value before spending.",
      },
    ],
    outcome: "A stronger negotiating position, with jobs and public money considered together.",
  },
  {
    chamber: "05",
    title: "Cabinet scandal",
    question: "A scandal breaks inside Cabinet — what do we do?",
    steps: [
      {
        edges: [["private", "vault"]],
        text: "Review internal records under government control to establish the facts.",
      },
      {
        edges: [["vault", "c05"]],
        text: "Use only approved facts to prepare an honest public response.",
      },
      {
        edges: [["c05", "cabinet"]],
        text: "Responsible government leaders review and approve the response.",
      },
      {
        edges: [["cabinet", "delay"]],
        text: "Keep priority government decisions moving while the issue is addressed.",
      },
    ],
    outcome: "A coordinated, factual response without losing sight of government business.",
  },
  {
    chamber: "05",
    title: "Disaster preparation",
    question: "A natural disaster is imminent — how do we prepare the public?",
    steps: [
      {
        edges: [
          ["stats", "corpus"],
          ["kpis", "corpus"],
        ],
        text: "Gather population, shelter and supply information.",
      },
      {
        edges: [["corpus", "c05"]],
        text: "Prepare clear public guidance based on official sources.",
      },
      { edges: [["c05", "cabinet"]], text: "Government reviews and releases the agreed warnings." },
      {
        edges: [["cabinet", "commit"]],
        text: "Assign preparation tasks and deadlines to each ministry.",
      },
      { edges: [["commit", "delay"]], text: "Track urgent tasks so avoidable delays can be addressed." },
    ],
    outcome: "Clearer public guidance and coordinated preparation for the emergency.",
  },
  {
    chamber: "06",
    title: "Crowded agenda",
    question: "Five urgent decisions, one Cabinet session — what comes first?",
    steps: [
      { edges: [["kpis", "corpus"]], text: "Gather the evidence on what each urgent decision affects." },
      {
        edges: [["corpus", "safeguards"]],
        text: "Check whether each proposal has enough reliable support.",
      },
      {
        edges: [["safeguards", "c06"]],
        text: "Compare national value, urgency and readiness for a decision.",
      },
      { edges: [["c06", "cabinet"]], text: "Cabinet addresses the agreed priorities in order." },
      {
        edges: [["cabinet", "delay"]],
        text: "Keep high-priority decisions from being lost in a crowded agenda.",
      },
    ],
    outcome: "More Cabinet attention on the decisions that matter most.",
  },
  {
    chamber: "06",
    title: "Slipping commitment",
    question: "A flagship commitment is slipping — intervene or re-plan?",
    steps: [
      {
        edges: [
          ["kpis", "corpus"],
          ["private", "vault"],
        ],
        text: "Bring progress measures together and keep internal reports protected.",
      },
      { edges: [["vault", "c06"]], text: "Review the reports to find what is delaying delivery." },
      {
        edges: [["c06", "commit"]],
        text: "Agree a revised action, responsible leader and realistic date.",
      },
      { edges: [["commit", "record"]], text: "Record the change and publish only information approved for release." },
    ],
    outcome: "A clearer recovery plan and an honest record of progress.",
    loop: true,
  },
  {
    chamber: "07",
    title: "Testing a new tax",
    question: "Before announcing a property tax, what concerns should we prepare for?",
    steps: [
      {
        edges: [["private", "vault"]],
        text: "Analyse relevant property records under government control.",
      },
      {
        edges: [["vault", "safeguards"]],
        text: "Review source reliability and approve which findings may be used.",
      },
      {
        edges: [["safeguards", "c07"]],
        text: "Explore possible household responses with simulated profiles—not a public survey.",
      },
      {
        edges: [["c07", "c05"]],
        text: "Use the findings to improve the explanation and identify concerns.",
      },
      {
        edges: [["c05", "cabinet"]],
        text: "Cabinet considers possible reactions alongside evidence before deciding.",
      },
      { edges: [["cabinet", "delay"]], text: "Identify changes that could reduce implementation delays." },
    ],
    outcome: "A better-prepared reform, with concerns explored and private records protected.",
  },
  {
    chamber: "07",
    title: "Diaspora bond",
    question: "Will the diaspora invest in a national bond?",
    steps: [
      {
        edges: [
          ["peers", "corpus"],
          ["flows", "corpus"],
        ],
        text: "Gather examples of similar bonds and money sent home by citizens abroad.",
      },
      { edges: [["corpus", "c07"]], text: "Explore possible investor concerns using simulated diaspora profiles." },
      {
        edges: [["c07", "brief"]],
        text: "Prepare bond terms, costs and unresolved questions for review.",
      },
      { edges: [["brief", "cabinet"]], text: "Cabinet considers the offer and approves any next steps." },
      { edges: [["cabinet", "spend"]], text: "Record how any funds raised would support agreed projects." },
    ],
    outcome: "A clearer offer for citizens abroad to consider—not a promise of demand.",
  },
  {
    chamber: "08",
    title: "Manifesto to delivery",
    question: "A new government takes office — turn the manifesto into a delivery plan.",
    steps: [
      {
        edges: [
          ["manifestos", "corpus"],
          ["ministries", "corpus"],
        ],
        text: "Match government promises to the ministries responsible for them.",
      },
      {
        edges: [
          ["corpus", "c08"],
          ["corpus", "c02"],
        ],
        text: "Turn priorities into proposed actions with named delivery leaders.",
      },
      {
        edges: [
          ["c08", "commit"],
          ["c02", "commit"],
        ],
        text: "Record deadlines and progress measures for each agreed action.",
      },
      {
        edges: [["commit", "record"]],
        text: "Publish approved results and use them as evidence for the next review.",
      },
    ],
    outcome: "Promises linked to actions, responsibility and visible progress.",
    loop: true,
  },
  {
    chamber: "08",
    title: "Quarterly review",
    question: "Three ministries are off track this quarter—what should government change?",
    steps: [
      { edges: [["kpis", "corpus"]], text: "Gather the latest progress measures from ministries." },
      {
        edges: [["corpus", "c08"]],
        text: "Identify commitments that are falling behind.",
      },
      {
        edges: [["c08", "c02"]],
        text: "Clarify what each ministry needs to resolve the delay.",
      },
      { edges: [["c02", "cabinet"]], text: "Cabinet reviews and agrees corrective action." },
      { edges: [["cabinet", "commit"]], text: "Record revised responsibilities and dates." },
      { edges: [["commit", "record"]], text: "Publish approved progress for the next review." },
    ],
    outcome: "Earlier intervention, with progress checked at the next review.",
    loop: true,
  },
  {
    chamber: "09",
    title: "One-day registration",
    question: "Business registration takes six weeks—how could we move toward a one-day service?",
    steps: [
      {
        edges: [
          ["kpis", "corpus"],
          ["ministries", "corpus"],
        ],
        text: "Find where applicants lose time and money in the current process.",
      },
      {
        edges: [["corpus", "c09"]],
        text: "Prepare the service redesign and its approval requirements.",
      },
      {
        edges: [["c09", "c06"]],
        text: "Cabinet reviews the rollout plan and proposed timetable.",
      },
      { edges: [["c06", "commit"]], text: "Assign each agency’s actions, responsibilities and dates." },
      {
        edges: [
          ["commit", "delay"],
          ["commit", "record"],
        ],
        text: "Track processing time and report approved results.",
      },
    ],
    outcome: "A practical plan to reduce delays before businesses can start trading.",
    loop: true,
  },
  {
    chamber: "09",
    title: "National digital ID",
    question: "How should we plan a digital ID that protects privacy and is easy to use?",
    steps: [
      {
        edges: [
          ["ministries", "corpus"],
          ["private", "vault"],
        ],
        text: "Gather service needs while protecting civil registry records.",
      },
      {
        edges: [
          ["corpus", "safeguards"],
          ["vault", "safeguards"],
        ],
        text: "Check privacy requirements and who must approve the design.",
      },
      {
        edges: [["safeguards", "c09"]],
        text: "Prepare the digital ID plan for independent review.",
      },
      { edges: [["c09", "c06"]], text: "Cabinet considers whether and when the service should launch." },
      { edges: [["c06", "commit"]], text: "Assign implementation responsibilities and review dates." },
      { edges: [["commit", "record"]], text: "Track use and publish only approved results." },
    ],
    outcome: "Better preparation for accessible services with personal data under government control.",
    loop: true,
  },
  {
    chamber: "10",
    title: "Budget priorities",
    question: "Which three sectors should the next budget back?",
    steps: [
      {
        edges: [
          ["stats", "corpus"],
          ["peers", "corpus"],
        ],
        text: "Compare national figures with experience in other countries.",
      },
      {
        edges: [["corpus", "c10"]],
        text: "Assess sector opportunities so government can choose priorities.",
      },
      {
        edges: [["c10", "commit"]],
        text: "Prepare a delivery plan for each selected sector.",
      },
      { edges: [["commit", "spend"]], text: "Allocate approved funding against expected value and evidence." },
    ],
    outcome: "A clearer basis for directing limited public money to national priorities.",
  },
  {
    chamber: "10",
    title: "Agriculture growth plan",
    question: "Which agriculture projects could attract investment and strengthen local production?",
    steps: [
      {
        edges: [
          ["flows", "corpus"],
          ["peers", "corpus"],
        ],
        text: "Gather food import figures and examples from comparable countries.",
      },
      {
        edges: [["corpus", "c10"]],
        text: "Identify production barriers and prepare an evidence-based action plan.",
      },
      { edges: [["c10", "invest"]], text: "Set out agriculture projects, costs and responsibilities for investor review." },
      { edges: [["invest", "capital"]], text: "Present opportunities for investing in local production." },
    ],
    outcome: "Stronger preparation for local food production, rural jobs and lower import dependence.",
  },
  ...MORE_SCENARIOS,
];
