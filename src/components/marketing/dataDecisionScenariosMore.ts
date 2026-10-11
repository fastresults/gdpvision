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
  s("01", "Article IV mission", "The IMF Article IV mission arrives in two weeks — are our numbers ready?", [
    [[["stats", "corpus"], ["kpis", "corpus"]], "National accounts, fiscal and debt figures → Corpus: one current set."],
    [[["corpus", "safeguards"]], "Corpus → Citations & grades: weak or stale figures are flagged."],
    [[["safeguards", "c01"]], "Safeguards → National Ledger: every headline figure is explained."],
    [[["c01", "brief"]], "Ledger → Decision Brief: the government's position, cited."],
    [[["brief", "cabinet"]], "Brief → Cabinet: ministers enter the mission with one story."],
  ], "A stronger mission report and fewer surprises."),
  s("01", "Debt-service spike", "Global rates rise — how much more will our debt cost, and when?", [
    [[["stats", "corpus"], ["flows", "corpus"]], "Debt stock and financing flows → Corpus."],
    [[["corpus", "c01"]], "Corpus → National Ledger: extra interest priced year by year."],
    [[["c01", "c03"]], "Ledger → Scenarios: refinance, delay or reprioritise — each tested."],
    [[["c03", "brief"]], "Scenarios → Decision Brief: the least damaging path."],
    [[["brief", "spend"]], "Brief → spending protected where it matters most."],
  ], "Debt costs managed before they crowd out services."),
  s("01", "Remittances fall", "Remittances are falling as diaspora economies slow — what does it mean at home?", [
    [[["flows", "corpus"], ["peers", "corpus"]], "Remittance flows and regional peers → Corpus."],
    [[["corpus", "c01"]], "Corpus → National Ledger: household spending and FX hit traced."],
    [[["c01", "brief"]], "Ledger → Decision Brief: exposure by household and sector."],
    [[["brief", "cabinet"]], "Brief → Cabinet: targeted support agreed."],
  ], "Vulnerable households protected early."),
  // 02 Portfolios
  s("02", "Mid-year overspend", "One ministry has spent 70% of its budget by mid-year — what now?", [
    [[["kpis", "corpus"], ["ministries", "corpus"]], "Spending and delivery KPIs → Corpus."],
    [[["corpus", "c02"]], "Corpus → Portfolios: spend compared with results and mandate."],
    [[["c02", "cabinet"]], "Portfolios → Cabinet: protect, trim or reallocate."],
    [[["cabinet", "commit"]], "Cabinet → revised commitments with owners."],
    [[["commit", "spend"]], "Commitments → the budget holds to year end."],
  ], "No end-of-year fiscal surprise."),
  s("02", "Unfunded capital project", "A minister announces a project the budget never funded — back it or stop it?", [
    [[["ministries", "corpus"], ["manifestos", "corpus"]], "Mandates and commitments → Corpus."],
    [[["corpus", "c02"]], "Corpus → Portfolios: value against the ministry's real priorities."],
    [[["c02", "cabinet"]], "Portfolios → Cabinet: one collective decision."],
    [[["cabinet", "spend"]], "Cabinet → money only for what was agreed."],
  ], "Discipline kept without public conflict."),
  s("02", "Stalled flagship", "The flagship port upgrade is eighteen months late — who fixes it?", [
    [[["kpis", "corpus"], ["ministries", "corpus"]], "Delivery milestones and ministries → Corpus."],
    [[["corpus", "c02"]], "Corpus → Portfolios: the blocking ministry and lever found."],
    [[["c02", "commit"]], "Portfolios → Tracked commitments: one owner, new dates."],
    [[["commit", "record"]], "Commitments → progress reported publicly."],
  ], "The flagship moves again — on the record.", true),
  // 03 Scenarios
  s("03", "Hurricane in 96 hours", "A Category 4 hurricane is tracking toward us — what do we decide now?", [
    [[["stats", "corpus"], ["kpis", "corpus"]], "Population, assets and supply data → Corpus."],
    [[["corpus", "c03"]], "Corpus → Scenarios: damage and recovery paths rehearsed."],
    [[["c03", "brief"]], "Scenarios → Decision Brief: pre-positioning and fiscal buffers."],
    [[["brief", "cabinet"]], "Brief → Cabinet: emergency measures authorised."],
    [[["cabinet", "commit"]], "Cabinet → every ministry knows its task."],
  ], "Faster recovery and less lost output."),
  s("03", "Oil price jump", "Oil prices jump 40% — what happens to fuel, power bills and the budget?", [
    [[["flows", "corpus"], ["stats", "corpus"]], "Import bills and price data → Corpus."],
    [[["corpus", "c03"]], "Corpus → Scenarios: subsidy, pass-through or targeted relief tested."],
    [[["c03", "brief"]], "Scenarios → Decision Brief: costs and winners side by side."],
    [[["brief", "spend"]], "Brief → relief only where it is needed."],
  ], "Households cushioned without breaking the budget."),
  s("03", "Airline cuts routes", "A major airline cuts our routes next season — how do we respond?", [
    [[["flows", "corpus"], ["peers", "corpus"]], "Arrivals, seats and peer routes → Corpus."],
    [[["corpus", "c03"]], "Corpus → Scenarios: lost visitors and revenue modelled."],
    [[["c03", "brief"]], "Scenarios → Decision Brief: route support options costed."],
    [[["brief", "cabinet"]], "Brief → Cabinet: a negotiating mandate agreed."],
  ], "Airlift protected at a justified price."),
  // 04 FDI
  s("04", "Investment-citizenship rules tighten", "Partner countries tighten rules on our investment-citizenship programme — how do we keep investment coming?", [
    [[["flows", "corpus"], ["peers", "corpus"]], "Programme inflows and peer reforms → Corpus."],
    [[["corpus", "c04"]], "Corpus → FDI Studio: exposure and compliant alternatives."],
    [[["c04", "c03"]], "FDI Studio → Scenarios: reform paths tested against revenue."],
    [[["c03", "brief"]], "Scenarios → Decision Brief."],
    [[["brief", "cabinet"]], "Brief → Cabinet: reform chosen before it is imposed."],
  ], "Investment kept, international standing protected."),
  s("04", "Hotel tax concession", "A hotel group asks for a 15-year tax holiday to expand — is it worth it?", [
    [[["flows", "corpus"], ["peers", "corpus"]], "Project economics and peer deals → Corpus."],
    [[["corpus", "c04"]], "Corpus → FDI Studio: jobs, revenue and payback priced."],
    [[["c04", "invest"]], "FDI Studio → Investor package: a fair counter-offer."],
    [[["invest", "capital"]], "Package → capital committed on national terms."],
  ], "Growth won without giving the tax base away."),
  s("04", "Correspondent banking", "Foreign banks threaten to cut correspondent links — how exposed are payments?", [
    [[["flows", "corpus"]], "Payment and trade flows → Corpus."],
    [[["corpus", "c04"]], "Corpus → FDI Studio: exposed sectors and banks identified."],
    [[["c04", "c03"]], "FDI Studio → Scenarios: compliance and backup channels tested."],
    [[["c03", "brief"]], "Scenarios → Decision Brief."],
    [[["brief", "cabinet"]], "Brief → Cabinet: a remediation plan agreed."],
  ], "Trade and remittance payments keep flowing."),
  // 05 Narrative
  s("05", "Leaked audit", "An audit of a state enterprise leaks to the press — what do we say?", [
    [[["private", "vault"]], "Audit and board records → Sovereign Vault."],
    [[["vault", "c05"]], "Vault → Narrative: the verified facts and the fix."],
    [[["c05", "cabinet"]], "Narrative → Cabinet: response and corrective action approved."],
    [[["cabinet", "commit"]], "Cabinet → reform commitments made public."],
  ], "Trust rebuilt with facts, not denial."),
  s("05", "Cost-of-living attack", "The opposition says we caused a cost-of-living crisis — how do we answer?", [
    [[["stats", "corpus"], ["peers", "corpus"]], "Prices, wages and peer inflation → Corpus."],
    [[["corpus", "c05"]], "Corpus → Narrative: a sourced, plain-language answer."],
    [[["c05", "cabinet"]], "Narrative → Cabinet: message and relief measures aligned."],
    [[["cabinet", "delay"]], "Cabinet → the debate moves to solutions."],
  ], "An honest answer that holds up."),
  s("05", "Emergency misinformation", "False rumours spread online during a flood — how do we correct them fast?", [
    [[["kpis", "corpus"], ["stats", "corpus"]], "Official situation data → Corpus."],
    [[["corpus", "c05"]], "Corpus → Narrative: corrections drafted from sourced facts."],
    [[["c05", "cabinet"]], "Narrative → Cabinet: one voice, released within the hour."],
    [[["cabinet", "commit"]], "Cabinet → agencies repeat the same message."],
  ], "Public safety protected; panic avoided."),
  // 06 Cabinet Room
  s("06", "Budget week trade-offs", "Ministries ask for twice the money available — how does Cabinet decide?", [
    [[["kpis", "corpus"]], "Bids and expected results → Corpus."],
    [[["corpus", "safeguards"]], "Corpus → Citations & grades: claims tested."],
    [[["safeguards", "c06"]], "Safeguards → Cabinet Room: bids ranked by value."],
    [[["c06", "cabinet"]], "Cabinet Room → Cabinet: the budget is agreed."],
    [[["cabinet", "spend"]], "Cabinet → money to the highest-return bids."],
  ], "A budget that funds growth, not noise."),
  s("06", "Public-sector wage talks", "Unions threaten a strike over pay — what can we afford?", [
    [[["stats", "corpus"], ["private", "vault"]], "Wage bill data → Corpus; negotiating limits → Vault."],
    [[["vault", "c06"]], "Vault → Cabinet Room: offers costed against the budget."],
    [[["c06", "cabinet"]], "Cabinet Room → Cabinet: a mandate for negotiators."],
    [[["cabinet", "commit"]], "Cabinet → the settlement is tracked."],
  ], "A fair settlement without a strike."),
  s("06", "100-day review", "One hundred days in — which promises are on track?", [
    [[["kpis", "corpus"]], "Commitment KPIs → Corpus."],
    [[["corpus", "safeguards"]], "Corpus → Citations & grades: progress verified."],
    [[["safeguards", "c06"]], "Safeguards → Cabinet Room: green, amber and red shown."],
    [[["c06", "commit"]], "Cabinet Room → commitments re-planned."],
    [[["commit", "record"]], "Commitments → results published."],
  ], "Momentum kept and seen by the public.", true),
  // 07 Persona Lab
  s("07", "Appointing a Tourism Minister", "We must appoint a new Minister of Tourism — what profile does the job need?", [
    [[["ministries", "corpus"], ["kpis", "corpus"]], "Portfolio mandate and sector KPIs → Corpus."],
    [[["corpus", "c07"]], "Corpus → Persona Lab: fifty ideal-minister profiles studied."],
    [[["c07", "brief"]], "Persona Lab → Decision Brief: the skills that matter most."],
    [[["brief", "cabinet"]], "Brief → Prime Minister: appointment on evidence."],
  ], "The right person in the job sooner."),
  s("07", "Statistics chief shortlist", "Shortlisting a new head of statistics — who will protect credibility?", [
    [[["peers", "corpus"], ["ministries", "corpus"]], "Peer institutions and role mandate → Corpus."],
    [[["corpus", "c07"]], "Corpus → Persona Lab: the ideal profile defined."],
    [[["c07", "brief"]], "Persona Lab → Decision Brief: candidates compared to it."],
    [[["brief", "cabinet"]], "Brief → Cabinet: appointment made."],
  ], "Trusted national numbers for years to come."),
  s("07", "Hostile donor meeting", "A minister faces a tough donor review next week — how do we prepare?", [
    [[["peers", "corpus"], ["kpis", "corpus"]], "Donor priorities and programme results → Corpus."],
    [[["corpus", "c07"]], "Corpus → Persona Lab: donor reactions simulated."],
    [[["c07", "c05"]], "Persona Lab → Narrative: answers prepared."],
    [[["c05", "cabinet"]], "Narrative → Cabinet: the line agreed."],
  ], "Funding kept and relationships strengthened."),
  // 08 Mandate Compact
  s("08", "Promises vs fiscal room", "We promised more than the budget allows — which promises go first?", [
    [[["manifestos", "corpus"], ["stats", "corpus"]], "Manifesto and fiscal data → Corpus."],
    [[["corpus", "c08"]], "Corpus → Mandate Compact: each promise costed and sequenced."],
    [[["c08", "commit"]], "Mandate Compact → Tracked commitments: a realistic order."],
    [[["commit", "record"]], "Commitments → the sequence explained publicly."],
  ], "Promises kept in an order the budget can carry.", true),
  s("08", "Donor programme off track", "A donor-funded programme is behind — will we lose the money?", [
    [[["kpis", "corpus"], ["ministries", "corpus"]], "Programme KPIs and owners → Corpus."],
    [[["corpus", "c08"]], "Corpus → Mandate Compact: the gap and its cause."],
    [[["c08", "c02"]], "Mandate Compact → Portfolios: the ministry that must act."],
    [[["c02", "commit"]], "Portfolios → revised commitments."],
    [[["commit", "spend"]], "Commitments → the funds are drawn down."],
  ], "Donor money used, not returned."),
  s("08", "Mid-term reset", "Halfway through the term — what must be delivered before the election?", [
    [[["manifestos", "corpus"], ["kpis", "corpus"]], "Promises and results to date → Corpus."],
    [[["corpus", "c08"]], "Corpus → Mandate Compact: the remaining mandate set."],
    [[["c08", "commit"]], "Mandate Compact → Tracked commitments."],
    [[["commit", "record"]], "Commitments → progress on the National Record."],
  ], "A government that finishes what it started.", true),
  // 09 Digital Government
  s("09", "Digital payments", "Pensions and grants still go out as cheques — move them to digital?", [
    [[["ministries", "corpus"], ["private", "vault"]], "Service data → Corpus; beneficiary records → Vault."],
    [[["vault", "safeguards"]], "Vault → safeguards: privacy rules applied."],
    [[["safeguards", "c09"]], "Safeguards → Digital Government: the service is designed."],
    [[["c09", "c06"]], "Digital Government → Cabinet Room: rollout approved."],
    [[["c06", "commit"]], "Cabinet Room → Tracked commitments."],
  ], "Faster payments, lower cost, less fraud.", true),
  s("09", "Cyber-attack", "A cyber-attack takes down a government service — what now?", [
    [[["private", "vault"]], "Incident records → Sovereign Vault."],
    [[["vault", "safeguards"]], "Vault → safeguards: what was exposed is confirmed."],
    [[["safeguards", "c09"]], "Safeguards → Digital Government: recovery plan."],
    [[["c09", "c06"]], "Digital Government → Cabinet Room: response authorised."],
    [[["c06", "commit"]], "Cabinet Room → hardening commitments tracked."],
  ], "Service restored and trust protected."),
  s("09", "Licence delays", "Business licences take months — where is the time lost?", [
    [[["kpis", "corpus"], ["ministries", "corpus"]], "Processing times and agencies → Corpus."],
    [[["corpus", "c09"]], "Corpus → Digital Government: the process redesigned."],
    [[["c09", "c06"]], "Digital Government → Cabinet Room: the change decided."],
    [[["c06", "commit"]], "Cabinet Room → commitments."],
    [[["commit", "delay"]], "Commitments → approvals in days."],
  ], "Investment starts sooner.", true),
  // 10 Sector Studio
  s("10", "Drought and food imports", "Drought has cut local harvests — how do we limit the food import bill?", [
    [[["flows", "corpus"], ["stats", "corpus"]], "Import flows and harvest data → Corpus."],
    [[["corpus", "c10"]], "Corpus → Sector Studio: resilience projects ranked."],
    [[["c10", "commit"]], "Sector Studio → Tracked commitments."],
    [[["commit", "spend"]], "Commitments → water and storage funded first."],
  ], "Lower food prices and a sturdier farm sector."),
  s("10", "Blue economy plan", "How should we license our fisheries and ocean economy for growth?", [
    [[["peers", "corpus"], ["flows", "corpus"]], "Peer licensing regimes and catch flows → Corpus."],
    [[["corpus", "c10"]], "Corpus → Sector Studio: a sustainable growth plan."],
    [[["c10", "invest"]], "Sector Studio → Investor packages."],
    [[["invest", "capital"]], "Packages → investment in processing and ports."],
  ], "New exports from a protected ocean."),
  s("10", "Renewable energy transition", "Power costs strangle business — can renewables bring them down?", [
    [[["stats", "corpus"], ["peers", "corpus"]], "Tariffs, fuel imports and peer projects → Corpus."],
    [[["corpus", "c10"]], "Corpus → Sector Studio: the transition roadmap."],
    [[["c10", "invest"]], "Sector Studio → Investor packages: bankable solar and storage."],
    [[["invest", "capital"]], "Packages → capital committed."],
  ], "Cheaper power and less imported fuel."),
];
