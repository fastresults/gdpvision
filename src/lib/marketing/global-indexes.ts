// The ten bodies whose measures investors and lenders read first, and the
// indexes each publishes. Shown on the home page under the hero (IndexBand).
//
// Official logos identify sources, not partnerships. The user confirmed
// permission for all ten on 13 Oct 2026; preserve institutional variants.
// Logo provenance: src/assets/measuring-bodies/sources.md.
// Editions checked 29 Sep 2026.

import worldBankLogo from "@/assets/measuring-bodies/world-bank.svg.asset.json";
import undpLogo from "@/assets/measuring-bodies/undp.svg.asset.json";
import whoLogo from "@/assets/measuring-bodies/who.svg.asset.json";
import tiLogo from "@/assets/measuring-bodies/ti.svg.asset.json";
import wefLogo from "@/assets/measuring-bodies/wef.svg.asset.json";
import wipoLogo from "@/assets/measuring-bodies/wipo.svg.asset.json";
import unodcLogo from "@/assets/measuring-bodies/unodc.svg.asset.json";
import unDesaLogo from "@/assets/measuring-bodies/un-desa.svg.asset.json";
import imfLogo from "@/assets/measuring-bodies/imf.svg.asset.json";
import fatfLogo from "@/assets/measuring-bodies/fatf.png.asset.json";

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
  /** Optional official logo URL — only with permission from the body. */
  logo?: string;
}

export const MEASURING_BODIES: MeasuringBody[] = [
  {
    key: "world-bank",
    logo: worldBankLogo.url,
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
    logo: imfLogo.url,
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
    logo: undpLogo.url,
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
    logo: whoLogo.url,
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
    logo: unodcLogo.url,
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
    logo: tiLogo.url,
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
    logo: wefLogo.url,
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
    logo: wipoLogo.url,
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
    logo: unDesaLogo.url,
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
    logo: fatfLogo.url,
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
