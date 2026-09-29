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
      "Five Caribbean states rely heavily on Citizenship by Investment (CBI) for national income and government revenue. Yet national statistics arrive in annual reports, and IMF assessments may describe conditions from twelve to eighteen months earlier. Cabinet lacks one current view of the economy.",
    stats: [
      {
        value: 50,
        unit: "%",
        label: "Citizenship by Investment receipts as a share of government revenue, upper band",
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
        label: "OECS states operating a Citizenship by Investment programme today",
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
      "The Caribbean sits inside the world’s most concentrated hurricane corridor. Storms are intensifying while insurers retreat. When one event can erase several years of economic output, every national budget needs a current view of climate risk.",
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
      "When tourism drives most of GDP, one recession, one cut in air service, or one pandemic can stop income overnight. COVID showed how little protection the region has against such a shock. Cabinet needs to see and price that risk before the next one arrives.",
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
      "Global banks are cutting the relationships that allow Caribbean banks to move money internationally, often because small markets do not justify the compliance cost. Every lost relationship slows remittances, raises the cost of trade finance, and makes payments harder. The region cannot attract capital it cannot receive.",
    stats: [
      {
        value: 30,
        unit: "% loss",
        label: "Decline in international banking relationships across the Caribbean since 2011",
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
      "Caribbean debt levels are among the highest in the developing world. At the same time, middle-income status blocks access to some low-interest development loans despite severe climate risk. High debt leaves less room in the budget for the infrastructure that attracts investment.",
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
        unit: "with IDA access",
        label: "OECS states eligible for low-interest IDA development finance today",
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
      "Caribbean electricity can cost three to four times the US rate. That can rule out manufacturing, data infrastructure, and food processing before an incentive is offered. Dependence on imported diesel also drains foreign currency whenever oil prices rise. Lower-cost energy is essential to compete.",
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
      "International tax and financial-crime rules are changing the terms on which Caribbean countries access the global economy. EU lists, OECD tax rules, the global minimum tax, and the risk of FATF increased monitoring are set elsewhere and applied on external timetables.",
    stats: [
      {
        value: 15,
        unit: "% minimum",
        label: "OECD global minimum corporate tax rate now in force",
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
