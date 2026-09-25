// @domain investments
// @tables none
// @ui src/routes/_authenticated/admin/countries.$code.investments.tsx
//
// Investor-readiness checks. Pure, and mirrored exactly by
// public.investment_readiness() in drizzle/migrations/0009 — the database
// refuses a submission or approval below ten, so the two must agree. If you
// change a check here, change the SQL in the same commit.

export type ReadinessCheck = {
  key: string;
  label: string;
  standard: string;
  ok: boolean;
  /** Which form section fixes it — lets the UI jump straight to the field. */
  section: "profile" | "commercial" | "compliance" | "impact" | "preparation";
  /** What to do when it fails, in one line. */
  fix: string;
};

export type ReadinessInput = {
  sector?: string | null;
  structure?: string | null;
  capex_usd?: number | string | null;
  summary?: string | null;
  revenue_model?: string | null;
  sponsor?: string | null;
  bo_disclosed?: boolean | null;
  aml_cleared?: boolean | null;
  es_category?: string | null;
  climate_alignment?: string | null;
  risks?: string | null;
  feasibility_done?: boolean | null;
  land_secured?: boolean | null;
};

const PLACEHOLDERS = new Set([
  "n/a",
  "na",
  "none",
  "tbd",
  "tba",
  "todo",
  "unknown",
  "pending",
  "---",
]);

/** Mirrors public.gdpv_has_content(): at least three characters and not a placeholder. */
export function hasContent(v: unknown): boolean {
  if (v == null) return false;
  const s = String(v).trim();
  return s.length >= 3 && !PLACEHOLDERS.has(s.toLowerCase());
}

export const ES_CATEGORIES = ["A", "B", "C", "FI"] as const;
export const STAGES = [
  "concept",
  "pre_feasibility",
  "feasibility",
  "structuring",
  "tender",
  "financing",
  "construction",
  "operation",
] as const;
export const STAGE_LABEL: Record<(typeof STAGES)[number], string> = {
  concept: "Concept",
  pre_feasibility: "Pre-feasibility",
  feasibility: "Feasibility",
  structuring: "Structuring",
  tender: "Tender",
  financing: "Financing",
  construction: "Construction",
  operation: "Operation",
};

export function readinessChecks(p: ReadinessInput): ReadinessCheck[] {
  const capex = Number(p.capex_usd ?? 0);
  return [
    {
      key: "profile",
      label: "Sector, structure, size and summary defined",
      standard: "OC4IDS",
      section: "profile",
      fix: "Add the sector, deal structure, capital cost and a one-paragraph summary.",
      ok:
        hasContent(p.sector) &&
        hasContent(p.structure) &&
        Number.isFinite(capex) &&
        capex > 0 &&
        hasContent(p.summary),
    },
    {
      key: "revenue",
      label: "Revenue model described",
      standard: "World Bank PPP Framework",
      section: "commercial",
      fix: "Say how the project earns: user fees, availability payments, offtake, and who pays.",
      ok: hasContent(p.revenue_model),
    },
    {
      key: "sponsor",
      label: "Sponsor identified",
      standard: "OC4IDS",
      section: "commercial",
      fix: "Name the public body or company sponsoring the project.",
      ok: hasContent(p.sponsor),
    },
    {
      key: "bo",
      label: "Beneficial owners disclosed",
      standard: "FATF R.24",
      section: "compliance",
      fix: "A compliance officer lists every beneficial owner in the restricted compliance record.",
      ok: !!p.bo_disclosed,
    },
    {
      key: "aml",
      label: "AML / CBI due diligence cleared",
      standard: "FATF R.10",
      section: "compliance",
      fix: "A compliance officer other than the person who entered the project clears AML, with a reference.",
      ok: !!p.aml_cleared,
    },
    {
      key: "es",
      label: "E&S category assigned (A, B, C or FI)",
      standard: "IFC Performance Standards",
      section: "impact",
      fix: "Assign the IFC environmental and social category.",
      ok:
        typeof p.es_category === "string" &&
        (ES_CATEGORIES as readonly string[]).includes(p.es_category),
    },
    {
      key: "climate",
      label: "Climate and taxonomy alignment stated",
      standard: "ISSB / EU Taxonomy",
      section: "impact",
      fix: "State the climate objective served and any taxonomy or NDC alignment.",
      ok: hasContent(p.climate_alignment),
    },
    {
      key: "risks",
      label: "Key risks documented",
      standard: "GI Hub project preparation",
      section: "preparation",
      fix: "List the main risks and who carries each one.",
      ok: hasContent(p.risks),
    },
    {
      key: "feasibility",
      label: "Feasibility study complete",
      standard: "GI Hub project preparation",
      section: "preparation",
      fix: "Confirm the feasibility study is complete.",
      ok: !!p.feasibility_done,
    },
    {
      key: "land",
      label: "Land and permits secured",
      standard: "World Bank PPP Framework",
      section: "preparation",
      fix: "Confirm land rights and the principal permits are secured.",
      ok: !!p.land_secured,
    },
  ];
}

export function readinessScore(p: ReadinessInput): number {
  return readinessChecks(p).filter((c) => c.ok).length;
}

export const APPROVAL_LABEL: Record<string, string> = {
  draft: "Draft",
  submitted: "Awaiting approval",
  approved: "Approved for investors",
  returned: "Returned for changes",
  withdrawn: "Withdrawn",
};
