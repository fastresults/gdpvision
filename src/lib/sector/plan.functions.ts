// @domain sector
// @tables sectors,country_sectors,sector_shortlists,sector_priorities,sector_plans,sector_plan_sections,sector_plan_citations,sector_plan_snapshots,ministries,countries,commitments
// @ui src/routes/_authenticated/admin/countries.$code.sector.tsx
//
// The Sector Studio (chamber 10): the studio home (sectors, the Scout's
// shortlist, the Head of Government's priorities, plans), priority choice,
// and a plan's lifecycle — create, read, edit a section, change status,
// check for out-of-date sections, export.
//
// Governance lives in the database (drizzle/migrations/0018): the guards cap
// priorities at four, require a priority before a plan, enforce the status
// machine and the two-person rule (with the sole-admin exception), reopen an
// edited plan, raise a Cabinet commitment on approval, and write the
// history. Drafting is in draft.functions.ts; the Scout in scout.functions.ts.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Capabilities, HistoryItem } from "@/lib/egov/prd.functions";
import { codeSchema, parseInput } from "@/lib/investments/pipeline.functions";
import {
  db,
  governanceError,
  loadHistory,
  type AnyClient,
  type HistoryEntry,
} from "@/lib/syndication/db";

import { auditSection } from "./audit";
import {
  scopeOf,
  type PlanCitationRow,
  type PlanRow,
  type PlanSectionRow,
  type PlanStatus,
  type PriorityRow,
  type SectionStatus,
  type ShortlistRow,
} from "./db";
import { planToMarkdown } from "./markdown";
import { HORIZON_OPTIONS, SECTOR_STAGES, type SectorStage } from "./stages";

export type { Capabilities, HistoryItem };

const PLAN_COLS =
  "id,country_code,sector_code,version,title,status,scope,model,created_by,submitted_by,submitted_at,approved_by,approved_at,approval_mode,returned_by,returned_at,returned_note,commitment_id,created_at,updated_at";
const SECTION_COLS =
  "id,plan_id,country_code,stage_key,ordinal,heading,body_md,status,context_hash,context,audit,model,authored_at,edited_by,edited_at,created_at";

async function loadCaps(sb: AnyClient, userId: string, code: string): Promise<Capabilities> {
  const c = db(sb);
  const [a, b, s] = await Promise.all([
    c.rpc("can_approve_sector", { _user_id: userId, _country_code: code }),
    c.rpc("has_role", { _user_id: userId, _role: "admin" }),
    c.rpc("can_sole_approve_sector", { _user_id: userId, _country_code: code }),
  ]);
  return { approve: !!a.data, isAdmin: !!b.data, soleApprove: !!s.data };
}

async function countryName(sb: AnyClient, code: string): Promise<string> {
  const { data } = await db(sb).from("countries").select("name").eq("code", code).maybeSingle();
  return ((data as { name?: string } | null)?.name ?? code).trim();
}

function toHistoryItem(h: HistoryEntry): HistoryItem {
  const m = h.metadata ?? {};
  const str = (v: unknown) => (typeof v === "string" && v ? v : null);
  return {
    id: h.id,
    action: h.action,
    actorLabel: h.actor_label,
    from: str(m.from),
    to: str(m.to),
    note: str(m.note),
    section: str(m.section),
    mode: str(m.mode),
    at: h.created_at,
  };
}

// ------------------------------------------------------------------ studio home

export interface SectorSummary {
  code: string;
  label: string;
  share_pct: number | null;
  shortlist: ShortlistRow | null;
  priority: PriorityRow | null;
}

export interface PlanSummary {
  id: string;
  sector_code: string;
  version: number;
  title: string;
  status: PlanStatus;
  approved_at: string | null;
  approval_mode: PlanRow["approval_mode"];
  commitment_id: string | null;
  updated_at: string;
  drafted: number;
  total: number;
  stale: number;
  gaps: number;
  findings: number;
}

export interface StudioData {
  countryName: string;
  sectors: SectorSummary[];
  plans: PlanSummary[];
  ministries: string[];
  capabilities: Capabilities;
  userId: string;
  aiAvailable: boolean;
  scoutedAt: string | null;
  scoutModel: string | null;
}

export const getSectorStudio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => parseInput(z.object({ code: codeSchema }), d))
  .handler(async ({ data, context }): Promise<StudioData> => {
    const c = db(context.supabase);
    const [
      { data: sectors, error },
      { data: shares },
      { data: shortlist },
      { data: priorities },
      { data: plans },
      { data: sections },
      { data: ministries },
      caps,
      name,
    ] = await Promise.all([
      c.from("sectors").select("code,label,sort_order").order("sort_order"),
      c.from("country_sectors").select("sector_code,share_pct").eq("country_code", data.code),
      c.from("sector_shortlists").select("*").eq("country_code", data.code),
      c.from("sector_priorities").select("*").eq("country_code", data.code),
      c
        .from("sector_plans")
        .select(PLAN_COLS)
        .eq("country_code", data.code)
        .order("version", { ascending: false }),
      c.from("sector_plan_sections").select("plan_id,status,audit").eq("country_code", data.code),
      c.from("ministries").select("name").eq("country_code", data.code).order("sort_order"),
      loadCaps(context.supabase, context.userId, data.code),
      countryName(context.supabase, data.code),
    ]);
    if (error) throw governanceError(error);
    const shareBy = new Map(
      ((shares ?? []) as Array<{ sector_code: string; share_pct: number }>).map((s) => [
        s.sector_code,
        s.share_pct,
      ]),
    );
    const sl = (shortlist ?? []) as ShortlistRow[];
    const pr = (priorities ?? []) as PriorityRow[];
    const secs = (sections ?? []) as Array<{
      plan_id: string;
      status: SectionStatus;
      audit: unknown[];
    }>;
    const latest = sl.reduce<ShortlistRow | null>(
      (a, b) => (!a || b.generated_at > a.generated_at ? b : a),
      null,
    );
    return {
      countryName: name,
      sectors: ((sectors ?? []) as Array<{ code: string; label: string }>).map((s) => ({
        code: s.code,
        label: s.label,
        share_pct: shareBy.has(s.code) ? Number(shareBy.get(s.code)) : null,
        shortlist: sl.find((x) => x.sector_code === s.code) ?? null,
        priority: pr.find((x) => x.sector_code === s.code) ?? null,
      })),
      plans: ((plans ?? []) as PlanRow[]).map((p) => {
        const mine = secs.filter((s) => s.plan_id === p.id);
        return {
          id: p.id,
          sector_code: p.sector_code,
          version: p.version,
          title: p.title,
          status: p.status,
          approved_at: p.approved_at,
          approval_mode: p.approval_mode,
          commitment_id: p.commitment_id,
          updated_at: p.updated_at,
          drafted: mine.filter((s) => s.status !== "pending").length,
          total: SECTOR_STAGES.length,
          stale: mine.filter((s) => s.status === "stale").length,
          gaps: mine.filter((s) => s.status === "gap").length,
          findings: mine.reduce((n, s) => n + (Array.isArray(s.audit) ? s.audit.length : 0), 0),
        };
      }),
      ministries: ((ministries ?? []) as Array<{ name: string }>).map((m) => m.name),
      capabilities: caps,
      userId: context.userId,
      aiAvailable: !!process.env.LOVABLE_API_KEY,
      scoutedAt: latest?.generated_at ?? null,
      scoutModel: latest?.model ?? null,
    };
  });

// ------------------------------------------------------------------ priorities

export const setSectorPriority = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    parseInput(
      z.discriminatedUnion("action", [
        z.object({
          action: z.literal("choose"),
          code: codeSchema,
          sector: z.string().trim().min(1).max(64),
          rationale: z.string().trim().min(10, "Say why this sector is a priority.").max(2000),
          exitRule: z.string().trim().max(1000).default(""),
        }),
        z.object({
          action: z.literal("retire"),
          code: codeSchema,
          sector: z.string().trim().min(1).max(64),
          note: z.string().trim().min(10, "Say why this sector is being retired.").max(2000),
        }),
      ]),
      d,
    ),
  )
  .handler(async ({ data, context }): Promise<{ status: "priority" | "retired" }> => {
    const c = db(context.supabase);
    const { data: existing } = await c
      .from("sector_priorities")
      .select("id,status")
      .eq("country_code", data.code)
      .eq("sector_code", data.sector)
      .maybeSingle();
    const row = existing as { id: string; status: string } | null;
    if (data.action === "choose") {
      const patch = { status: "priority", rationale: data.rationale, exit_rule: data.exitRule };
      const q = row
        ? c.from("sector_priorities").update(patch).eq("id", row.id)
        : c
            .from("sector_priorities")
            .insert({ country_code: data.code, sector_code: data.sector, ...patch });
      const { error } = await q;
      if (error) throw governanceError(error);
      return { status: "priority" };
    }
    if (!row || row.status !== "priority")
      throw new Error("That sector is not a current priority.");
    const { error } = await c
      .from("sector_priorities")
      .update({ status: "retired", retired_note: data.note })
      .eq("id", row.id);
    if (error) throw governanceError(error);
    return { status: "retired" };
  });

// ------------------------------------------------------------------ create

const ScopeInput = z.object({
  lead_ministry: z.string().trim().max(160),
  horizon_years: z
    .number()
    .int()
    .refine((n) => (HORIZON_OPTIONS as readonly number[]).includes(n), {
      message: "Choose a horizon of 3, 5 or 10 years.",
    }),
  ambition: z.string().trim().max(2000),
  notes: z.string().trim().max(4000),
});

export const createPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    parseInput(
      z.object({
        code: codeSchema,
        sector: z.string().trim().min(1).max(64),
        title: z.string().trim().min(3).max(160),
        scope: ScopeInput,
      }),
      d,
    ),
  )
  .handler(async ({ data, context }): Promise<{ id: string; version: number }> => {
    const c = db(context.supabase);
    const { data: row, error } = await c
      .from("sector_plans")
      .insert({
        country_code: data.code,
        sector_code: data.sector,
        title: data.title,
        scope: data.scope,
        status: "draft",
      })
      .select("id,version")
      .single();
    if (error) throw governanceError(error);
    const plan = row as { id: string; version: number };
    const { error: sErr } = await c.from("sector_plan_sections").insert(
      SECTOR_STAGES.map((s) => ({
        plan_id: plan.id,
        country_code: data.code,
        stage_key: s.key,
        ordinal: s.ordinal,
        heading: s.heading,
        body_md: "",
        status: "pending",
      })),
    );
    if (sErr) throw governanceError(sErr);
    return plan;
  });

// ------------------------------------------------------------------ read one

export interface PlanDetail {
  plan: PlanRow;
  sectorLabel: string;
  sections: PlanSectionRow[];
  citations: PlanCitationRow[];
  history: HistoryItem[];
  capabilities: Capabilities;
  userId: string;
  countryName: string;
  aiAvailable: boolean;
  commitment: { id: string; title: string; status: string; due_at: string | null } | null;
}

export const getPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    parseInput(z.object({ code: codeSchema, planId: z.string().uuid() }), d),
  )
  .handler(async ({ data, context }): Promise<PlanDetail> => {
    const c = db(context.supabase);
    const { data: row, error } = await c
      .from("sector_plans")
      .select(PLAN_COLS)
      .eq("id", data.planId)
      .eq("country_code", data.code)
      .maybeSingle();
    if (error) throw governanceError(error);
    if (!row) throw new Error("That plan was not found, or you don't have access to it.");
    const plan = { ...(row as PlanRow), scope: scopeOf((row as PlanRow).scope) };
    const [
      { data: sections, error: sErr },
      history,
      caps,
      name,
      { data: sector },
      { data: commitment },
    ] = await Promise.all([
      c.from("sector_plan_sections").select(SECTION_COLS).eq("plan_id", plan.id).order("ordinal"),
      loadHistory(context.supabase, "sector_plan", plan.id),
      loadCaps(context.supabase, context.userId, data.code),
      countryName(context.supabase, data.code),
      c.from("sectors").select("label").eq("code", plan.sector_code).maybeSingle(),
      plan.commitment_id
        ? c
            .from("commitments")
            .select("id,title,status,due_at")
            .eq("id", plan.commitment_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    if (sErr) throw governanceError(sErr);
    const secs = ((sections ?? []) as PlanSectionRow[]).map((s) => ({
      ...s,
      audit: Array.isArray(s.audit) ? s.audit : [],
      context: Array.isArray(s.context) ? s.context : [],
    }));
    const { data: citations } = secs.length
      ? await c
          .from("sector_plan_citations")
          .select("*")
          .in(
            "section_id",
            secs.map((s) => s.id),
          )
          .order("created_at")
      : { data: [] as unknown[] };
    return {
      plan,
      sectorLabel: ((sector as { label?: string } | null)?.label ?? plan.sector_code).trim(),
      sections: secs,
      citations: (citations ?? []) as PlanCitationRow[],
      history: history.map(toHistoryItem),
      capabilities: caps,
      userId: context.userId,
      countryName: name,
      aiAvailable: !!process.env.LOVABLE_API_KEY,
      commitment: (commitment as PlanDetail["commitment"]) ?? null,
    };
  });

// ------------------------------------------------------------------ edit

export const savePlanSection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    parseInput(
      z.object({ code: codeSchema, sectionId: z.string().uuid(), body: z.string().max(40000) }),
      d,
    ),
  )
  .handler(async ({ data, context }): Promise<{ id: string; status: SectionStatus }> => {
    const c = db(context.supabase);
    const { data: cur } = await c
      .from("sector_plan_sections")
      .select("id,plan_id,stage_key")
      .eq("id", data.sectionId)
      .eq("country_code", data.code)
      .maybeSingle();
    if (!cur)
      throw new Error("That section was not found, or you don't have permission to change it.");
    const sec = cur as { id: string; plan_id: string; stage_key: SectorStage };
    const [{ count }, { data: siblings }] = await Promise.all([
      c
        .from("sector_plan_citations")
        .select("id", { count: "exact", head: true })
        .eq("section_id", sec.id),
      c.from("sector_plan_sections").select("stage_key,body_md").eq("plan_id", sec.plan_id),
    ]);
    const others = Object.fromEntries(
      ((siblings ?? []) as Array<{ stage_key: string; body_md: string }>).map((s) => [
        s.stage_key,
        s.body_md,
      ]),
    ) as Partial<Record<SectorStage, string>>;
    const audit = auditSection(sec.stage_key, data.body, count ?? 0, others);
    const { data: row, error } = await c
      .from("sector_plan_sections")
      .update({ body_md: data.body, audit })
      .eq("id", data.sectionId)
      .eq("country_code", data.code)
      .select("id,status")
      .maybeSingle();
    if (error) throw governanceError(error);
    if (!row)
      throw new Error("That section was not found, or you don't have permission to change it.");
    return row as { id: string; status: SectionStatus };
  });

export const savePlanScope = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    parseInput(
      z.object({
        code: codeSchema,
        planId: z.string().uuid(),
        title: z.string().trim().min(3).max(160),
        scope: ScopeInput,
      }),
      d,
    ),
  )
  .handler(async ({ data, context }): Promise<{ id: string; status: PlanStatus }> => {
    const { data: row, error } = await db(context.supabase)
      .from("sector_plans")
      .update({ title: data.title, scope: data.scope })
      .eq("id", data.planId)
      .eq("country_code", data.code)
      .select("id,status")
      .maybeSingle();
    if (error) throw governanceError(error);
    if (!row)
      throw new Error("That plan was not found, or you don't have permission to change it.");
    return row as { id: string; status: PlanStatus };
  });

// ------------------------------------------------------------------ status

export const transitionPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    parseInput(
      z
        .object({
          code: codeSchema,
          planId: z.string().uuid(),
          to: z.enum(["submitted", "approved", "returned", "draft"]),
          note: z.string().trim().max(2000).optional(),
        })
        .refine((v) => v.to !== "returned" || !!v.note, {
          message: "Say what needs to change when returning a plan.",
        }),
      d,
    ),
  )
  .handler(async ({ data, context }): Promise<{ id: string; status: PlanStatus }> => {
    const patch: Record<string, unknown> = { status: data.to };
    if (data.to === "returned") patch.returned_note = data.note;
    const { data: row, error } = await db(context.supabase)
      .from("sector_plans")
      .update(patch)
      .eq("id", data.planId)
      .eq("country_code", data.code)
      .select("id,status")
      .maybeSingle();
    if (error) throw governanceError(error);
    if (!row) throw new Error("That plan was not found, or you don't have access to it.");
    return row as { id: string; status: PlanStatus };
  });

export const deletePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    parseInput(z.object({ code: codeSchema, planId: z.string().uuid() }), d),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { data: rows, error } = await db(context.supabase)
      .from("sector_plans")
      .delete()
      .eq("id", data.planId)
      .eq("country_code", data.code)
      .select("id");
    if (error) throw governanceError(error);
    if (!rows || rows.length === 0)
      throw new Error("That plan was not found, or you don't have access to it.");
    return { ok: true };
  });

// ------------------------------------------------------------------ staleness

export const checkPlanStale = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    parseInput(z.object({ code: codeSchema, planId: z.string().uuid() }), d),
  )
  .handler(async ({ data, context }): Promise<{ stale: string[] }> => {
    const c = db(context.supabase);
    const { data: planRow, error } = await c
      .from("sector_plans")
      .select("id,scope,sector_code")
      .eq("id", data.planId)
      .eq("country_code", data.code)
      .maybeSingle();
    if (error) throw governanceError(error);
    if (!planRow) throw new Error("That plan was not found.");
    const plan = planRow as { id: string; scope: unknown; sector_code: string };
    const scope = scopeOf(plan.scope);
    const { data: sections } = await c
      .from("sector_plan_sections")
      .select("id,stage_key,status,context_hash")
      .eq("plan_id", plan.id);
    const { buildSectorPack } = await import("./context.server");
    const stale: string[] = [];
    for (const s of (sections ?? []) as Array<
      Pick<PlanSectionRow, "id" | "stage_key" | "status" | "context_hash">
    >) {
      if (s.status === "pending" || !s.context_hash) continue;
      const pack = await buildSectorPack(
        context.supabase,
        data.code,
        plan.sector_code,
        s.stage_key,
        scope,
      );
      if (pack.hash !== s.context_hash) {
        stale.push(s.stage_key);
        await c.from("sector_plan_sections").update({ status: "stale" }).eq("id", s.id);
      }
    }
    return { stale };
  });

// ------------------------------------------------------------------ export

export const exportPlanMarkdown = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    parseInput(z.object({ code: codeSchema, planId: z.string().uuid() }), d),
  )
  .handler(async ({ data, context }): Promise<{ filename: string; markdown: string }> => {
    const c = db(context.supabase);
    const [{ data: row, error }, { data: sections }, name] = await Promise.all([
      c
        .from("sector_plans")
        .select(PLAN_COLS)
        .eq("id", data.planId)
        .eq("country_code", data.code)
        .maybeSingle(),
      c
        .from("sector_plan_sections")
        .select(SECTION_COLS)
        .eq("plan_id", data.planId)
        .order("ordinal"),
      countryName(context.supabase, data.code),
    ]);
    if (error) throw governanceError(error);
    if (!row) throw new Error("That plan was not found.");
    const plan = { ...(row as PlanRow), scope: scopeOf((row as PlanRow).scope) };
    const { data: sector } = await c
      .from("sectors")
      .select("label")
      .eq("code", plan.sector_code)
      .maybeSingle();
    const markdown = planToMarkdown(
      plan,
      name,
      ((sector as { label?: string } | null)?.label ?? plan.sector_code).trim(),
      (sections ?? []) as PlanSectionRow[],
    );
    return {
      filename: `sector-plan-${data.code.toLowerCase()}-${plan.sector_code}-v${plan.version}.md`,
      markdown,
    };
  });
