// @domain marketing
// @tables none
// @ui src/components/present/PresentDeck.tsx
//
// The GDP event series as shown in the live briefing at /present. One entry
// per summit, in calendar order. `url` is the public site the presenter can
// tour inside the briefing; null until the site is live.

export interface GdpEvent {
  id: string;
  code: string;
  name: string;
  dates: string;
  venue: string;
  theme: string;
  /** One plain sentence on what the event does for the framework. */
  purpose: string;
  /** Sector in the GDPVision twelve-sector wheel this summit serves. */
  sector: string;
  url: string | null;
  /** True for the apex event, the Caribbean GDP Summit. */
  apex?: boolean;
}

export const GDP_EVENTS: GdpEvent[] = [
  {
    id: "cgdps",
    code: "CGDPS '26",
    name: "Caribbean GDP Summit",
    dates: "11–12 November 2026",
    venue: "Royalton Saint Lucia, Cap Estate",
    theme: "GDP positioning for a new global reality",
    purpose:
      "The one event that looks at the whole economy rather than one sector. Where the measurement framework goes in front of ministers and the ECCB.",
    sector: "Whole economy",
    url: "https://gdp-event.gdpvision.com",
    apex: true,
  },
  {
    id: "cbes",
    code: "CBES '26",
    name: "Caribbean Blue Economy Summit",
    dates: "22–23 October 2026",
    venue: "AUA Conference Center, Antigua",
    theme: "From SIDS to Large Ocean States",
    purpose:
      "Puts the ocean on the ledger as a sector: fisheries, shipping, marine energy and the finance behind them.",
    sector: "Blue economy",
    url: "https://blue-economy.gdpvision.com",
  },
  {
    id: "cadis",
    code: "CADIS '26",
    name: "Caribbean AI & Digital Infrastructure Summit",
    dates: "26–27 November 2026",
    venue: "AUA, Antigua",
    theme: "The Region. The Infrastructure. The Moment.",
    purpose:
      "The digital economy and the infrastructure under it, including the in-country hardware the Vault runs on. Where the Digital Government Studio's work gets shown.",
    sector: "Digital economy",
    url: "https://cadis.gdpvision.com",
  },
  {
    id: "chis",
    code: "CHIS '27",
    name: "Caribbean Housing & Infrastructure Summit",
    dates: "11–12 February 2027",
    venue: "AUA, St. John's, Antigua",
    theme: "Building Forward: Policy, Capital & Resilience",
    purpose:
      "Housing and construction as a GDP sector: the policy, the capital and the climate-proofing.",
    sector: "Construction",
    url: "https://housing.gdpvision.com",
  },
  {
    id: "cafs",
    code: "CAFS '27",
    name: "Caribbean Agriculture & Food Sovereignty Summit",
    dates: "18–19 March 2027",
    venue: "AUA, Antigua",
    theme: "From Import Dependency to Regional Sovereignty",
    purpose:
      "Agriculture and fisheries as a growth sector rather than a subsidy line. The import bill is the number on the table.",
    sector: "Agriculture",
    url: "https://agriculture.gdpvision.com",
  },
  {
    id: "cis",
    code: "CIS '27",
    name: "Caribbean Investment Summit",
    dates: "7–10 April 2027",
    venue: "St. Kitts Marriott, Frigate Bay",
    theme: "The Credibility Standard: Caribbean Citizenship, Rebuilt for the Regulated Era",
    purpose:
      "The original summit, running since 2009. Investment migration and the capital around it, with the FDI Transition Studio's investment packages in the room.",
    sector: "Financial services",
    url: "https://caribbeaninvestmentsummit.com",
  },
  {
    id: "ceis",
    code: "CEIS '27",
    name: "Caribbean Energy & Infrastructure Summit",
    dates: "17–19 June 2027",
    venue: "AUA, Antigua",
    theme: "Powering the Region: From Petrodollars to Renewable Sovereignty",
    purpose:
      "Energy as the sector that sets the cost of every other one. Generation, grid, and the move off imported fuel.",
    sector: "Energy",
    url: "https://energy.gdpvision.com",
  },
  {
    id: "cipws",
    code: "CIPWS '27",
    name: "Caribbean Infrastructure & Public Works Summit",
    dates: "21–23 September 2027",
    venue: "AUA, Antigua",
    theme: "Build to Last: Financing, Delivering & Climate-Proofing",
    purpose:
      "Roads, ports, water and the public works budget behind them. How they get financed, delivered, and made to survive the next storm.",
    sector: "Public administration",
    url: null,
  },
  {
    id: "cbis",
    code: "CBIS '27",
    name: "Caribbean Business & Industry Summit",
    dates: "28–29 September 2027",
    venue: "AUA, Antigua",
    theme: "Open for Business: Trade, Investment, Manufacturing",
    purpose: "Manufacturing, trade and the private sector that has to carry most of the growth.",
    sector: "Manufacturing",
    url: "https://commerce.gdpvision.com",
  },
  {
    id: "chwis",
    code: "CHWIS '27",
    name: "Caribbean Health, Wellness & Innovation Summit",
    dates: "2027, date to be announced",
    venue: "To be announced",
    theme: "Healing the Region: From NCD Crisis to Wellness Economy",
    purpose:
      "Health as a cost today and a sector tomorrow. Wellness tourism, medical services and the innovation around them.",
    sector: "Other services",
    url: "https://health.gdpvision.com",
  },
];
