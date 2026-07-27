export interface ExistentialThreat {
  id: string;
  title: string;
  body: string;
  /** What the instrument does about it. Rendered beneath the body. */
  response: string;
}

export const EXISTENTIAL_THREATS: ExistentialThreat[] = [
  {
    id: "cbi-cliff",
    title: "The CBI Cliff",
    body:
      "Citizenship by Investment is the region's largest non-tax revenue engine — and Brussels has now demanded its phase-out by 2028. With visa-free access itself on the line, five Caribbean states face the potential collapse of a pillar funding hospitals, schools, and disaster recovery. No replacement revenue has been offered. The clock is running.",
    response:
      "The FDI Transition Studio prices the hole year by year under the actual phase-out glide-path, then assembles the book of investment packages built to replace it — with capital-to-GDP conversion and time-to-impact lags made explicit. The Caribbean Investment Summit is where that book meets capital.",
  },
  {
    id: "one-storm",
    title: "One Storm from Zero",
    body:
      "A single Category 5 hurricane can erase more than a year of national GDP overnight. Dominica lost 226% of GDP to Maria; Grenada 200% to Ivan. As storms intensify and insurance retreats from coastal assets, every investment decision in the region now carries climate risk that no balance sheet can ignore.",
    response:
      "Climate exposure becomes a live lever rather than an annex. The Scenario Engine propagates a shock through the inter-sector dependency web and prices the fiscal consequence before the season opens, so recovery financing is arranged against a modelled position rather than a damaged one.",
  },
  {
    id: "tourism-trap",
    title: "The Tourism Trap",
    body:
      "When tourism drives up to 80% of your economy, you don't have an economy — you have an exposure. One product, one dominant source market, one price point. A US recession, an airlift cut, or a pandemic-class event stops inflows overnight. COVID proved the region has no shock absorber. Diversification isn't optional.",
    response:
      "The National Ledger holds concentration as a standing exposure index, drillable to source. The Scenario Engine tests what a diversification path actually costs and how long it takes to bite — before a single incentive is drafted.",
  },
  {
    id: "cut-off",
    title: "Cut Off from the System",
    body:
      "Global banks are quietly severing correspondent relationships across the Caribbean, judging small markets not worth the compliance cost. Every lost relationship makes remittances slower, trade finance costlier, and investment settlement harder. A region can't attract capital it can't receive. De-risking is financial exclusion by another name — and it's accelerating.",
    response:
      "De-risking exposure is carried as a graded series in the Ledger rather than discovered at settlement. The Narrative Chamber assembles the evidenced national position that correspondent negotiations require, inside a working day.",
  },
  {
    id: "debt-ceiling",
    title: "The Debt Ceiling",
    body:
      "With debt-to-GDP ratios exceeding 60–90%, many Caribbean states spend more servicing loans than building the future. Middle-income classification blocks access to concessional financing despite acute climate vulnerability. High debt crowds out the very infrastructure that attracts investment — a self-reinforcing trap that shrinks fiscal space precisely when transformation demands it.",
    response:
      "Goal-seek runs the fiscal question backwards: set the debt path the Cabinet needs and see which levers reach it. The Cabinet Room turns the chosen path into commitments with owners, tracked quarter by quarter.",
  },
  {
    id: "power-cost",
    title: "Powering Uncompetitiveness",
    body:
      "At $0.30–0.40 per kilowatt-hour — three to four times US rates — Caribbean electricity prices out manufacturing, data infrastructure, and agro-processing before negotiations begin. Diesel dependence turns every oil spike into an immediate balance-of-payments drain. Energy transition isn't just climate policy here. It's the price of admission to competitive investment.",
    response:
      "Energy cost enters the Ledger as an investment-readiness constraint, scored alongside legal, land, workforce and institutional capacity — so an energy decision is priced as the FDI decision it actually is.",
  },
  {
    id: "regulated-out",
    title: "Regulated Out of the Game",
    body:
      "EU blacklists, OECD tax rules, and the global minimum tax are systematically dismantling the offshore financial services model that once diversified Caribbean inflows. FATF grey-listing looms as a constant threat. External actors are unilaterally repricing the region's access to the global economy — and small states have no seat at the table.",
    response:
      "When the rules are rewritten from outside, the Narrative Chamber reaches a defensible national position inside a working day, cited to source. The Ledger holds what each ruling change costs, so the government negotiates from a priced position rather than a briefing note.",
  },
  {
    id: "talent-drain",
    title: "The Talent Drain",
    body:
      "Nurses, teachers, and engineers leave faster than economies can replace them, hollowing out the skilled labor base investors require. What flows back — remittances — is stable but stagnant, vulnerable to diaspora aging and shifting immigration policy abroad. A nation cannot build its future while exporting the people who would build it.",
    response:
      "Portfolio Workspaces show every ministry its own workforce exposure against national GDP contribution. Persona Lab tests whether a retention or diaspora policy will land with the people it targets, before it ships.",
  },
];
