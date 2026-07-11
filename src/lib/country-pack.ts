// Country Pack helpers (PRD §7.9 FR-PL-01a).
// Client-safe reference data for the 22 CARICOM + OECS members, with
// richer Country Pack detail for the five OECS CBI states. The database
// is the canonical source (public.countries); this module mirrors it for
// use in SSR/loader contexts and design work.

import { CARICOM_OECS_REGISTRY, type RegistryNation } from "./caricom-registry";

export type PortfolioMap = Record<string, string>;

export interface CountryPack {
  nso?: string;
  centralBank?: string;
  language?: "en" | "fr" | "nl";
  portfolioMap?: PortfolioMap;
}

export interface CountryPackRecord extends RegistryNation {
  currency: string;
  fiscalYearStartMonth: number;
  pack: CountryPack;
}

const XCD_DEFAULT = "XCD";

const PACKS: Record<string, Partial<CountryPackRecord>> = {
  ATG: {
    currency: XCD_DEFAULT,
    fiscalYearStartMonth: 4,
    pack: {
      nso: "Statistics Division of Antigua and Barbuda",
      centralBank: "ECCB",
      language: "en",
      portfolioMap: {
        tourism: "Ministry of Tourism",
        financial: "Ministry of Finance",
        construction: "Ministry of Works",
        "blue-economy": "Ministry of the Blue Economy",
      },
    },
  },
  DMA: {
    currency: XCD_DEFAULT,
    fiscalYearStartMonth: 7,
    pack: { nso: "Central Statistical Office of Dominica", centralBank: "ECCB", language: "en" },
  },
  GRD: {
    currency: XCD_DEFAULT,
    fiscalYearStartMonth: 1,
    pack: { nso: "Central Statistical Office of Grenada", centralBank: "ECCB", language: "en" },
  },
  KNA: {
    currency: XCD_DEFAULT,
    fiscalYearStartMonth: 1,
    pack: { nso: "Department of Statistics of St. Kitts and Nevis", centralBank: "ECCB", language: "en" },
  },
  LCA: {
    currency: XCD_DEFAULT,
    fiscalYearStartMonth: 4,
    pack: {
      nso: "Central Statistical Office of Saint Lucia",
      centralBank: "ECCB",
      language: "en",
      portfolioMap: {
        tourism: "Ministry of Tourism, Investment, Creative Industries, Culture and Information",
        agriculture: "Ministry of Agriculture, Fisheries, Food Security and Rural Development",
        financial: "Ministry of Finance, Economic Development and the Youth Economy",
        energy: "Ministry of Infrastructure, Ports, Transport, Physical Development",
        digital: "Ministry of the Public Service, Home Affairs, Labour and Gender Affairs",
      },
    },
  },
};

/** Full Country Pack for any registry nation. Falls back to XCD + April fiscal year. */
export function countryPack(code: string): CountryPackRecord | undefined {
  const base = CARICOM_OECS_REGISTRY.find((n) => n.code === code);
  if (!base) return undefined;
  const override = PACKS[code];
  return {
    ...base,
    currency: override?.currency ?? XCD_DEFAULT,
    fiscalYearStartMonth: override?.fiscalYearStartMonth ?? 4,
    pack: override?.pack ?? { language: "en" },
  };
}

/** The five OECS CBI states — the Phase 1 pilot cohort. */
export const CBI_STATES = CARICOM_OECS_REGISTRY.filter((n) => n.cbiState).map((n) => n.code);
