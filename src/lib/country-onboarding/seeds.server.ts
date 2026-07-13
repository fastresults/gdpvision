// Per-stage inference seeds. Tier-3 fallback used when both Perplexity and
// Gemini return nothing usable. Context-aware where possible: seeds read
// the CountryContext (region, TLD, prior committed data) to pick a template
// that fits the country instead of one-size-fits-all defaults.

import type { CountryContext } from "./country-context.server";

export type ProvisionalMinistry = {
  slug: string;
  name: string;
  minister: string | null;
  mandate: string;
  provisional: true;
};

// Canonical small-state cabinet. When ctx marks the country as OECS,
// we use the OECS-standard cabinet template; otherwise we default to a
// generic CARICOM small-state list. Larger states still get a reasonable
// baseline but with a stronger "please review" nudge.
export function seedMinistries(countryName: string, ctx?: CountryContext): ProvisionalMinistry[] {
  const P = (slug: string, name: string, mandate: string): ProvisionalMinistry => ({
    slug,
    name: `Ministry of ${name}`,
    minister: null,
    mandate,
    provisional: true,
  });
  const oecs = ctx?.subRegion === "OECS" || ctx?.isCbiState;
  const base: ProvisionalMinistry[] = [
    P("prime-minister", "the Prime Minister", `Executive leadership and coordination of the Government of ${countryName}.`),
    P("finance", "Finance", "Fiscal policy, budget, taxation, and public debt."),
    P("foreign-affairs", "Foreign Affairs", "Diplomatic relations, treaties, and international cooperation."),
    P("national-security", "National Security", "Policing, defence coordination, and public safety."),
    P("justice", "Justice and Legal Affairs", "Legal policy, courts administration, and prosecutions."),
    P("education", "Education", "Primary, secondary, tertiary education and workforce skills."),
    P("health", "Health and Wellness", "Public health, hospitals, and health insurance."),
    P("agriculture", "Agriculture, Fisheries and Rural Development", "Food production, fisheries, and rural livelihoods."),
    P("tourism", "Tourism, Civil Aviation and Culture", "Tourism policy, aviation, and cultural affairs."),
    P("trade", "Trade, Industry and Commerce", "Trade policy, MSMEs, industrial development."),
    P("infrastructure", "Public Works and Infrastructure", "Roads, ports, buildings, and utilities."),
    P("environment", "Environment, Climate Resilience and Sustainable Development", "Climate policy, disaster risk, and environmental protection."),
    P("social", "Social Services and Community Development", "Social protection, gender, and community development."),
    P("labour", "Labour and Employment", "Labour standards, employment services."),
    P("housing", "Housing and Urban Renewal", "Housing policy and urban development."),
  ];
  // OECS states typically add a dedicated Citizenship by Investment portfolio.
  if (oecs && ctx?.isCbiState) {
    base.push(P("cbi", "Citizenship by Investment", "Administration of the Citizenship by Investment programme."));
  }
  return base;
}

// Standard SNA/ISIC composition — used only when there is truly no data.
// Weights are rough small-island averages; admin should always review.
export function seedSectorComposition(sectorCodes: string[]): Array<{
  sector_code: string;
  share_pct: number;
  confidence_grade: "F";
  rationale: string;
  provisional: true;
}> {
  // Very rough small-state defaults; unknown codes go to 0.
  const defaults: Record<string, number> = {
    agriculture: 3,
    mining: 1,
    manufacturing: 6,
    utilities: 3,
    construction: 8,
    trade: 12,
    transport: 6,
    tourism: 18,
    finance: 10,
    real_estate: 8,
    ict: 4,
    public_admin: 12,
    education: 5,
    health: 5,
  };
  const rows = sectorCodes.map((code) => ({
    sector_code: code,
    share_pct: defaults[code] ?? 0,
    confidence_grade: "F" as const,
    rationale: "Provisional small-state default — no primary source available. Please review.",
    provisional: true as const,
  }));
  // Rescale to 100 if we have any positives.
  const sum = rows.reduce((a, r) => a + r.share_pct, 0);
  if (sum > 0) {
    for (const r of rows) r.share_pct = Math.round((r.share_pct / sum) * 100 * 100) / 100;
  }
  return rows;
}

export function seedMinistrySectorMap(
  ministrySlugs: string[],
  sectorCodes: string[],
): Array<{
  ministry_slug: string;
  sector_code: string;
  weight: number;
  rationale: string;
  provisional: true;
}> {
  // Canonical portfolio → sector map. Only maps ministries we recognize.
  const map: Record<string, Array<[string, number]>> = {
    finance: [["finance", 60], ["public_admin", 20]],
    agriculture: [["agriculture", 80]],
    tourism: [["tourism", 80], ["transport", 20]],
    trade: [["trade", 60], ["manufacturing", 30]],
    infrastructure: [["construction", 60], ["utilities", 30], ["transport", 10]],
    environment: [["utilities", 30]],
    education: [["education", 90]],
    health: [["health", 90]],
    "national-security": [["public_admin", 40]],
    justice: [["public_admin", 40]],
    labour: [["public_admin", 20]],
    social: [["public_admin", 30]],
    housing: [["real_estate", 60], ["construction", 20]],
  };
  const sectorSet = new Set(sectorCodes);
  const rows: Array<{
    ministry_slug: string;
    sector_code: string;
    weight: number;
    rationale: string;
    provisional: true;
  }> = [];
  for (const slug of ministrySlugs) {
    const entries = map[slug] ?? [];
    for (const [sector, weight] of entries) {
      if (!sectorSet.has(sector)) continue;
      rows.push({
        ministry_slug: slug,
        sector_code: sector,
        weight,
        rationale: "Provisional canonical portfolio mapping — please review.",
        provisional: true,
      });
    }
  }
  return rows;
}

export function seedProfile(countryName: string): {
  currency: string;
  fiscal_year_start_month: number;
  population: number;
  hdi: number | null;
  main_exports: string[];
  government_type: string;
  head_of_government: string;
  notes: string;
  provisional: true;
} {
  return {
    currency: "USD",
    fiscal_year_start_month: 1,
    population: 0,
    hdi: null,
    main_exports: [],
    government_type: "Parliamentary democracy",
    head_of_government: "Unknown — please verify",
    notes: `Provisional profile for ${countryName} — no primary source reached. Please review every field.`,
    provisional: true,
  };
}

export function seedGdp(): {
  gdp_current_usd: number;
  gdp_year: number;
  source_primary: string;
  source_secondary: null;
  notes: string;
  provisional: true;
} {
  return {
    gdp_current_usd: 0,
    gdp_year: new Date().getFullYear() - 1,
    source_primary: "Inferred — no source reached",
    source_secondary: null,
    notes: "Provisional zero GDP — no primary or secondary source reached. Please review.",
    provisional: true,
  };
}
