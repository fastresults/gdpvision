// @domain investments
// @tables investment_projects,investment_share_links,investor_interests,countries,app_settings,audit_log
// @ui src/routes/_authenticated/admin/countries.$code.investments.tsx
//
// The investment pipeline. The database (drizzle/migrations/0009) owns every
// governance rule: who can submit, approve, return or withdraw, that editing an
// approved project reopens it, and that compliance fields never live on the
// project row. These functions send content fields and status requests only,
// and pass the database's messages straight through governanceError().

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";
import {
  buildOc4idsPackage,
  defaultOc4idsPrefix,
  validateOc4idsPackage,
  type Oc4idsSourceProject,
} from "@/lib/investments/oc4ids";
import {
  ES_CATEGORIES,
  readinessChecks,
  STAGES,
  type ReadinessCheck,
} from "@/lib/investments/readiness";
import {
  db,
  governanceError,
  loadCapabilities,
  loadHistory,
  PUBLIC_PROJECT_COLUMNS,
  type ApprovalStatus,
  type HistoryEntry,
  type InterestRow,
  type InvestmentProjectRow,
  type ShareLinkRow,
} from "@/lib/syndication/db";

/** Every project column a country user may read. Never includes compliance data. */
const PROJECT_COLUMNS = `${PUBLIC_PROJECT_COLUMNS},feasibility_done,land_secured,aml_cleared,bo_disclosed,created_by,submitted_by,submitted_at,approved_by,returned_by,returned_at,returned_note,created_at`;

export const codeSchema = z
  .string()
  .trim()
  .min(2)
  .max(3)
  .transform((s) => s.toUpperCase());

/** Validates server-fn input and throws the first issue as a plain sentence, not a JSON dump. */
export function parseInput<S extends z.ZodTypeAny>(schema: S, d: unknown): z.output<S> {
  const r = schema.safeParse(d);
  if (r.success) return r.data;
  const issue = r.error.issues[0];
  const path = issue?.path?.length ? `${issue.path.join(".")}: ` : "";
  if (!issue) throw new Error("Invalid input.");
  // Our own messages are full sentences; zod's defaults ("Required") need the field name.
  throw new Error(/\.$/.test(issue.message) ? issue.message : `${path}${issue.message}`);
}

export type ProjectView = InvestmentProjectRow & {
  readiness: ReadinessCheck[];
  score: number;
};

/** A history entry with JSON-serialisable metadata. */
export type HistoryItem = Omit<HistoryEntry, "metadata"> & {
  metadata: { [key: string]: Json | undefined };
};

export type Capabilities = {
  approvePlans: boolean;
  approveInvestments: boolean;
  compliance: boolean;
};

function withReadiness(p: InvestmentProjectRow): ProjectView {
  const readiness = readinessChecks(p);
  return { ...p, readiness, score: readiness.filter((c) => c.ok).length };
}

export const listInvestments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => parseInput(z.object({ code: codeSchema }), d))
  .handler(async ({ data, context }) => {
    const c = db(context.supabase);
    const nowIso = new Date().toISOString();
    const [projects, links, interests, capabilities] = await Promise.all([
      c
        .from("investment_projects")
        .select(PROJECT_COLUMNS)
        .eq("country_code", data.code)
        .order("updated_at", { ascending: false }),
      c
        .from("investment_share_links")
        .select("id,project_id")
        .eq("country_code", data.code)
        .is("revoked_at", null)
        .gt("expires_at", nowIso),
      c
        .from("investor_interests")
        .select("id,project_id,stage")
        .eq("country_code", data.code)
        .not("stage", "in", "(closed_won,closed_lost)"),
      loadCapabilities(context.supabase, context.userId, data.code),
    ]);
    if (projects.error) throw governanceError(projects.error);

    const linkCount = new Map<string, number>();
    for (const l of (links.data ?? []) as Array<Pick<ShareLinkRow, "project_id">>) {
      linkCount.set(l.project_id, (linkCount.get(l.project_id) ?? 0) + 1);
    }
    const interestCount = new Map<string, number>();
    for (const i of (interests.data ?? []) as Array<Pick<InterestRow, "project_id">>) {
      interestCount.set(i.project_id, (interestCount.get(i.project_id) ?? 0) + 1);
    }

    const rows = ((projects.data ?? []) as unknown as InvestmentProjectRow[]).map((p) => ({
      ...withReadiness(p),
      activeLinks: linkCount.get(p.id) ?? 0,
      openInterests: interestCount.get(p.id) ?? 0,
    }));
    return { rows, capabilities, userId: context.userId };
  });

export const getInvestment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    parseInput(z.object({ code: codeSchema, id: z.string().uuid() }), d),
  )
  .handler(async ({ data, context }) => {
    const c = db(context.supabase);
    const { data: row, error } = await c
      .from("investment_projects")
      .select(PROJECT_COLUMNS)
      .eq("country_code", data.code)
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw governanceError(error);
    if (!row) throw new Error("This project does not exist or you do not have access to it.");
    const project = withReadiness(row as unknown as InvestmentProjectRow);
    const [history, capabilities] = await Promise.all([
      loadHistory(context.supabase, "investment_project", data.id)
        .then((h) => h as unknown as HistoryItem[])
        .catch(() => [] as HistoryItem[]),
      loadCapabilities(context.supabase, context.userId, data.code),
    ]);
    return {
      project,
      history,
      capabilities,
      userId: context.userId,
      viewerIsCreator: project.created_by === context.userId,
      viewerIsSubmitter: project.submitted_by === context.userId,
    };
  });

const nullableText = (max: number) =>
  z
    .string()
    .max(max)
    .nullable()
    .optional()
    .transform((v) => (v == null || v.trim() === "" ? null : v.trim()));

const contentSchema = z.object({
  title: z.string().trim().min(2, "Give the project a title of at least two characters.").max(200),
  sector: nullableText(100),
  structure: nullableText(100),
  stage: z.enum(STAGES),
  capex_usd: z
    .number()
    .finite()
    .nonnegative("Capital cost cannot be negative.")
    .nullable()
    .optional(),
  revenue_model: nullableText(2000),
  sponsor: nullableText(200),
  es_category: z.enum(ES_CATEGORIES).nullable().optional(),
  summary: nullableText(4000),
  risks: nullableText(4000),
  climate_alignment: nullableText(2000),
  feasibility_done: z.boolean().optional(),
  land_secured: z.boolean().optional(),
});

export type InvestmentContent = z.input<typeof contentSchema>;

export const saveInvestment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    parseInput(
      z.object({
        code: codeSchema,
        id: z.string().uuid().optional(),
        /** The version the editor opened; a mismatch means someone else saved first. */
        expectedVersion: z.number().int().positive().optional(),
        content: contentSchema,
      }),
      d,
    ),
  )
  .handler(async ({ data, context }) => {
    const c = db(context.supabase);
    // Content fields only. Governance columns, beneficial owners and AML are
    // set by the database and the compliance record, never from here.
    const content = {
      ...data.content,
      capex_usd: data.content.capex_usd ?? null,
      es_category: data.content.es_category ?? null,
    };

    if (!data.id) {
      const { data: row, error } = await c
        .from("investment_projects")
        .insert({ ...content, country_code: data.code })
        .select("id,approval_status,version")
        .single();
      if (error) throw governanceError(error);
      return {
        id: (row as { id: string }).id,
        reopened: false,
        version: 1,
        approval_status: "draft" as ApprovalStatus,
      };
    }

    const { data: before, error: e0 } = await c
      .from("investment_projects")
      .select("approval_status,version")
      .eq("id", data.id)
      .eq("country_code", data.code)
      .maybeSingle();
    if (e0) throw governanceError(e0);
    if (!before) throw new Error("This project does not exist or you do not have access to it.");
    const prev = before as { approval_status: ApprovalStatus; version: number };
    if (data.expectedVersion && prev.version !== data.expectedVersion) {
      throw new Error(
        "Someone else saved this project after you opened it. Reload to see their changes, then edit again.",
      );
    }

    let q = c
      .from("investment_projects")
      .update(content)
      .eq("id", data.id)
      .eq("country_code", data.code);
    if (data.expectedVersion) q = q.eq("version", data.expectedVersion);
    const { data: row, error } = await q.select("id,approval_status,version").maybeSingle();
    if (error) throw governanceError(error);
    if (!row)
      throw new Error(
        "Someone else saved this project after you opened it. Reload to see their changes, then edit again.",
      );
    const after = row as { id: string; approval_status: ApprovalStatus; version: number };
    return {
      id: after.id,
      version: after.version,
      approval_status: after.approval_status,
      reopened:
        (prev.approval_status === "approved" || prev.approval_status === "submitted") &&
        after.approval_status === "draft",
    };
  });

export const TRANSITIONS = ["submitted", "approved", "returned", "draft", "withdrawn"] as const;

export const transitionInvestment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    parseInput(
      z.object({
        code: codeSchema,
        id: z.string().uuid(),
        to: z.enum(TRANSITIONS),
        note: z.string().trim().max(2000).optional(),
      }),
      d,
    ),
  )
  .handler(async ({ data, context }) => {
    if (data.to === "returned" && !data.note) {
      throw new Error("Say what needs to change when returning a project.");
    }
    const patch: Record<string, unknown> = { approval_status: data.to };
    if (data.to === "returned") patch.returned_note = data.note;
    const { data: row, error } = await db(context.supabase)
      .from("investment_projects")
      .update(patch)
      .eq("id", data.id)
      .eq("country_code", data.code)
      .select("id,approval_status,version")
      .maybeSingle();
    if (error) throw governanceError(error);
    if (!row) throw new Error("This project does not exist or you do not have access to it.");
    return row as { id: string; approval_status: ApprovalStatus; version: number };
  });

export const deleteInvestment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    parseInput(z.object({ code: codeSchema, id: z.string().uuid() }), d),
  )
  .handler(async ({ data, context }) => {
    const c = db(context.supabase);
    const { data: row, error: e0 } = await c
      .from("investment_projects")
      .select("approval_status")
      .eq("id", data.id)
      .eq("country_code", data.code)
      .maybeSingle();
    if (e0) throw governanceError(e0);
    if (!row) throw new Error("This project does not exist or you do not have access to it.");
    const status = (row as { approval_status: ApprovalStatus }).approval_status;
    if (status === "submitted" || status === "approved") {
      throw new Error("An approved or submitted project cannot be deleted. Withdraw it first.");
    }
    const { error } = await c
      .from("investment_projects")
      .delete()
      .eq("id", data.id)
      .eq("country_code", data.code);
    if (error) throw governanceError(error);
    return { ok: true };
  });

/**
 * OC4IDS project package of approved projects only. Returns the package and
 * validation warnings; the UI shows the warnings before the user downloads.
 */
export const exportInvestmentsOc4ids = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => parseInput(z.object({ code: codeSchema }), d))
  .handler(async ({ data, context }) => {
    const c = db(context.supabase);
    const [{ data: rows, error }, { data: country }] = await Promise.all([
      c
        .from("investment_projects")
        .select("id,title,summary,sector,stage,capex_usd,es_category,climate_alignment,updated_at")
        .eq("country_code", data.code)
        .eq("approval_status", "approved")
        .order("title"),
      c.from("countries").select("name").eq("code", data.code).maybeSingle(),
    ]);
    if (error) throw governanceError(error);

    // Registered prefix, if an admin has set one: app setting "oc4ids_prefix.<cc>".
    let prefix = defaultOc4idsPrefix(data.code);
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: setting } = await supabaseAdmin
        .from("app_settings")
        .select("value")
        .eq("key", `oc4ids_prefix.${data.code.toLowerCase()}`)
        .maybeSingle();
      if (setting?.value && setting.value.trim()) prefix = setting.value.trim();
    } catch {
      // Fall back to the placeholder prefix; the validator flags it.
    }

    const countryName = (country as { name?: string } | null)?.name ?? data.code;
    const pkg = buildOc4idsPackage((rows ?? []) as Oc4idsSourceProject[], {
      countryCode: data.code,
      publisherName: `Government of ${countryName}`,
      prefix,
    });
    return { package: pkg, warnings: validateOc4idsPackage(pkg), prefix };
  });
