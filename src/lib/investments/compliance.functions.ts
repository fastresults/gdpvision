// @domain investments
// @tables investment_project_compliance,investment_projects
// @ui src/routes/_authenticated/admin/countries.$code.investments.$id.tsx
//
// The restricted compliance record: beneficial owners and AML due diligence.
// Row-level security limits it to compliance officers (country_admin,
// cabinet_secretary, global admin). The database pushes two booleans —
// bo_disclosed and aml_cleared — onto the project so everyone else can see
// readiness without seeing names. Clearing AML needs a reference and a person
// other than the project's creator; the trigger enforces both.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { codeSchema, parseInput } from "@/lib/investments/pipeline.functions";
import { hasContent } from "@/lib/investments/readiness";
import {
  db,
  governanceError,
  loadCapabilities,
  type BeneficialOwner,
  type ComplianceRow,
} from "@/lib/syndication/db";

export const AML_STATUSES = ["not_started", "in_progress", "cleared", "failed"] as const;
export type AmlStatus = (typeof AML_STATUSES)[number];
export const AML_STATUS_LABEL: Record<AmlStatus, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  cleared: "Cleared",
  failed: "Failed",
};

export type ComplianceView =
  | {
      restricted: true;
      compliance: null;
      bo_disclosed: boolean;
      aml_cleared: boolean;
    }
  | {
      restricted: false;
      compliance: ComplianceRow;
      bo_disclosed: boolean;
      aml_cleared: boolean;
      /** The creator of a project cannot clear its AML. */
      viewerIsCreator: boolean;
      exists: boolean;
    };

export const getCompliance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    parseInput(z.object({ code: codeSchema, projectId: z.string().uuid() }), d),
  )
  .handler(async ({ data, context }): Promise<ComplianceView> => {
    const c = db(context.supabase);
    const { data: proj, error: pe } = await c
      .from("investment_projects")
      .select("id,created_by,bo_disclosed,aml_cleared")
      .eq("id", data.projectId)
      .eq("country_code", data.code)
      .maybeSingle();
    if (pe) throw governanceError(pe);
    if (!proj) throw new Error("This project does not exist or you do not have access to it.");
    const p = proj as { created_by: string | null; bo_disclosed: boolean; aml_cleared: boolean };
    const flags = { bo_disclosed: !!p.bo_disclosed, aml_cleared: !!p.aml_cleared };

    const caps = await loadCapabilities(context.supabase, context.userId, data.code);
    if (!caps.compliance) return { restricted: true, compliance: null, ...flags };

    const { data: row, error } = await c
      .from("investment_project_compliance")
      .select("*")
      .eq("project_id", data.projectId)
      .maybeSingle();
    // RLS returns nothing (or an error) to a non-officer; treat both as restricted.
    if (error) return { restricted: true, compliance: null, ...flags };
    const empty: ComplianceRow = {
      project_id: data.projectId,
      country_code: data.code,
      beneficial_owners: [],
      aml_status: "not_started",
      aml_reference: null,
      aml_cleared_by: null,
      aml_cleared_at: null,
      notes: null,
      updated_by: null,
      created_at: "",
      updated_at: "",
    };
    const compliance = row ? (row as ComplianceRow) : empty;
    if (!Array.isArray(compliance.beneficial_owners)) compliance.beneficial_owners = [];
    return {
      restricted: false,
      compliance,
      ...flags,
      viewerIsCreator: p.created_by === context.userId,
      exists: !!row,
    };
  });

const ownerSchema = z.object({
  name: z.string().trim().min(3, "Each owner needs a full name (at least three characters)."),
  nationality: z.string().trim().max(80).nullable().optional(),
  ownership_pct: z
    .number()
    .min(0, "Ownership must be between 0 and 100%.")
    .max(100, "Ownership must be between 0 and 100%.")
    .nullable()
    .optional(),
  is_pep: z.boolean().nullable().optional(),
  evidence: z.string().trim().max(500).nullable().optional(),
  legacy: z.boolean().optional(),
});

export function complianceWarnings(owners: BeneficialOwner[]): string[] {
  const out: string[] = [];
  if (owners.length === 0)
    out.push("No beneficial owners are listed, so the disclosure check will not pass.");
  const pcts = owners.map((o) => o.ownership_pct).filter((v): v is number => typeof v === "number");
  const total = pcts.reduce((s, v) => s + v, 0);
  if (owners.length > 0 && pcts.length < owners.length)
    out.push("Some owners have no ownership percentage.");
  if (pcts.length > 0 && total < 100) {
    out.push(`Listed ownership adds up to ${round(total)}%. The list may be incomplete.`);
  }
  if (owners.some((o) => o.legacy)) {
    out.push("One entry was migrated from the old free-text field. Split it into named owners.");
  }
  if (owners.some((o) => !hasContent(o.name))) out.push("An owner name looks like a placeholder.");
  return out;
}

function round(n: number) {
  return Math.round(n * 100) / 100;
}

export const saveCompliance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    parseInput(
      z
        .object({
          code: codeSchema,
          projectId: z.string().uuid(),
          owners: z.array(ownerSchema).max(50),
          aml_status: z.enum(AML_STATUSES),
          aml_reference: z.string().trim().max(200).nullable().optional(),
          notes: z.string().trim().max(4000).nullable().optional(),
        })
        .superRefine((v, ctx) => {
          const total = v.owners.reduce((s, o) => s + (o.ownership_pct ?? 0), 0);
          if (total > 100.0001) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `Ownership adds up to ${round(total)}%, which is more than 100%.`,
            });
          }
          if (v.aml_status === "cleared" && !v.aml_reference) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: "Record the due-diligence reference when clearing AML.",
            });
          }
        }),
      d,
    ),
  )
  .handler(async ({ data, context }) => {
    const caps = await loadCapabilities(context.supabase, context.userId, data.code);
    if (!caps.compliance)
      throw new Error("Only a compliance officer can change the compliance record.");
    const owners: BeneficialOwner[] = data.owners.map((o) => ({
      name: o.name,
      nationality: o.nationality || null,
      ownership_pct: o.ownership_pct ?? null,
      is_pep: o.is_pep ?? null,
      evidence: o.evidence || null,
      ...(o.legacy ? { legacy: true } : {}),
    }));
    const { error } = await db(context.supabase)
      .from("investment_project_compliance")
      .upsert(
        {
          project_id: data.projectId,
          country_code: data.code,
          beneficial_owners: owners,
          aml_status: data.aml_status,
          aml_reference: data.aml_reference || null,
          notes: data.notes || null,
        },
        { onConflict: "project_id" },
      );
    if (error) throw governanceError(error);
    return { ok: true, warnings: complianceWarnings(owners) };
  });
