// Three further Cabinet-grade journeys per Chamber (30 total). Edges reuse the flow map only.
import type { Scenario } from "./dataDecisionScenarios";

type E = [string, string];
const s = (
  chamber: string,
  title: string,
  question: string,
  steps: [E[], string][],
  outcome: string,
  loop?: boolean,
): Scenario => ({
  chamber,
  title,
  question,
  steps: steps.map(([edges, text]) => ({ edges, text })),
  outcome,
  loop,
});

export const MORE_SCENARIOS: Scenario[] = [
  // 01 National Ledger
  s(
    "01",
    "Article IV mission",
    "The IMF’s regular economic review begins in two weeks—are our figures ready?",
    [
      [
        [
          ["stats", "corpus"],
          ["kpis", "corpus"],
        ],
        "Gather current national accounts, budget and debt figures.",
      ],
      [
        [["corpus", "safeguards"]],
        "Flag outdated figures, weak sources and missing data.",
      ],
      [
        [["safeguards", "c01"]],
        "Explain key figures and their limitations for ministers.",
      ],
      [[["c01", "brief"]], "Prepare a sourced brief on the government’s economic position."],
      [[["brief", "cabinet"]], "Ministers agree the facts and questions to take into the IMF review."],
    ],
    "Better preparation for the IMF review, with trusted data gaps visible beforehand.",
  ),
  s(
    "01",
    "Debt-service spike",
    "Global interest rates rise—what could our debt repayments cost, and when?",
    [
      [
        [
          ["stats", "corpus"],
          ["flows", "corpus"],
        ],
        "Gather debt balances, financing terms and money-flow data.",
      ],
      [[["corpus", "c01"]], "Estimate additional interest costs over time, showing assumptions."],
      [[["c01", "c03"]], "Compare financing responses and their projected economic effects."],
      [[["c03", "brief"]], "Prepare the options and limitations for government review."],
      [[["brief", "spend"]], "Consider how each response affects essential spending."],
    ],
    "Earlier visibility of pressure on debt payments and public services.",
  ),
  s(
    "01",
    "Remittances fall",
    "Citizens abroad are sending less money home—who is affected and what should we do?",
    [
      [
        [
          ["flows", "corpus"],
          ["peers", "corpus"],
        ],
        "Gather money-transfer figures and comparable country trends.",
      ],
      [[["corpus", "c01"]], "Assess possible effects on household spending and foreign currency receipts."],
      [[["c01", "brief"]], "Prepare a brief on the households and sectors most exposed."],
      [[["brief", "cabinet"]], "Cabinet reviews where targeted support may be needed."],
    ],
    "A clearer basis for supporting households affected by falling transfers.",
  ),
  // 02 Portfolios
  s(
    "02",
    "Mid-year overspend",
    "One ministry has spent 70% of its budget by mid-year — what now?",
    [
      [
        [
          ["kpis", "corpus"],
          ["ministries", "corpus"],
        ],
        "Gather the ministry’s spending and delivery results.",
      ],
      [[["corpus", "c02"]], "Compare money spent with progress and agreed responsibilities."],
      [[["c02", "cabinet"]], "Cabinet considers what to protect, reduce or reallocate."],
      [[["cabinet", "commit"]], "Record the revised actions and who is responsible."],
      [[["commit", "spend"]], "Monitor spending against the remaining annual budget."],
    ],
    "Earlier action on overspending, with essential services considered.",
  ),
  s(
    "02",
    "Unfunded capital project",
    "A minister announces a project the budget never funded — back it or stop it?",
    [
      [
        [
          ["ministries", "corpus"],
          ["manifestos", "corpus"],
        ],
        "Gather the project’s link to government promises and ministry responsibilities.",
      ],
      [[["corpus", "c02"]], "Compare its proposed value with existing funded priorities."],
      [[["c02", "cabinet"]], "Cabinet agrees whether to proceed, revise or stop the project."],
      [[["cabinet", "spend"]], "Allocate money only through the approved decision."],
    ],
    "A more disciplined project decision with a clear public record.",
  ),
  s(
    "02",
    "Stalled flagship",
    "The flagship port upgrade is eighteen months late — who fixes it?",
    [
      [
        [
          ["kpis", "corpus"],
          ["ministries", "corpus"],
        ],
        "Gather delivery milestones and agency responsibilities.",
      ],
      [[["corpus", "c02"]], "Find the ministry action needed to address the delay."],
      [[["c02", "commit"]], "Assign a delivery leader and revised dates."],
      [[["commit", "record"]], "Publish approved progress for the next review."],
    ],
    "A clearer route to restarting the port upgrade, with responsibility visible.",
    true,
  ),
  // 03 Scenarios
  s(
    "03",
    "Hurricane in 96 hours",
    "A Category 4 hurricane is tracking toward us — what do we decide now?",
    [
      [
        [
          ["stats", "corpus"],
          ["kpis", "corpus"],
        ],
        "Gather information on people, assets and emergency supplies.",
      ],
      [[["corpus", "c03"]], "Explore possible damage and recovery responses—not a storm forecast."],
      [[["c03", "brief"]], "Prepare options for placing supplies early and reserving emergency funds."],
      [[["brief", "cabinet"]], "Cabinet reviews and authorises the emergency measures."],
      [[["cabinet", "commit"]], "Assign tasks and deadlines to each ministry."],
    ],
    "Better-coordinated preparation for protecting lives, services and economic activity.",
  ),
  s(
    "03",
    "Oil price jump",
    "Oil prices jump 40% — what happens to fuel, power bills and the budget?",
    [
      [
        [
          ["flows", "corpus"],
          ["stats", "corpus"],
        ],
        "Gather fuel import costs and current price information.",
      ],
      [[["corpus", "c03"]], "Compare price subsidies, higher charges and targeted support."],
      [[["c03", "brief"]], "Show the cost of each option and who would be affected."],
      [[["brief", "spend"]], "Direct approved relief to the households or businesses government selects."],
    ],
    "A clearer balance between household support and budget limits.",
  ),
  s(
    "03",
    "Airline cuts routes",
    "A major airline cuts our routes next season — how do we respond?",
    [
      [
        [
          ["flows", "corpus"],
          ["peers", "corpus"],
        ],
        "Gather visitor numbers, airline seats and comparable routes.",
      ],
      [[["corpus", "c03"]], "Estimate possible visitor and revenue losses, with assumptions visible."],
      [[["c03", "brief"]], "Prepare the costs and limits of possible route-support offers."],
      [[["brief", "cabinet"]], "Cabinet agrees a negotiating position for the airline talks."],
    ],
    "Better-informed negotiations on air access and the public cost of support.",
  ),
  // 04 FDI
  s(
    "04",
    "Investment-citizenship rules tighten",
    "Partners tighten citizenship-investment rules—how should we reform and protect revenue?",
    [
      [
        [
          ["flows", "corpus"],
          ["peers", "corpus"],
        ],
        "Gather programme receipts and reforms in comparable countries.",
      ],
      [[["corpus", "c04"]], "Identify revenue exposure and options that meet changing rules."],
      [[["c04", "c03"]], "Compare reform paths and their projected revenue effects."],
      [[["c03", "brief"]], "Prepare the costs, risks and assumptions for Cabinet review."],
      [[["brief", "cabinet"]], "Cabinet agrees which reform path to pursue."],
    ],
    "A clearer reform plan that considers investment and international requirements together.",
  ),
  s(
    "04",
    "Hotel tax concession",
    "A hotel group asks for a 15-year tax holiday to expand — is it worth it?",
    [
      [
        [
          ["flows", "corpus"],
          ["peers", "corpus"],
        ],
        "Gather expansion costs, expected benefits and comparable tax deals.",
      ],
      [[["corpus", "c04"]], "Compare projected jobs and revenue with the value of the tax relief."],
      [[["c04", "invest"]], "Prepare a counter-offer with clear national terms."],
      [[["invest", "capital"]], "Present the offer for investor consideration—not a guaranteed commitment."],
    ],
    "A stronger basis for negotiating investment without overlooking lost tax revenue.",
  ),
  s(
    "04",
    "Correspondent banking",
    "Foreign banks may cut international payment links—which payments are at risk?",
    [
      [[["flows", "corpus"]], "Gather data on international payments and trade."],
      [[["corpus", "c04"]], "Identify the banks and economic activities at risk."],
      [[["c04", "c03"]], "Compare rule-compliance work and alternative payment arrangements."],
      [[["c03", "brief"]], "Prepare the costs, risks and assumptions for Cabinet review."],
      [[["brief", "cabinet"]], "Cabinet agrees the response and assigns responsibility."],
    ],
    "Better preparation for protecting international trade and money transfers.",
  ),
  // 05 Narrative
  s(
    "05",
    "Leaked audit",
    "An audit of a state enterprise leaks to the press — what do we say?",
    [
      [[["private", "vault"]], "Review the audit and board records within protected government storage."],
      [[["vault", "c05"]], "Prepare verified facts and proposed corrective action for public explanation."],
      [[["c05", "cabinet"]], "Cabinet approves what may be released and what must change."],
      [[["cabinet", "commit"]], "Record reform commitments and publish approved information."],
    ],
    "A factual response with visible responsibility for addressing the findings.",
  ),
  s(
    "05",
    "Cost-of-living attack",
    "The opposition says we caused a cost-of-living crisis — how do we answer?",
    [
      [
        [
          ["stats", "corpus"],
          ["peers", "corpus"],
        ],
        "Gather prices, wages and inflation figures from comparable countries.",
      ],
      [[["corpus", "c05"]], "Prepare a clear answer backed by sources."],
      [[["c05", "cabinet"]], "Government reviews the explanation alongside proposed relief."],
      [[["cabinet", "delay"]], "Focus the approved response on facts and practical action."],
    ],
    "A clearer public explanation of prices and the government’s response.",
  ),
  s(
    "05",
    "Emergency misinformation",
    "False rumours spread online during a flood — how do we correct them fast?",
    [
      [
        [
          ["kpis", "corpus"],
          ["stats", "corpus"],
        ],
        "Gather official information about the flood.",
      ],
      [[["corpus", "c05"]], "Draft factual corrections to the false claims."],
      [[["c05", "cabinet"]], "Government approves a coordinated official update."],
      [[["cabinet", "commit"]], "Assign agencies to share the same approved information."],
    ],
    "Clearer emergency communication to support safer public decisions.",
  ),
  // 06 Cabinet Room
  s(
    "06",
    "Budget week trade-offs",
    "Ministries ask for twice the money available — how does Cabinet decide?",
    [
      [[["kpis", "corpus"]], "Gather ministry funding requests and expected results."],
      [[["corpus", "safeguards"]], "Check the data behind each request."],
      [[["safeguards", "c06"]], "Compare the requests by expected national value and readiness."],
      [[["c06", "cabinet"]], "Cabinet agrees priorities within the available budget."],
      [[["cabinet", "spend"]], "Direct approved money to the selected programmes."],
    ],
    "A budget debate focused on trusted data, affordability and intended results.",
  ),
  s(
    "06",
    "Public-sector wage talks",
    "Unions threaten a strike over pay — what can we afford?",
    [
      [
        [
          ["stats", "corpus"],
          ["private", "vault"],
        ],
        "Gather wage costs while protecting confidential negotiating limits.",
      ],
      [[["vault", "c06"]], "Compare the cost of offers with the available budget."],
      [[["c06", "cabinet"]], "Cabinet sets what negotiators may agree."],
      [[["cabinet", "commit"]], "Track any agreed settlement against spending and delivery commitments."],
    ],
    "Better-prepared pay negotiations with costs and authority clearly set out.",
  ),
  s(
    "06",
    "100-day review",
    "One hundred days in — which promises are on track?",
    [
      [[["kpis", "corpus"]], "Gather progress measures for the first hundred days."],
      [[["corpus", "safeguards"]], "Check the data behind reported progress."],
      [[["safeguards", "c06"]], "Show what is on track, at risk or delayed for Cabinet review."],
      [[["c06", "commit"]], "Agree changes to actions, dates or responsibility where needed."],
      [[["commit", "record"]], "Publish approved results for public accountability."],
    ],
    "A clearer account of progress and where government must act next.",
    true,
  ),
  // 07 Persona Lab
  s(
    "07",
    "Appointing a Tourism Minister",
    "We must appoint a new Minister of Tourism — what profile does the job need?",
    [
      [
        [
          ["ministries", "corpus"],
          ["kpis", "corpus"],
        ],
        "Gather ministry responsibilities and tourism progress measures.",
      ],
      [[["corpus", "c07"]], "Study fifty composite leadership profiles—not real candidates."],
      [[["c07", "brief"]], "Prepare the skills and experience the role needs for review."],
      [[["brief", "cabinet"]], "The Prime Minister uses the role brief alongside their own appointment process."],
    ],
    "A clearer definition of what the tourism leadership role requires.",
  ),
  s(
    "07",
    "Statistics chief shortlist",
    "Shortlisting a new head of statistics — who will protect credibility?",
    [
      [
        [
          ["peers", "corpus"],
          ["ministries", "corpus"],
        ],
        "Gather the role’s responsibilities and examples from comparable institutions.",
      ],
      [[["corpus", "c07"]], "Define the leadership skills and independence the role requires."],
      [[["c07", "brief"]], "Prepare the role profile for use in the government’s candidate review."],
      [[["brief", "cabinet"]], "The responsible government authority decides the appointment."],
    ],
    "A clearer standard for reviewing statistics leadership—not an automated appointment.",
  ),
  s(
    "07",
    "Hostile donor meeting",
    "A minister faces a tough donor review next week — how do we prepare?",
    [
      [
        [
          ["peers", "corpus"],
          ["kpis", "corpus"],
        ],
        "Gather donor priorities and programme results.",
      ],
      [[["corpus", "c07"]], "Use simulated donor profiles to explore possible questions."],
      [[["c07", "c05"]], "Prepare sourced answers and requests for the meeting."],
      [[["c05", "cabinet"]], "Government reviews and agrees the minister’s position."],
    ],
    "Better preparation for a demanding funding discussion.",
  ),
  // 08 Mandate Compact
  s(
    "08",
    "Promises vs fiscal room",
    "Our promises cost more than the available budget—which should come first?",
    [
      [
        [
          ["manifestos", "corpus"],
          ["stats", "corpus"],
        ],
        "Bring government promises and budget figures together.",
      ],
      [[["corpus", "c08"]], "Compare costs and possible delivery order."],
      [[["c08", "commit"]], "Set realistic actions, leaders and dates within available resources."],
      [[["commit", "record"]], "Record and explain the approved delivery sequence."],
    ],
    "A clearer order for delivering priorities within budget limits.",
    true,
  ),
  s(
    "08",
    "Donor programme off track",
    "A donor-funded programme is behind — will we lose the money?",
    [
      [
        [
          ["kpis", "corpus"],
          ["ministries", "corpus"],
        ],
        "Gather programme progress and responsible ministry details.",
      ],
      [[["corpus", "c08"]], "Identify the delivery gap and its likely cause."],
      [[["c08", "c02"]], "Clarify which ministry must take corrective action."],
      [[["c02", "commit"]], "Record revised tasks, responsible leaders and dates."],
      [[["commit", "spend"]], "Track spending and funding deadlines against the agreed plan."],
    ],
    "Earlier action on delays that could put donor funding at risk.",
  ),
  s(
    "08",
    "Mid-term reset",
    "Halfway through the term — what must be delivered before the election?",
    [
      [
        [
          ["manifestos", "corpus"],
          ["kpis", "corpus"],
        ],
        "Compare promises with results delivered so far.",
      ],
      [[["corpus", "c08"]], "Government reviews what remains realistic within the term."],
      [[["c08", "commit"]], "Record the remaining actions, leaders and dates."],
      [[["commit", "record"]], "Publish approved progress on the national record."],
    ],
    "A more focused delivery plan for the remainder of the government’s term.",
    true,
  ),
  // 09 Digital Government
  s(
    "09",
    "Digital payments",
    "Pensions and grants still go out as cheques — move them to digital?",
    [
      [
        [
          ["ministries", "corpus"],
          ["private", "vault"],
        ],
        "Gather payment-service information while protecting recipient records.",
      ],
      [[["vault", "safeguards"]], "Check privacy and authorised use of personal information."],
      [[["safeguards", "c09"]], "Prepare a digital payment plan, including access for recipients."],
      [[["c09", "c06"]], "Cabinet reviews the proposed rollout and approval requirements."],
      [[["c06", "commit"]], "Assign implementation responsibilities and review dates."],
    ],
    "Better preparation for reliable payments, with cost, access and privacy considered.",
    true,
  ),
  s(
    "09",
    "Cyber-attack",
    "A cyber-attack takes down a government service — what now?",
    [
      [[["private", "vault"]], "Keep incident records in protected government storage."],
      [[["vault", "safeguards"]], "Review what may have been exposed and what remains uncertain."],
      [[["safeguards", "c09"]], "Prepare service-recovery priorities and security requirements."],
      [[["c09", "c06"]], "Government authorises the response and responsible teams."],
      [[["c06", "commit"]], "Track recovery tasks and follow-up security improvements."],
    ],
    "A clearer response plan for restoring services and addressing security risks.",
  ),
  s(
    "09",
    "Licence delays",
    "Business licences take months — where is the time lost?",
    [
      [
        [
          ["kpis", "corpus"],
          ["ministries", "corpus"],
        ],
        "Gather processing times and agency responsibilities.",
      ],
      [[["corpus", "c09"]], "Prepare changes to the steps causing delays."],
      [[["c09", "c06"]], "Cabinet reviews and approves the proposed service changes."],
      [[["c06", "commit"]], "Assign delivery leaders, dates and progress measures."],
      [[["commit", "delay"]], "Track whether approval times improve after the changes."],
    ],
    "A practical route to reducing delays that hold back businesses and investment.",
    true,
  ),
  // 10 Sector Studio
  s(
    "10",
    "Drought and food imports",
    "Drought has cut local harvests — how do we limit the food import bill?",
    [
      [
        [
          ["flows", "corpus"],
          ["stats", "corpus"],
        ],
        "Compare food imports with local harvest information.",
      ],
      [[["corpus", "c10"]], "Assess projects that could strengthen farms against drought."],
      [[["c10", "commit"]], "Assign responsible leaders and dates to selected actions."],
      [[["commit", "spend"]], "Government considers funding water and storage priorities."],
    ],
    "A stronger basis for improving farm resilience and reducing import dependence.",
  ),
  s(
    "10",
    "Blue economy plan",
    "How can fisheries and ocean-based industries grow without exhausting their resources?",
    [
      [
        [
          ["peers", "corpus"],
          ["flows", "corpus"],
        ],
        "Gather fishing, trade and licensing examples from comparable countries.",
      ],
      [[["corpus", "c10"]], "Prepare growth options that consider fish stocks and environmental limits."],
      [[["c10", "invest"]], "Set out project costs and responsibilities for investor review."],
      [[["invest", "capital"]], "Present processing and port opportunities to prospective investors."],
    ],
    "Better preparation for ocean-based jobs and exports while protecting resources.",
  ),
  s(
    "10",
    "Renewable energy transition",
    "Power costs strangle business — can renewables bring them down?",
    [
      [
        [
          ["stats", "corpus"],
          ["peers", "corpus"],
        ],
        "Gather power tariffs, fuel imports and comparable energy projects.",
      ],
      [[["corpus", "c10"]], "Prepare a phased energy plan with costs and assumptions visible."],
      [[["c10", "invest"]], "Set out solar and storage projects for investor review."],
      [[["invest", "capital"]], "Present the projects for funding consideration."],
    ],
    "A clearer route to assessing lower power costs and reduced fuel dependence.",
  ),
];
