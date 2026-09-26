// @domain sector
// @tables sector_shortlists,sector_priorities,sector_plans,sector_plan_sections,sector_plan_citations,sector_plan_snapshots
// @ui src/routes/_authenticated/admin/countries.$code.sector.tsx
//
// Row shapes for the tables added by drizzle/migrations/0018. Queries go
// through `db()` (src/lib/syndication/db.ts) until Lovable regenerates
// types.ts, then results are cast to these interfaces. Section, citation and
// context-line shapes are the Digital Government Studio's (chamber 09).

import type { CitationKind, ContextLine, SectionStatus } from "@/lib/egov/db";

import type { SectorStage } from "./stages";

export type { CitationKind, ContextLine, SectionStatus };

export type PlanStatus = "draft" | "submitted" | "approved" | "returned" | "superseded";
export type Recommendation = "recommend" | "consider" | "hold";

export interface ShortlistRow {
  id: string;
  country_code: string;
  sector_code: string;
  recommendation: Recommendation;
  score: number;
  headline: string;
  brief_md: string;
  citations: Array<{ key: string; label: string; ref: string; why: string }>;
  context_hash: string | null;
  model: string | null;
  generated_by: string | null;
  generated_at: string;
}

export interface PriorityRow {
  id: string;
  country_code: string;
  sector_code: string;
  status: "priority" | "retired";
  rationale: string;
  exit_rule: string;
  chosen_by: string | null;
  chosen_at: string | null;
  retired_by: string | null;
  retired_at: string | null;
  retired_note: string | null;
  created_at: string;
  updated_at: string;
}

export interface PlanScope {
  lead_ministry: string;
  horizon_years: number;
  ambition: string;
  notes: string;
}

export interface PlanRow {
  id: string;
  country_code: string;
  sector_code: string;
  version: number;
  title: string;
  status: PlanStatus;
  scope: PlanScope;
  model: string | null;
  created_by: string | null;
  submitted_by: string | null;
  submitted_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
  approval_mode: "two_person" | "sole_admin" | null;
  returned_by: string | null;
  returned_at: string | null;
  returned_note: string | null;
  commitment_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuditFinding {
  kind: "citation" | "kpi" | "project" | "consistency" | "gap";
  message: string;
}

export interface PlanSectionRow {
  id: string;
  plan_id: string;
  country_code: string;
  stage_key: SectorStage;
  ordinal: number;
  heading: string;
  body_md: string;
  status: SectionStatus;
  context_hash: string | null;
  context: ContextLine[];
  audit: AuditFinding[];
  model: string | null;
  authored_at: string | null;
  edited_by: string | null;
  edited_at: string | null;
  created_at: string;
}

export interface PlanCitationRow {
  id: string;
  section_id: string;
  country_code: string;
  source_kind: CitationKind;
  source_ref: string;
  label: string;
  excerpt: string | null;
  confidence: number | null;
  created_at: string;
}

export const RECOMMENDATION_LABEL: Record<Recommendation, string> = {
  recommend: "Recommend",
  consider: "Consider",
  hold: "Hold",
};

export function scopeOf(v: unknown): PlanScope {
  const s = (v && typeof v === "object" ? v : {}) as Partial<PlanScope>;
  return {
    lead_ministry: typeof s.lead_ministry === "string" ? s.lead_ministry : "",
    horizon_years: typeof s.horizon_years === "number" ? s.horizon_years : 5,
    ambition: typeof s.ambition === "string" ? s.ambition : "",
    notes: typeof s.notes === "string" ? s.notes : "",
  };
}
