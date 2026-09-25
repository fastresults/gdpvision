// @domain standards
// @tables reporting_standards,standard_requirements,country_kpis,country_kpi_points,collection_protocols,standard_kpi_mappings,standards_audit_snapshots,audit_log
// @ui src/routes/_authenticated/admin/countries.$code.standards.tsx
//
// The standards audit and its collection plans.
//
// Scoring lives in ./scoring.ts (pure) and loading in ./audit-data.server.ts,
// shared with the monthly snapshot. Plan governance lives in the database
// (drizzle/migrations/0009 §2): the trigger enforces the status machine, the
// two-person rule and approver roles, reopens an edited approved plan, and
// writes the history. These functions therefore send either content (savePlan)
// or a status change (transitionPlan) — never both in an approval, and never
// governance columns — and pass the database's message through governanceError.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireAdmin } from "@/lib/auth/require-admin";
import {
  db,
  governanceError,
  loadCapabilities,
  loadHistory,
  type AuditSnapshotRow,
  type CollectionPlanRow,
  type HistoryEntry,
  type PlanStatus,
} from "@/lib/syndication/db";

import { computeCountryAudit, monthLabel, type StandardInfo } from "./audit-data.server";
import type { AuditRow, AuditSummary } from "./scoring";

export type { AuditRow, AuditSummary, ReqStatus } from "./scoring";

export type StandardCard = StandardInfo & { met: number; total: number; weightedPct: number };

export type PlanSummary = {
  id: string;
  requirementId: string;
  status: PlanStatus;
  ownerAgency: string | null;
  method: string;
  dueDate: string | null;
  version: number;
  createdBy: string | null;
  submittedBy: string | null;
  submittedAt: string | null;
  returnedNote: string | null;
  updatedAt: string;
};

export type SnapshotPoint = {
  period: string;
  coveragePct: number;
  weightedPct: number;
  counts: Record<string, number>;
};

export type Capabilities = {
  approvePlans: boolean;
  approveInvestments: boolean;
  compliance: boolean;
  /** Global admin: may record a snapshot on demand. */
  isAdmin: boolean;
};

export type StandardsAudit = {
  standards: StandardCard[];
  rows: AuditRow[];
  summary: AuditSummary;
  plans: PlanSummary[];
  /** Oldest first. */
  snapshots: SnapshotPoint[];
  capabilities: Capabilities;
  userId: string;
  suggestionsPending: number;
};

const Code = z.string().min(2).max(3);

export const getStandardsAudit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ code: Code }).parse(d))
  .handler(async ({ data, context }): Promise<StandardsAudit> => {
    const sb = context.supabase;
    const [audit, snaps, caps, admin] = await Promise.all([
      computeCountryAudit(sb, data.code),
      db(sb)
        .from("standards_audit_snapshots")
        .select("period_label,coverage_pct,weighted_pct,counts")
        .eq("country_code", data.code)
        .order("period_label", { ascending: false })
        .limit(12),
      loadCapabilities(sb, context.userId, data.code),
      sb.rpc("has_role", { _user_id: context.userId, _role: "admin" }),
    ]);
    if (snaps.error) throw governanceError(snaps.error);

    const byStd = new Map(audit.summary.byStandard.map((s) => [s.code, s]));
    const standards: StandardCard[] = audit.library.standards.map((s) => {
      const b = byStd.get(s.code);
      return { ...s, met: b?.met ?? 0, total: b?.total ?? 0, weightedPct: b?.weightedPct ?? 0 };
    });

    const snapshots = (
      (snaps.data ?? []) as Array<
        Pick<AuditSnapshotRow, "period_label" | "coverage_pct" | "weighted_pct" | "counts">
      >
    )
      .map((s) => ({
        period: s.period_label,
        coveragePct: Number(s.coverage_pct),
        weightedPct: Number(s.weighted_pct),
        counts: s.counts ?? {},
      }))
      .reverse();

    return {
      standards,
      rows: audit.rows,
      summary: audit.summary,
      plans: audit.plans.map(toSummary),
      snapshots,
      capabilities: { ...caps, isAdmin: !!admin.data },
      userId: context.userId,
      suggestionsPending: audit.mappings.filter((m) => m.status === "suggested").length,
    };
  });

function toSummary(p: CollectionPlanRow): PlanSummary {
  return {
    id: p.id,
    requirementId: p.requirement_id,
    status: p.status,
    ownerAgency: p.owner_agency,
    method: p.method,
    dueDate: p.due_date,
    version: p.version ?? 1,
    createdBy: p.created_by,
    submittedBy: p.submitted_by,
    submittedAt: p.submitted_at,
    returnedNote: p.returned_note,
    updatedAt: p.updated_at,
  };
}

export const getPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ code: Code, requirementId: z.string().uuid() }).parse(d))
  .handler(
    async ({
      data,
      context,
    }): Promise<{ plan: CollectionPlanRow | null; history: PlanHistoryItem[] }> => {
      const { data: row, error } = await db(context.supabase)
        .from("collection_protocols")
        .select("*")
        .eq("country_code", data.code)
        .eq("requirement_id", data.requirementId)
        .maybeSingle();
      if (error) throw governanceError(error);
      const plan = (row ?? null) as CollectionPlanRow | null;
      const history = plan
        ? (await loadHistory(context.supabase, "collection_protocol", plan.id)).map(toHistoryItem)
        : [];
      return { plan, history };
    },
  );

export type PlanHistoryItem = {
  id: string;
  action: string;
  actorId: string | null;
  actorLabel: string | null;
  from: string | null;
  to: string | null;
  version: number | null;
  note: string | null;
  at: string;
};

function toHistoryItem(h: HistoryEntry): PlanHistoryItem {
  const m = h.metadata ?? {};
  const str = (v: unknown) => (typeof v === "string" && v ? v : null);
  return {
    id: h.id,
    action: h.action,
    actorId: h.actor_id,
    actorLabel: h.actor_label,
    from: str(m.from),
    to: str(m.to),
    version: typeof m.version === "number" ? m.version : null,
    note: str(m.note),
    at: h.created_at,
  };
}

const SavePlanInput = z.object({
  code: Code,
  requirementId: z.string().uuid(),
  owner: z.string().trim().max(200).optional(),
  method: z.string().trim().min(1).max(200),
  cadence: z.string().trim().min(1).max(50),
  validation: z.string().trim().max(2000).optional(),
  due: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .or(z.literal("")),
  notes: z.string().trim().max(4000).optional(),
  submit: z.boolean(),
});

/**
 * Content write. Creates the plan or updates its content; with `submit`, also
 * sends it for approval. Editing a submitted or approved plan sends it back to
 * draft (version + 1) — the database does that, not this function.
 */
export const savePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => SavePlanInput.parse(d))
  .handler(
    async ({
      data,
      context,
    }): Promise<{ id: string; status: PlanStatus; version: number; reopened: boolean }> => {
      const c = db(context.supabase);
      const content = {
        owner_agency: data.owner || null,
        method: data.method,
        cadence: data.cadence,
        validation_rules: data.validation || null,
        due_date: data.due || null,
        notes: data.notes || null,
      };
      const cols = "id,status,version";

      const { data: existingRaw, error: exErr } = await c
        .from("collection_protocols")
        .select(cols)
        .eq("country_code", data.code)
        .eq("requirement_id", data.requirementId)
        .maybeSingle();
      if (exErr) throw governanceError(exErr);
      const existing = existingRaw as Pick<CollectionPlanRow, "id" | "status" | "version"> | null;

      if (!existing) {
        const { data: ins, error } = await c
          .from("collection_protocols")
          .insert({
            country_code: data.code,
            requirement_id: data.requirementId,
            ...content,
            status: data.submit ? "submitted" : "draft",
          })
          .select(cols)
          .single();
        if (error) throw governanceError(error);
        const r = ins as Pick<CollectionPlanRow, "id" | "status" | "version">;
        return { ...r, reopened: false };
      }

      const editable = existing.status === "draft" || existing.status === "returned";
      const { data: upd, error } = await c
        .from("collection_protocols")
        .update(editable && data.submit ? { ...content, status: "submitted" } : content)
        .eq("id", existing.id)
        .select(cols)
        .maybeSingle();
      if (error) throw governanceError(error);
      if (!upd) throw new Error("You don't have permission to change this plan.");
      let r = upd as Pick<CollectionPlanRow, "id" | "status" | "version">;
      const reopened = !editable && r.status === "draft";

      // A submitted or approved plan whose content changed is now a draft; send it on.
      if (!editable && data.submit && r.status === "draft") {
        const { data: sub, error: sErr } = await c
          .from("collection_protocols")
          .update({ status: "submitted" })
          .eq("id", existing.id)
          .select(cols)
          .maybeSingle();
        if (sErr) throw governanceError(sErr);
        if (sub) r = sub as typeof r;
      }
      return { ...r, reopened };
    },
  );

/**
 * Status-only change: approve, return with a note, or send back to draft
 * (withdraw a submitted plan, or reopen an approved one for revision).
 */
export const transitionPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        code: Code,
        planId: z.string().uuid(),
        to: z.enum(["approved", "returned", "draft"]),
        note: z.string().trim().max(2000).optional(),
      })
      .refine((v) => v.to !== "returned" || !!v.note, {
        message: "Say what needs to change when returning a plan.",
      })
      .parse(d),
  )
  .handler(
    async ({ data, context }): Promise<{ id: string; status: PlanStatus; version: number }> => {
      const patch: Record<string, unknown> = { status: data.to };
      if (data.to === "returned") patch.returned_note = data.note;
      const { data: row, error } = await db(context.supabase)
        .from("collection_protocols")
        .update(patch)
        .eq("id", data.planId)
        .eq("country_code", data.code)
        .select("id,status,version")
        .maybeSingle();
      if (error) throw governanceError(error);
      if (!row) throw new Error("That plan was not found, or you don't have access to it.");
      return row as { id: string; status: PlanStatus; version: number };
    },
  );

/** Deletes a draft plan. The database refuses any other status. */
export const deletePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ code: Code, planId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { data: rows, error } = await db(context.supabase)
      .from("collection_protocols")
      .delete()
      .eq("id", data.planId)
      .eq("country_code", data.code)
      .select("id");
    if (error) throw governanceError(error);
    if (!rows || rows.length === 0)
      throw new Error("That plan was not found, or you don't have access to it.");
    return { ok: true };
  });

/**
 * Admin only: records this month's snapshot for one country now, so the trend
 * line has a first point before the next monthly close.
 */
export const snapshotNow = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d) => z.object({ code: Code }).parse(d))
  .handler(
    async ({ data }): Promise<{ period: string; coveragePct: number; weightedPct: number }> => {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { snapshotCountry } = await import("./snapshot.server");
      const period = monthLabel(new Date());
      const r = await snapshotCountry(supabaseAdmin, data.code, period);
      return { period, ...r };
    },
  );
