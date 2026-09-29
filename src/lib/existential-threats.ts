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
    body: "If Citizenship by Investment receipts contract, how much government revenue is exposed, when does the gap become critical, and what can credibly replace it?",
    response:
      "Price the gap year by year, test the transition timetable, and prepare investment propositions against their realistic path to jobs, revenue, and GDP.",
  },
  {
    id: "one-storm",
    title: "One Storm from Zero",
    body: "If the next major storm crosses the country, what fails first, what does recovery cost, and which financing decisions must be taken before the season begins?",
    response:
      "Model the shock across sectors and the fiscal position, then identify the resilience and financing choices that can be made before damage occurs.",
  },
  {
    id: "tourism-trap",
    title: "The Tourism Trap",
    body: "How much of national income depends on one visitor market, airlift pattern, or price point—and which diversification choices can matter within the current term?",
    response:
      "Measure the concentration, compare credible diversification paths, and show their cost, dependencies, and time to economic impact before incentives are issued.",
  },
  {
    id: "cut-off",
    title: "Cut Off from the System",
    body: "If another global bank cuts the relationship that moves money internationally, which payments, investments, and remittances are exposed—and what evidence strengthens the national response?",
    response:
      "Keep the exposure visible, assemble the cited negotiating position, and connect financial access to the investment and household activity it enables.",
  },
  {
    id: "debt-ceiling",
    title: "The Debt Ceiling",
    body: "What combination of revenue, spending, investment, and growth creates room in the budget without weakening the services and infrastructure the country needs?",
    response:
      "Start with the debt path Cabinet requires, identify the credible policy combinations, and convert the chosen path into owned, reviewable commitments.",
  },
  {
    id: "power-cost",
    title: "Powering Uncompetitiveness",
    body: "Which productive sectors are being priced out by electricity costs, and which energy decisions would most improve the country’s investment position?",
    response:
      "Treat energy as an investment constraint, compare the effect on priority sectors, and test each option against capital, delivery time, and institutional readiness.",
  },
  {
    id: "regulated-out",
    title: "Regulated Out of the Game",
    body: "When international rules change, what is the national economic exposure, what can government influence, and what position can it defend with evidence?",
    response:
      "Price the change, identify the affected sectors and revenues, and prepare a cited national position for negotiation and public explanation.",
  },
  {
    id: "talent-drain",
    title: "The Talent Drain",
    body: "Which essential skills are leaving fastest, what does the loss cost delivery and investment, and which retention or diaspora policy can change behaviour?",
    response:
      "Connect workforce exposure to ministries and growth, then test the proposed response with the people it is intended to retain, return, or engage.",
  },
];
