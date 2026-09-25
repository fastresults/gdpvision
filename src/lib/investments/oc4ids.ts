// @domain investments
// @tables none
// @ui src/routes/_authenticated/admin/countries.$code.investments.tsx
//
// Pure builder for an OC4IDS project package (schema 0.9).
//
// Field names, required fields and closed codelists were checked against the
// official 0.9 schema files (0.9.5) in open-contracting/infrastructure:
//   schema/project-level/project-package-schema.json
//   schema/project-level/project-schema.json
//   schema/project-level/codelists/{projectStatus,projectSector,classificationScheme}.csv
//
// Only fields the investor-facing page is allowed to show are exported. The
// sponsor, beneficial owners, AML and every other compliance field stay out.
//
// PROJECT IDENTIFIERS: OC4IDS requires each project id to start with a
// registered project identifier prefix ("oc4ids-" + six characters, issued by
// the Open Contracting Partnership). The default used here, "oc4ids-gdpv-<cc>",
// is a placeholder so the file validates structurally; a publishing government
// must register its own prefix with OCP and set it (app setting
// "oc4ids_prefix.<cc>") before publishing the file anywhere public.

export const OC4IDS_VERSION = "0.9";
export const OC4IDS_DEFAULT_LICENSE = "https://creativecommons.org/licenses/by/4.0/";

export function defaultOc4idsPrefix(code: string): string {
  return `oc4ids-gdpv-${code.toLowerCase()}`;
}

/** projectStatus — closed codelist. */
export const OC4IDS_PROJECT_STATUS = [
  "identification",
  "preparation",
  "implementation",
  "completion",
  "maintenance",
  "decommissioning",
  "decommissioned",
  "cancelled",
] as const;
export type Oc4idsStatus = (typeof OC4IDS_PROJECT_STATUS)[number];

/** projectSector — open codelist; these are the published codes. */
export const OC4IDS_PROJECT_SECTOR = [
  "education",
  "health",
  "energy",
  "energy.solar",
  "energy.wind",
  "energy.hydropower",
  "energy.biomass",
  "energy.geothermal",
  "communications",
  "waterAndWaste",
  "governance",
  "economy",
  "cultureSportsAndRecreation",
  "transport",
  "transport.air",
  "transport.water",
  "transport.rail",
  "transport.road",
  "transport.urban",
  "transport.lowCarbon",
  "socialHousing",
  "naturalResources",
  "naturalResources.floodProtection",
] as const;

/**
 * Our stage → projectStatus. OC4IDS puts feasibility, structuring and budget
 * authorisation in "preparation", and the procurement of the works (for a PPP,
 * the concession tender) and construction in "implementation". Operation is
 * OC4IDS "maintenance" ("also called operation").
 */
export const STAGE_TO_OC4IDS_STATUS: Record<string, Oc4idsStatus> = {
  concept: "identification",
  pre_feasibility: "preparation",
  feasibility: "preparation",
  structuring: "preparation",
  tender: "implementation",
  financing: "implementation",
  construction: "implementation",
  operation: "maintenance",
};

// Keyword → sector codes, most specific first. A parent code is always added
// alongside a subsector, as the schema asks.
const SECTOR_RULES: Array<[RegExp, string]> = [
  [/solar|photovolt/i, "energy.solar"],
  [/wind/i, "energy.wind"],
  [/hydro/i, "energy.hydropower"],
  [/biomass|biogas|waste[-\s]?to[-\s]?energy/i, "energy.biomass"],
  [/geotherm/i, "energy.geothermal"],
  [/energy|power|electric|grid|\boil\b|\bgas\b|lng/i, "energy"],
  [/airport|aviation|air\s?transport/i, "transport.air"],
  [/\bports?\b|seaport|harbou?r|marina|cruise|ferry|shipping|maritime/i, "transport.water"],
  [/rail|train|metro/i, "transport.rail"],
  [/road|highway|bridge|tunnel/i, "transport.road"],
  [/bus|urban mobility|mass transit/i, "transport.urban"],
  [/transport|logistic/i, "transport"],
  [/flood|coastal protection|sea ?wall/i, "naturalResources.floodProtection"],
  [/forest|land management|natural resource/i, "naturalResources"],
  [/water|sanitation|sewer|waste/i, "waterAndWaste"],
  [/school|education|universit|training/i, "education"],
  [/health|hospital|clinic|medical/i, "health"],
  [/telecom|ict|broadband|fibre|fiber|digital|data cent/i, "communications"],
  [/housing|residential/i, "socialHousing"],
  [/agri|farm|fisher|industr|manufactur|economic zone|science/i, "economy"],
  [/touris|hotel|resort|culture|\bsports?\b|recreation|\bparks?\b/i, "cultureSportsAndRecreation"],
  [/government|justice|court|prison|public building|defen[cs]e/i, "governance"],
];

export function mapSector(sector: string | null | undefined): string[] {
  if (!sector) return [];
  const s = sector.trim();
  if ((OC4IDS_PROJECT_SECTOR as readonly string[]).includes(s)) {
    return s.includes(".") ? [s.split(".")[0], s] : [s];
  }
  for (const [re, code] of SECTOR_RULES) {
    if (re.test(s)) return code.includes(".") ? [code.split(".")[0], code] : [code];
  }
  return [];
}

const IFC_CATEGORY_DESCRIPTION: Record<string, string> = {
  A: "Category A: potential significant adverse environmental or social risks and impacts that are diverse, irreversible or unprecedented.",
  B: "Category B: potential limited adverse environmental or social risks and impacts that are few, site-specific, largely reversible and readily addressed.",
  C: "Category C: minimal or no adverse environmental or social risks and impacts.",
  FI: "Category FI: investment through a financial intermediary.",
};

export interface Oc4idsSourceProject {
  id: string;
  title: string;
  summary: string | null;
  sector: string | null;
  stage: string;
  capex_usd: number | string | null;
  es_category: string | null;
  climate_alignment: string | null;
  updated_at: string;
}

export interface Oc4idsClassification {
  scheme: string;
  id: string;
  description?: string;
}

export interface Oc4idsProject {
  id: string;
  updated: string;
  title: string;
  description?: string;
  status?: Oc4idsStatus;
  sector?: string[];
  additionalClassifications?: Oc4idsClassification[];
  identifiers?: Array<{ id: string; scheme: string }>;
  budget?: { amount: { amount: number; currency: "USD" } };
  environment?: {
    impactCategories?: Oc4idsClassification[];
    climateMeasures?: Array<{ description: string }>;
  };
}

export interface Oc4idsPackage {
  uri: string;
  publishedDate: string;
  publisher: { name: string };
  version: typeof OC4IDS_VERSION;
  license: string;
  projects: Oc4idsProject[];
}

export interface BuildOptions {
  countryCode: string;
  publisherName: string;
  prefix?: string;
  license?: string;
  /** Defaults to now. */
  publishedDate?: string;
  /** Defaults to a URN naming the country and publication time. */
  uri?: string;
}

function toIso(v: string): string {
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? v : d.toISOString();
}

export function buildOc4idsProject(p: Oc4idsSourceProject, prefix: string): Oc4idsProject {
  const out: Oc4idsProject = {
    id: `${prefix}-${p.id}`,
    updated: toIso(p.updated_at),
    title: p.title.trim(),
  };
  if (p.summary && p.summary.trim()) out.description = p.summary.trim();
  const status = STAGE_TO_OC4IDS_STATUS[p.stage];
  if (status) out.status = status;

  const sectors = mapSector(p.sector);
  if (sectors.length) out.sector = sectors;
  if (
    p.sector &&
    p.sector.trim() &&
    !(OC4IDS_PROJECT_SECTOR as readonly string[]).includes(p.sector.trim())
  ) {
    // classificationScheme is an open codelist; the "x_" prefix marks a local scheme.
    out.additionalClassifications = [
      { scheme: "x_gdpvisionSector", id: slug(p.sector), description: p.sector.trim() },
    ];
  }
  out.identifiers = [{ id: p.id, scheme: "GDPVision" }];

  const capex = Number(p.capex_usd);
  if (p.capex_usd != null && Number.isFinite(capex) && capex > 0) {
    out.budget = { amount: { amount: capex, currency: "USD" } };
  }

  const env: NonNullable<Oc4idsProject["environment"]> = {};
  if (p.es_category && IFC_CATEGORY_DESCRIPTION[p.es_category]) {
    env.impactCategories = [
      {
        scheme: "ifcEnvironmentalSocial",
        id: p.es_category,
        description: IFC_CATEGORY_DESCRIPTION[p.es_category],
      },
    ];
  }
  if (p.climate_alignment && p.climate_alignment.trim()) {
    env.climateMeasures = [{ description: p.climate_alignment.trim() }];
  }
  if (Object.keys(env).length) out.environment = env;
  return out;
}

export function buildOc4idsPackage(
  projects: Oc4idsSourceProject[],
  opts: BuildOptions,
): Oc4idsPackage {
  const publishedDate = opts.publishedDate ?? new Date().toISOString();
  const prefix = (opts.prefix ?? defaultOc4idsPrefix(opts.countryCode)).replace(/-+$/, "");
  return {
    uri: opts.uri ?? `urn:gdpvision:oc4ids:${opts.countryCode.toLowerCase()}:${publishedDate}`,
    publishedDate,
    publisher: { name: opts.publisherName },
    version: OC4IDS_VERSION,
    license: opts.license ?? OC4IDS_DEFAULT_LICENSE,
    projects: projects.map((p) => buildOc4idsProject(p, prefix)),
  };
}

export interface Oc4idsWarning {
  /** Project id, or "package". */
  where: string;
  title?: string;
  message: string;
  /** "error" means the file will not validate against the schema. */
  level: "error" | "warning";
}

const URI_RE = /^[a-z][a-z0-9+.-]*:[^\s]+$/i;
const PREFIX_RE = /^oc4ids-[a-z0-9]{6}-/;

/** Checks required fields and codelist values. Not a full JSON Schema validation. */
export function validateOc4idsPackage(pkg: Oc4idsPackage): Oc4idsWarning[] {
  const w: Oc4idsWarning[] = [];
  const pk = (message: string, level: "error" | "warning" = "error") =>
    w.push({ where: "package", message, level });

  if (!pkg.uri || !URI_RE.test(pkg.uri)) pk("The package needs a URI.");
  if (!pkg.publishedDate || Number.isNaN(Date.parse(pkg.publishedDate)))
    pk("The published date is missing or not a date-time.");
  if (!pkg.publisher?.name?.trim()) pk("The publisher needs a name.");
  if (!/^\d+\.\d+$/.test(pkg.version))
    pk("The schema version must be written as major.minor, e.g. 0.9.");
  if (pkg.license && !URI_RE.test(pkg.license)) pk("The licence must be a link.", "warning");
  if (!pkg.projects.length)
    pk(
      "OC4IDS needs at least one project. Only approved projects are exported, and none are approved yet.",
    );

  const seen = new Set<string>();
  for (const p of pkg.projects) {
    const add = (message: string, level: "error" | "warning" = "warning") =>
      w.push({ where: p.id, title: p.title, message, level });
    if (!p.id) add("Project has no identifier.", "error");
    if (seen.has(p.id)) add("Two projects share this identifier.", "error");
    seen.add(p.id);
    if (p.id.startsWith("oc4ids-gdpv-"))
      add(
        "Uses the placeholder identifier prefix. Register a prefix with the Open Contracting Partnership before publishing.",
      );
    else if (!PREFIX_RE.test(p.id))
      add("The identifier does not start with an OC4IDS prefix (oc4ids- plus six characters).");
    if (!p.title?.trim()) add("Title is empty.", "error");
    if (!p.updated || Number.isNaN(Date.parse(p.updated)))
      add("Last-updated date is missing.", "error");
    if (!p.description) add("No description: add a summary.");
    if (!p.status) add("Stage has no OC4IDS status equivalent, so status is left out.");
    else if (!(OC4IDS_PROJECT_STATUS as readonly string[]).includes(p.status))
      add(`"${p.status}" is not in the projectStatus codelist.`, "error");
    if (!p.sector?.length)
      add(
        "Sector could not be matched to the OC4IDS projectSector codelist, so it is left out. The original is kept as an additional classification.",
      );
    for (const s of p.sector ?? []) {
      if (!(OC4IDS_PROJECT_SECTOR as readonly string[]).includes(s))
        add(`"${s}" is not a published projectSector code.`);
    }
    if (!p.budget) add("No capital cost, so budget is left out.");
    else if (!(p.budget.amount.amount >= 0)) add("Budget amount is not a number.", "error");
    for (const c of p.environment?.impactCategories ?? []) {
      if (!c.scheme || !c.id) add("An impact category is missing its scheme or code.", "error");
    }
  }
  return w;
}

function slug(s: string): string {
  return (
    s
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || "unspecified"
  );
}
