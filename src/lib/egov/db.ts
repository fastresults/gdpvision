// @domain egov
// @tables egov_prds,egov_prd_sections,egov_prd_citations,egov_prd_snapshots,egov_prd_share_links
// @ui src/routes/_authenticated/admin/countries.$code.egov.tsx
//
// Row shapes for the tables added by drizzle/migrations/0012. Queries go
// through `db()` (src/lib/syndication/db.ts) until Lovable regenerates
// types.ts, then results are cast to these interfaces.

import type { BrandTokens } from "./brand";
import type { EgovStage } from "./stages";

export type PrdStatus = "draft" | "submitted" | "approved" | "returned" | "superseded";
export type SectionStatus = "pending" | "drafted" | "edited" | "gap" | "stale";
export type CitationKind = "corpus_row" | "repo_file" | "research_url" | "user";

export interface PrdScope {
  platform_name: string;
  audiences: string[];
  priorities: string[];
  hosting: string;
  notes: string;
}

export interface PrdRow {
  id: string;
  country_code: string;
  version: number;
  title: string;
  status: PrdStatus;
  scope: PrdScope;
  /** Resolved tokens; an older row may hold an empty object, read it through `brandOf()`. */
  brand: BrandTokens | null;
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
  created_at: string;
  updated_at: string;
}

/** One line of the context pack a section was written from. */
export interface ContextLine {
  key: string;
  text: string;
  source: { kind: CitationKind; ref: string; label: string };
}

export interface SectionRow {
  id: string;
  prd_id: string;
  country_code: string;
  stage_key: EgovStage;
  ordinal: number;
  heading: string;
  body_md: string;
  status: SectionStatus;
  context_hash: string | null;
  context: ContextLine[];
  model: string | null;
  authored_at: string | null;
  edited_by: string | null;
  edited_at: string | null;
  created_at: string;
}

export interface CitationRow {
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

export interface PrdShareLinkRow {
  id: string;
  prd_id: string;
  country_code: string;
  token_hash: string;
  token_hint: string;
  label: string;
  max_views: number | null;
  view_count: number;
  last_viewed_at: string | null;
  expires_at: string;
  revoked_at: string | null;
  revoked_by: string | null;
  created_by: string | null;
  created_at: string;
}

export const PRD_STATUS_LABEL: Record<PrdStatus, string> = {
  draft: "Draft",
  submitted: "Awaiting approval",
  approved: "Approved",
  returned: "Returned",
  superseded: "Superseded",
};

export const SECTION_STATUS_LABEL: Record<SectionStatus, string> = {
  pending: "Not yet drafted",
  drafted: "Drafted",
  edited: "Edited",
  gap: "Gap — no grounding",
  stale: "Out of date",
};

/** The stored brand tokens, or null when the row holds none. */
export function brandOf(v: unknown): BrandTokens | null {
  return v && typeof v === "object" && "ink" in (v as object) ? (v as BrandTokens) : null;
}
