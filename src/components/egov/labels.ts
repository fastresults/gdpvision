// Shared wording and colour for the Digital Government Studio. Status is
// shown with coloured text, a small dot and borders — never a filled pill.

import type { PrdStatus, SectionStatus } from "@/lib/egov/db";

export const MICRO = "font-mono text-[10px] uppercase tracking-[0.28em] text-ink-500";

export const PRD_META: Record<PrdStatus, { label: string; text: string; border: string }> = {
  draft: { label: "Draft", text: "text-draft-state", border: "border-draft-state" },
  submitted: { label: "Awaiting approval", text: "text-gold-500", border: "border-gold-500" },
  approved: { label: "Approved", text: "text-signal-positive", border: "border-signal-positive" },
  returned: {
    label: "Returned for changes",
    text: "text-signal-negative",
    border: "border-signal-negative",
  },
  superseded: { label: "Superseded", text: "text-ink-400", border: "border-line-200" },
};

export const SECTION_META: Record<
  SectionStatus,
  { label: string; text: string; border: string; hollow?: boolean }
> = {
  pending: { label: "Not drafted", text: "text-ink-400", border: "border-line-200", hollow: true },
  drafted: { label: "Drafted", text: "text-signal-positive", border: "border-signal-positive" },
  edited: { label: "Edited", text: "text-scenario-tint", border: "border-scenario-tint" },
  gap: { label: "Gap", text: "text-signal-negative", border: "border-signal-negative" },
  stale: { label: "Out of date", text: "text-signal-caution", border: "border-signal-caution" },
};

export const HISTORY_LABEL: Record<string, string> = {
  "egov_prd.created": "Created",
  "egov_prd.edited": "Scope edited",
  "egov_prd.submitted": "Submitted for approval",
  "egov_prd.approved": "Approved",
  "egov_prd.returned": "Returned",
  "egov_prd.withdrawn": "Withdrawn",
  "egov_prd.reopened": "Reopened",
  "egov_prd.superseded": "Superseded",
  "egov_prd.deleted": "Deleted",
  "egov_share_link.created": "Share link created",
  "egov_share_link.revoked": "Share link revoked",
};

export function formatWhen(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
