// CARICOM + OECS registry (PRD §7.9 FR-PL-01a).
// Immutable reference used by the marketing briefing form and (later) the
// product's country configuration step. Codes are ISO 3166-1 alpha-3 where
// applicable; associate members use their conventional short codes.

export type MembershipTier = "caricom-full" | "caricom-associate" | "oecs-associate";

export interface RegistryNation {
  code: string;
  name: string;
  tier: MembershipTier;
  /** True for the five OECS CBI states (PRD §2). */
  cbiState?: boolean;
}

export const CARICOM_OECS_REGISTRY: RegistryNation[] = [
  // 15 CARICOM full members
  { code: "ATG", name: "Antigua & Barbuda", tier: "caricom-full", cbiState: true },
  { code: "BHS", name: "The Bahamas", tier: "caricom-full" },
  { code: "BRB", name: "Barbados", tier: "caricom-full" },
  { code: "BLZ", name: "Belize", tier: "caricom-full" },
  { code: "DMA", name: "Dominica", tier: "caricom-full", cbiState: true },
  { code: "GRD", name: "Grenada", tier: "caricom-full", cbiState: true },
  { code: "GUY", name: "Guyana", tier: "caricom-full" },
  { code: "HTI", name: "Haiti", tier: "caricom-full" },
  { code: "JAM", name: "Jamaica", tier: "caricom-full" },
  { code: "MSR", name: "Montserrat", tier: "caricom-full" },
  { code: "KNA", name: "St. Kitts & Nevis", tier: "caricom-full", cbiState: true },
  { code: "LCA", name: "Saint Lucia", tier: "caricom-full", cbiState: true },
  { code: "VCT", name: "St. Vincent & the Grenadines", tier: "caricom-full" },
  { code: "SUR", name: "Suriname", tier: "caricom-full" },
  { code: "TTO", name: "Trinidad & Tobago", tier: "caricom-full" },
  // CARICOM associate members
  { code: "AIA", name: "Anguilla", tier: "caricom-associate" },
  { code: "BMU", name: "Bermuda", tier: "caricom-associate" },
  { code: "VGB", name: "British Virgin Islands", tier: "caricom-associate" },
  { code: "CYM", name: "Cayman Islands", tier: "caricom-associate" },
  { code: "TCA", name: "Turks & Caicos Islands", tier: "caricom-associate" },
  // OECS associate members not already listed above
  { code: "MTQ", name: "Martinique", tier: "oecs-associate" },
  { code: "GLP", name: "Guadeloupe", tier: "oecs-associate" },
];

export const REGISTRY_CODES = new Set(CARICOM_OECS_REGISTRY.map((n) => n.code));

// ISO 3166-1 alpha-3 → alpha-2 for the CARICOM/OECS registry. Used to
// resolve flag imagery via flagcdn.com.
export const ISO3_TO_ISO2: Record<string, string> = {
  ATG: "ag", BHS: "bs", BRB: "bb", BLZ: "bz", DMA: "dm", GRD: "gd",
  GUY: "gy", HTI: "ht", JAM: "jm", MSR: "ms", KNA: "kn", LCA: "lc",
  VCT: "vc", SUR: "sr", TTO: "tt", AIA: "ai", BMU: "bm", VGB: "vg",
  CYM: "ky", TCA: "tc", MTQ: "mq", GLP: "gp",
};

export function flagUrl(iso3: string, size: "w160" | "w320" | "w640" | "w1280" = "w320"): string | null {
  const iso2 = ISO3_TO_ISO2[(iso3 ?? "").toUpperCase()];
  if (!iso2) return null;
  return `https://flagcdn.com/${size}/${iso2}.png`;
}

// Twelve canonical GDP sectors (PRD Appendix A). Numbering matches
// --sector-01 … --sector-12 tokens in styles.css.
export interface CanonicalSector {
  index: number;
  slug: string;
  label: string;
  cssVar: string;
}

export const CANONICAL_SECTORS: CanonicalSector[] = [
  { index: 1, slug: "public-administration", label: "Public administration", cssVar: "--sector-01" },
  { index: 2, slug: "agriculture", label: "Agriculture & fisheries", cssVar: "--sector-02" },
  { index: 3, slug: "tourism", label: "Tourism", cssVar: "--sector-03" },
  { index: 4, slug: "construction", label: "Construction", cssVar: "--sector-04" },
  { index: 5, slug: "transport", label: "Transport & logistics", cssVar: "--sector-05" },
  { index: 6, slug: "blue-economy", label: "Blue economy", cssVar: "--sector-06" },
  { index: 7, slug: "manufacturing", label: "Manufacturing", cssVar: "--sector-07" },
  { index: 8, slug: "energy", label: "Energy", cssVar: "--sector-08" },
  { index: 9, slug: "digital", label: "Digital economy", cssVar: "--sector-09" },
  { index: 10, slug: "financial", label: "Financial services", cssVar: "--sector-10" },
  { index: 11, slug: "real-estate", label: "Real estate", cssVar: "--sector-11" },
  { index: 12, slug: "other-services", label: "Other services", cssVar: "--sector-12" },
];
