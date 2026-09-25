// Shared wording and colour for the standards audit. Status is shown with
// coloured text, a small dot and borders — never a filled pill or banner.

import type { StandardsRowCtx } from "@/lib/explain/standards-entries";
import type { AuditRow, ReqStatus } from "@/lib/standards/scoring";
import type { PlanStatus } from "@/lib/syndication/db";

export const STATUS_META: Record<
  ReqStatus,
  { label: string; text: string; border: string; hollow?: boolean }
> = {
  missing: { label: "Missing", text: "text-signal-negative", border: "border-signal-negative" },
  stale: { label: "Out of date", text: "text-signal-caution", border: "border-signal-caution" },
  planned: {
    label: "Planned",
    text: "text-scenario-tint",
    border: "border-scenario-tint",
    hollow: true,
  },
  partial: { label: "Partial", text: "text-gold-500", border: "border-gold-500" },
  collected: { label: "Collected", text: "text-signal-positive", border: "border-signal-positive" },
};

export const PLAN_META: Record<PlanStatus, { label: string; text: string; border: string }> = {
  draft: { label: "Draft", text: "text-draft-state", border: "border-draft-state" },
  submitted: { label: "Awaiting approval", text: "text-gold-500", border: "border-gold-500" },
  approved: { label: "Approved", text: "text-signal-positive", border: "border-signal-positive" },
  returned: {
    label: "Returned for changes",
    text: "text-signal-negative",
    border: "border-signal-negative",
  },
};

export const IMPACT_LABEL: Record<string, string> = { high: "High", medium: "Medium", low: "Low" };

export const FREQUENCY_LABEL: Record<string, string> = {
  monthly: "Monthly",
  quarterly: "Quarterly",
  annual: "Annual",
  continuous: "Continuous",
};

export const SURVEY_METHOD = "survey (Persona Lab fieldwork)";
export const METHOD_OPTIONS = [
  "administrative records",
  SURVEY_METHOD,
  "API / automated feed",
  "manual upload",
] as const;
export const CADENCE_OPTIONS = ["monthly", "quarterly", "annual", "continuous"] as const;

/** Plain-language wording for governance_history actions. */
export function historyWords(action: string, version: number | null): string {
  switch (action) {
    case "protocol.created":
      return "Created as a draft";
    case "protocol.submitted":
      return "Submitted for approval";
    case "protocol.approved":
      return "Approved";
    case "protocol.returned":
      return "Returned for changes";
    case "protocol.withdrawn":
      return "Withdrawn from approval";
    case "protocol.reopened":
      return version ? `Reopened for editing as version ${version}` : "Reopened for editing";
    case "protocol.edited":
      return "Edited";
    case "protocol.deleted":
      return "Deleted";
    default:
      return action.replace(/^[a-z_]+\./, "").replace(/_/g, " ");
  }
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** A plan whose due date has passed while the requirement is still not collected. */
export function isPastDue(due: string | null | undefined, status: ReqStatus): boolean {
  return !!due && due < todayIso() && status !== "collected";
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function formatDateTime(iso: string): string {
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

export function ageText(months: number | null): string {
  if (months == null) return "age unknown";
  if (months === 0) return "this month";
  return `${months} mo old`;
}

export const MICRO = "font-mono text-[10px] uppercase tracking-[0.14em] text-ink-500";

/** Context for the per-row Explain entries (standards.status / freshness / planned). */
export function rowCtx(r: AuditRow): StandardsRowCtx {
  return {
    label: r.label,
    status: r.status,
    frequency: r.frequency,
    maxLagMonths: r.maxLagMonths,
    reasons: r.reasons,
    evidence: r.evidence.map((e) => ({
      kpi: e.kpi,
      period: e.period,
      ageMonths: e.ageMonths,
      fresh: e.fresh,
      viaMapping: e.viaMapping,
    })),
    plan: r.plan
      ? { status: r.plan.status, dueDate: r.plan.dueDate, overdue: r.plan.overdue }
      : null,
  };
}
