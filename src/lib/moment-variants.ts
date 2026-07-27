import ill_cbi_cliff from "@/assets/illustrations/threat-cbi-cliff.jpg.asset.json";
import ill_one_storm from "@/assets/illustrations/threat-one-storm.jpg.asset.json";
import ill_tourism_trap from "@/assets/illustrations/threat-tourism-trap.jpg.asset.json";
import ill_cut_off from "@/assets/illustrations/threat-cut-off.jpg.asset.json";
import ill_debt_ceiling from "@/assets/illustrations/threat-debt-ceiling.jpg.asset.json";
import ill_power_cost from "@/assets/illustrations/threat-power-cost.jpg.asset.json";
import ill_regulated_out from "@/assets/illustrations/threat-regulated-out.jpg.asset.json";
import ill_talent_drain from "@/assets/illustrations/threat-talent-drain.jpg.asset.json";

export interface MomentStat {
  value: number;
  unit: string;
  label: string;
  grade: "A" | "B" | "C";
  citation: string;
}

export interface MomentVariant {
  id: string;
  title: string;
  lede: string;
  stats: [MomentStat, MomentStat, MomentStat];
  /** Subject-matched engraved illustration for this exposure. */
  illustration: string;
}

export const MOMENT_VARIANTS: MomentVariant[] = [
  {
    id: "cbi-cliff",
    illustration: ill_cbi_cliff.url,
    title: "A revenue cliff, without a decision-ready view of the ground it sits on.",
    lede:
      "Five Caribbean states operate CBI as a primary GDP and government-revenue driver. National statistics arrive in annual digests, IMF assessments are twelve to eighteen months stale, and no Cabinet in the region has a single, current view of its own economy.",
    stats: [
      {
        value: 50,
        unit: "%",
        label: "CBI receipts as share of government revenue, upper band",
        grade: "B",
        citation: "IMF Article IV consultations, 2022–2024. Range across the five OECS CBI states.",
      },
      {
        value: 18,
        unit: "months",
        label: "Typical staleness of authoritative sector data",
        grade: "B",
        citation: "ECCB & NSO release cadence review, 2024.",
      },
      {
        value: 5,
        unit: "nations",
        label: "OECS states operating a CBI programme today",
        grade: "A",
        citation: "St. Kitts & Nevis, Dominica, Antigua & Barbuda, Grenada, Saint Lucia.",
      },
    ],
  },
  {
    id: "one-storm",
    illustration: ill_one_storm.url,
    title: "One storm can erase a generation of growth in a single night.",
    lede:
      "The Caribbean sits inside the world's most concentrated hurricane corridor, and each new season arrives with intensifying storms and retreating insurers. When a single event can wipe out multiple years of GDP, every fiscal plan without a live climate view is a plan written on sand.",
    stats: [
      {
        value: 226,
        unit: "% of GDP",
        label: "Damage from Hurricane Maria in Dominica, 2017",
        grade: "A",
        citation: "Government of Dominica Post-Disaster Needs Assessment, 2017.",
      },
      {
        value: 200,
        unit: "% of GDP",
        label: "Damage from Hurricane Ivan in Grenada, 2004",
        grade: "A",
        citation: "OECS / World Bank Ivan Damage Assessment, 2004.",
      },
      {
        value: 30,
        unit: "% higher",
        label: "Rise in Cat 4–5 Atlantic hurricane frequency, last two decades",
        grade: "B",
        citation: "NOAA Atlantic hurricane record, 2004–2024 vs. prior baseline.",
      },
    ],
  },
  {
    id: "tourism-trap",
    illustration: ill_tourism_trap.url,
    title: "An economy that is really a single product, priced by someone else.",
    lede:
      "When tourism drives most of GDP, one recession, one airlift cut, or one pandemic-class event stops the inflows overnight. COVID demonstrated the region has no shock absorber, and no Cabinet dashboard capable of pricing the exposure before the next shock lands.",
    stats: [
      {
        value: 80,
        unit: "% of GDP",
        label: "Direct and indirect tourism contribution, upper-band Caribbean states",
        grade: "B",
        citation: "WTTC Economic Impact Reports, 2019–2023.",
      },
      {
        value: 65,
        unit: "% drop",
        label: "Regional tourist arrivals during 2020 COVID collapse",
        grade: "A",
        citation: "Caribbean Tourism Organization arrivals data, 2020.",
      },
      {
        value: 1,
        unit: "source market",
        label: "United States share of stopover arrivals, dominant across the region",
        grade: "B",
        citation: "CTO Latest Statistics, 2023.",
      },
    ],
  },
  {
    id: "cut-off",
    illustration: ill_cut_off.url,
    title: "Quietly severed from the financial system that moves the money.",
    lede:
      "Global banks are withdrawing correspondent relationships across the Caribbean, judging small markets not worth the compliance cost. Every lost relationship makes remittances slower, trade finance costlier, and settlement harder. A region cannot attract capital it cannot receive — and the exposure is invisible without a live view.",
    stats: [
      {
        value: 30,
        unit: "% loss",
        label: "Decline in correspondent banking relationships across the Caribbean since 2011",
        grade: "B",
        citation: "IMF / World Bank de-risking surveys, 2015–2022.",
      },
      {
        value: 12,
        unit: "jurisdictions",
        label: "Caribbean states affected by active correspondent withdrawal",
        grade: "B",
        citation: "CARICOM Committee of Central Bank Governors reporting, 2022.",
      },
      {
        value: 7,
        unit: "% of GDP",
        label: "Remittance inflows to top receiving Caribbean states",
        grade: "A",
        citation: "World Bank Migration & Development Brief, 2023.",
      },
    ],
  },
  {
    id: "debt-ceiling",
    illustration: ill_debt_ceiling.url,
    title: "Debt service crowding out the future the region is trying to build.",
    lede:
      "Caribbean debt-to-GDP ratios sit among the highest in the developing world, while middle-income status blocks concessional financing despite acute climate exposure. High debt starves the very infrastructure that attracts investment — a self-reinforcing trap that shrinks fiscal space precisely when transformation demands it.",
    stats: [
      {
        value: 90,
        unit: "% of GDP",
        label: "Debt-to-GDP, upper-band Caribbean sovereigns",
        grade: "A",
        citation: "IMF WEO database, 2024.",
      },
      {
        value: 25,
        unit: "% of revenue",
        label: "Interest payments as share of government revenue, high-debt cases",
        grade: "B",
        citation: "IMF Article IV consultations, 2022–2024.",
      },
      {
        value: 0,
        unit: "IDA access",
        label: "OECS states eligible for concessional IDA financing today",
        grade: "A",
        citation: "World Bank IDA eligibility list, FY2025.",
      },
    ],
  },
  {
    id: "power-cost",
    illustration: ill_power_cost.url,
    title: "Priced out of competitive investment before negotiations begin.",
    lede:
      "Caribbean electricity costs run three to four times US rates, pricing out manufacturing, data infrastructure, and agro-processing before an incentive is even offered. Diesel dependence turns every oil spike into a balance-of-payments drain. Energy transition here is not climate policy — it is the price of admission.",
    stats: [
      {
        value: 40,
        unit: "¢/kWh",
        label: "Upper-band residential electricity tariff across the OECS",
        grade: "A",
        citation: "CARILEC utility tariff survey, 2023.",
      },
      {
        value: 3.5,
        unit: "× US rate",
        label: "Caribbean electricity cost premium over the US average",
        grade: "B",
        citation: "CARILEC vs. US EIA average retail rate, 2023.",
      },
      {
        value: 90,
        unit: "% diesel",
        label: "Share of OECS grid generation from imported fossil fuels",
        grade: "B",
        citation: "IRENA Caribbean energy transition outlook, 2023.",
      },
    ],
  },
  {
    id: "regulated-out",
    illustration: ill_regulated_out.url,
    title: "Repriced from outside, with no seat at the table setting the rules.",
    lede:
      "EU blacklists, OECD tax rules, and the global minimum tax are dismantling the offshore financial services model that once diversified Caribbean inflows, while FATF grey-listing looms as a constant threat. External actors keep repricing the region's access to the global economy — unilaterally, and on their timetable.",
    stats: [
      {
        value: 15,
        unit: "% minimum",
        label: "OECD Pillar Two global minimum corporate tax rate now in force",
        grade: "A",
        citation: "OECD/G20 Inclusive Framework, 2024 implementation.",
      },
      {
        value: 4,
        unit: "listings",
        label: "Caribbean jurisdictions on active EU tax or AML lists in the last five years",
        grade: "B",
        citation: "EU Council tax and AML list revisions, 2019–2024.",
      },
      {
        value: 0,
        unit: "seats",
        label: "OECS votes on the OECD Inclusive Framework steering committee",
        grade: "A",
        citation: "OECD Inclusive Framework governance roster, 2024.",
      },
    ],
  },
  {
    id: "talent-drain",
    illustration: ill_talent_drain.url,
    title: "Exporting the people who would build the future the region needs.",
    lede:
      "Nurses, teachers, and engineers leave faster than economies can replace them, hollowing out the skilled labor base investors require. Remittances flow back — stable but stagnant, and vulnerable to diaspora aging and shifting immigration policy abroad. A nation cannot build what it keeps sending away.",
    stats: [
      {
        value: 70,
        unit: "% emigration",
        label: "Tertiary-educated emigration rate, upper-band Caribbean states",
        grade: "A",
        citation: "World Bank / OECD DIOC skilled-migration database, 2020.",
      },
      {
        value: 20,
        unit: "% of GDP",
        label: "Remittances as share of GDP, top-receiving Caribbean economies",
        grade: "A",
        citation: "World Bank Migration & Development Brief, 2023.",
      },
      {
        value: 8,
        unit: "% shortfall",
        label: "Public-sector nursing vacancy rate across the OECS",
        grade: "B",
        citation: "PAHO Caribbean health workforce assessments, 2022.",
      },
    ],
  },
];
