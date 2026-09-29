// The ten bodies whose measures investors and lenders read first, and the
// indexes each publishes. Shown on the home page under the hero (IndexBand).
//
// Names are set in type: no body's logo is used without its written
// permission (UN name and emblem: GA resolution 92(I)). Add `logo` to an entry
// only once that permission is on file. Editions checked 29 Sep 2026.

export interface GlobalIndex {
  name: string;
  /** Latest edition, as the body labels it. */
  edition: string;
  url: string;
}

export interface MeasuringBody {
  key: string;
  short: string;
  name: string;
  area: string;
  indexes: GlobalIndex[];
  /** The GDPVision chambers that work on these measures. */
  chambers: string;
  /** Optional logo URL — only with written permission from the body. */
  logo?: string;
}

export const MEASURING_BODIES: MeasuringBody[] = [
  {
    key: "world-bank",
    short: "World Bank",
    name: "World Bank Group",
    area: "Business climate · governance",
    indexes: [
      {
        name: "B-READY (Business Ready)",
        edition: "2025",
        url: "https://www.worldbank.org/en/businessready",
      },
      {
        name: "Worldwide Governance Indicators",
        edition: "2026 update",
        url: "https://www.worldbank.org/en/publication/worldwide-governance-indicators",
      },
      { name: "Logistics Performance Index", edition: "2025", url: "https://lpi.worldbank.org/" },
      {
        name: "Human Capital Index Plus",
        edition: "2026",
        url: "https://www.worldbank.org/en/publication/human-capital",
      },
    ],
    chambers: "National Ledger · FDI Studio",
  },
  {
    key: "imf",
    short: "IMF",
    name: "International Monetary Fund",
    area: "Macroeconomy · fiscal health",
    indexes: [
      {
        name: "World Economic Outlook",
        edition: "April 2026",
        url: "https://www.imf.org/en/publications/weo",
      },
      {
        name: "Article IV assessments",
        edition: "per country",
        url: "https://www.imf.org/en/countries",
      },
    ],
    chambers: "National Ledger",
  },
  {
    key: "undp",
    short: "UNDP",
    name: "UN Development Programme",
    area: "Quality of life",
    indexes: [
      { name: "Human Development Index", edition: "HDR 2025", url: "https://hdr.undp.org/" },
      { name: "Multidimensional Poverty Index", edition: "2025", url: "https://hdr.undp.org/" },
      { name: "Gender and inequality indices", edition: "HDR 2025", url: "https://hdr.undp.org/" },
    ],
    chambers: "Portfolios",
  },
  {
    key: "who",
    short: "WHO",
    name: "World Health Organization",
    area: "Health",
    indexes: [
      {
        name: "UHC Service Coverage Index",
        edition: "2026",
        url: "https://data.who.int/indicators/i/3805B1E/9A706FD",
      },
      {
        name: "World Health Statistics",
        edition: "2026",
        url: "https://www.who.int/news/item/13-05-2026-global-health-gains-face-threat-of-reversal",
      },
    ],
    chambers: "Portfolios",
  },
  {
    key: "unodc",
    short: "UNODC",
    name: "UN Office on Drugs and Crime",
    area: "Crime and safety",
    indexes: [
      { name: "Intentional homicide rate", edition: "data portal", url: "https://data.unodc.org/" },
      {
        name: "Global Study on Homicide",
        edition: "2023",
        url: "https://www.unodc.org/unodc/en/data-and-analysis/global-study-on-homicide.html",
      },
    ],
    chambers: "Cabinet Room",
  },
  {
    key: "ti",
    short: "TI",
    name: "Transparency International",
    area: "Governance",
    indexes: [
      {
        name: "Corruption Perceptions Index",
        edition: "CPI 2025",
        url: "https://www.transparency.org/en/publications/corruption-perceptions-index-2025",
      },
    ],
    chambers: "Cabinet Room · Mandate Compact",
  },
  {
    key: "wef",
    short: "WEF",
    name: "World Economic Forum",
    area: "Tourism competitiveness",
    indexes: [
      {
        name: "Travel & Tourism Development Index",
        edition: "2026",
        url: "https://www.weforum.org/publications/series/travel-tourism-development-index/",
      },
      {
        name: "Global Gender Gap Index",
        edition: "annual",
        url: "https://www.weforum.org/publications/",
      },
    ],
    chambers: "Sector Studio",
  },
  {
    key: "wipo",
    short: "WIPO",
    name: "World Intellectual Property Organization",
    area: "Innovation",
    indexes: [
      {
        name: "Global Innovation Index",
        edition: "GII 2025",
        url: "https://www.wipo.int/web-publications/global-innovation-index-2025/en/gii-2025-at-a-glance.html",
      },
    ],
    chambers: "Sector Studio",
  },
  {
    key: "un-desa",
    short: "UN DESA",
    name: "UN Department of Economic and Social Affairs",
    area: "Digital government",
    indexes: [
      {
        name: "E-Government Development Index",
        edition: "Survey 2024",
        url: "https://publicadministration.un.org/egovkb",
      },
      {
        name: "Local Online Service Index",
        edition: "Survey 2024",
        url: "https://publicadministration.un.org/egovkb",
      },
    ],
    chambers: "Digital Government Studio",
  },
  {
    key: "fatf",
    short: "FATF",
    name: "Financial Action Task Force",
    area: "Financial integrity",
    indexes: [
      {
        name: "Mutual evaluations",
        edition: "per country",
        url: "https://www.fatf-gafi.org/en/countries.html",
      },
      {
        name: "Jurisdictions under increased monitoring",
        edition: "June 2026",
        url: "https://www.fatf-gafi.org/en/countries/black-and-grey-lists.html",
      },
    ],
    chambers: "FDI Studio",
  },
];
