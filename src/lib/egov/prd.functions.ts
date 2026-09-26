// @domain egov
// @tables egov_prds,egov_prd_sections,egov_prd_citations,egov_prd_snapshots,countries
// @ui src/routes/_authenticated/admin/countries.$code.egov.tsx
//
// The Digital Government Studio's PRDs: list, create, read, edit a section,
// change status, check for out-of-date sections, export.
//
// Governance lives in the database (drizzle/migrations/0012 §3): the guard
// trigger enforces the status machine, the two-person rule and the approver
// role, reopens an edited PRD, and writes the history. These functions send
// either content or a status change — never both — and pass the database's
// message through governanceError. Drafting is in draft.functions.ts.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { codeSchema, parseInput } from "@/lib/investments/pipeline.functions";
import { db, governanceError, loadHistory, type HistoryEntry } from "@/lib/syndication/db";

import { buildBrandTokens, type BrandTokens } from "./brand";
import {
  brandOf,
  type CitationRow,
  type PrdRow,
  type PrdScope,
  type PrdStatus,
  type SectionRow,
  type SectionStatus,
} from "./db";
import { prdToMarkdown } from "./markdown";
import { AUDIENCE_OPTIONS, EGOV_STAGES, PRIORITY_OPTIONS } from "./stages";

export type { BrandTokens } from "./brand";
export type {
  PrdRow,
  PrdScope,
  PrdStatus,
  SectionRow,
  SectionStatus,
  CitationRow,
  ContextLine,
} from "./db";

const PRD_COLS =
  "id,country_code,version,title,status,scope,brand,model,created_by,submitted_by,submitted_at,approved_by,approved_at,approval_mode,returned_by,returned_at,returned_note,created_at,updated_at";
const SECTION_COLS =
  "id,prd_id,country_code,stage_key,ordinal,heading,body_md,status,context_hash,context,model,authored_at,edited_by,edited_at,created_at";

export type Capabilities = {
  approve: boolean;
  isAdmin: boolean;
  /** Global admin with no other approver bound to the country: may approve own submission. */
  soleApprove: boolean;
};

async function loadCaps(
  sb: Parameters<typeof db>[0],
  userId: string,
  code: string,
): Promise<Capabilities> {
  const c = db(sb);
  const [a, b, s] = await Promise.all([
    c.rpc("can_approve_egov", { _user_id: userId, _country_code: code }),
    c.rpc("has_role", { _user_id: userId, _role: "admin" }),
    c.rpc("can_sole_approve_egov", { _user_id: userId, _country_code: code }),
  ]);
  return { approve: !!a.data, isAdmin: !!b.data, soleApprove: !!s.data };
}

// ------------------------------------------------------------------ list

export interface PrdSummary {
  id: string;
  version: number;
  title: string;
  status: PrdStatus;
  platform_name: string;
  created_at: string;
  updated_at: string;
  approved_at: string | null;
  submitted_by: string | null;
  drafted: number;
  total: number;
  stale: number;
  gaps: number;
}

export const listPrds = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => parseInput(z.object({ code: codeSchema }), d))
  .handler(async ({ data, context }) => {
    const c = db(context.supabase);
    const [{ data: rows, error }, { data: sections }, caps, { data: country }] = await Promise.all([
      c
        .from("egov_prds")
        .select(PRD_COLS)
        .eq("country_code", data.code)
        .order("version", { ascending: false }),
      c.from("egov_prd_sections").select("prd_id,status").eq("country_code", data.code),
      loadCaps(context.supabase, context.userId, data.code),
      c.from("countries").select("name").eq("code", data.code).maybeSingle(),
    ]);
    if (error) throw governanceError(error);
    const secs = (sections ?? []) as Array<{ prd_id: string; status: SectionStatus }>;
    const prds: PrdSummary[] = ((rows ?? []) as PrdRow[]).map((p) => {
      const mine = secs.filter((s) => s.prd_id === p.id);
      return {
        id: p.id,
        version: p.version,
        title: p.title,
        status: p.status,
        platform_name: p.scope?.platform_name ?? "",
        created_at: p.created_at,
        updated_at: p.updated_at,
        approved_at: p.approved_at,
        submitted_by: p.submitted_by,
        drafted: mine.filter((s) => s.status !== "pending").length,
        total: EGOV_STAGES.length,
        stale: mine.filter((s) => s.status === "stale").length,
        gaps: mine.filter((s) => s.status === "gap").length,
      };
    });
    return {
      prds,
      capabilities: caps,
      userId: context.userId,
      countryName: ((country as { name?: string } | null)?.name ?? data.code).trim(),
      aiAvailable: !!process.env.LOVABLE_API_KEY,
    };
  });

// ------------------------------------------------------------------ create

const ScopeInput = z.object({
  platform_name: z.string().trim().max(120),
  audiences: z.array(z.enum(AUDIENCE_OPTIONS.map((a) => a.key) as [string, ...string[]])).max(6),
  priorities: z.array(z.enum(PRIORITY_OPTIONS.map((a) => a.key) as [string, ...string[]])).max(4),
  hosting: z.string().trim().max(200),
  notes: z.string().trim().max(4000),
});

export const createPrd = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    parseInput(
      z.object({ code: codeSchema, title: z.string().trim().min(3).max(160), scope: ScopeInput }),
      d,
    ),
  )
  .handler(async ({ data, context }): Promise<{ id: string; version: number }> => {
    const c = db(context.supabase);
    const brand = buildBrandTokens(data.code);
    const { data: row, error } = await c
      .from("egov_prds")
      .insert({
        country_code: data.code,
        title: data.title,
        scope: data.scope,
        brand,
        status: "draft",
      })
      .select("id,version")
      .single();
    if (error) throw governanceError(error);
    const prd = row as { id: string; version: number };
    const { error: sErr } = await c.from("egov_prd_sections").insert(
      EGOV_STAGES.map((s) => ({
        prd_id: prd.id,
        country_code: data.code,
        stage_key: s.key,
        ordinal: s.ordinal,
        heading: s.heading,
        body_md: "",
        status: "pending",
      })),
    );
    if (sErr) throw governanceError(sErr);
    return prd;
  });

// ------------------------------------------------------------------ read one

export type HistoryItem = {
  id: string;
  action: string;
  actorLabel: string | null;
  from: string | null;
  to: string | null;
  note: string | null;
  section: string | null;
  mode: string | null;
  at: string;
};

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

export interface PrdDetail {
  prd: PrdRow;
  brand: BrandTokens;
  sections: SectionRow[];
  citations: CitationRow[];
  history: HistoryItem[];
  capabilities: Capabilities;
  userId: string;
  countryName: string;
  aiAvailable: boolean;
}

export const getPrd = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    parseInput(z.object({ code: codeSchema, prdId: z.string().uuid() }), d),
  )
  .handler(async ({ data, context }): Promise<PrdDetail> => {
    const c = db(context.supabase);
    const { data: row, error } = await c
      .from("egov_prds")
      .select(PRD_COLS)
      .eq("id", data.prdId)
      .eq("country_code", data.code)
      .maybeSingle();
    if (error) throw governanceError(error);
    if (!row) throw new Error("That PRD was not found, or you don't have access to it.");
    const prd = row as PrdRow;
    const [{ data: sections, error: sErr }, history, caps, { data: country }] = await Promise.all([
      c.from("egov_prd_sections").select(SECTION_COLS).eq("prd_id", prd.id).order("ordinal"),
      loadHistory(context.supabase, "egov_prd", prd.id),
      loadCaps(context.supabase, context.userId, data.code),
      c.from("countries").select("name").eq("code", data.code).maybeSingle(),
    ]);
    if (sErr) throw governanceError(sErr);
    const secs = (sections ?? []) as SectionRow[];
    const { data: citations } = secs.length
      ? await c
          .from("egov_prd_citations")
          .select("*")
          .in(
            "section_id",
            secs.map((s) => s.id),
          )
          .order("created_at")
      : { data: [] as unknown[] };
    const brand = brandOf(prd.brand) ?? buildBrandTokens(data.code);
    return {
      prd,
      brand,
      sections: secs,
      citations: (citations ?? []) as CitationRow[],
      history: history.map(toHistoryItem),
      capabilities: caps,
      userId: context.userId,
      countryName: ((country as { name?: string } | null)?.name ?? data.code).trim(),
      aiAvailable: !!process.env.LOVABLE_API_KEY,
    };
  });

// ------------------------------------------------------------------ edit a section

export const saveSection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    parseInput(
      z.object({ code: codeSchema, sectionId: z.string().uuid(), body: z.string().max(40000) }),
      d,
    ),
  )
  .handler(async ({ data, context }): Promise<{ id: string; status: SectionStatus }> => {
    const { data: row, error } = await db(context.supabase)
      .from("egov_prd_sections")
      .update({ body_md: data.body })
      .eq("id", data.sectionId)
      .eq("country_code", data.code)
      .select("id,status")
      .maybeSingle();
    if (error) throw governanceError(error);
    if (!row)
      throw new Error("That section was not found, or you don't have permission to change it.");
    return row as { id: string; status: SectionStatus };
  });

/** Title, scope or brand. Editing a submitted or approved PRD reopens it — the database does that. */
export const savePrdScope = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    parseInput(
      z.object({
        code: codeSchema,
        prdId: z.string().uuid(),
        title: z.string().trim().min(3).max(160),
        scope: ScopeInput,
      }),
      d,
    ),
  )
  .handler(async ({ data, context }): Promise<{ id: string; status: PrdStatus }> => {
    const { data: row, error } = await db(context.supabase)
      .from("egov_prds")
      .update({ title: data.title, scope: data.scope })
      .eq("id", data.prdId)
      .eq("country_code", data.code)
      .select("id,status")
      .maybeSingle();
    if (error) throw governanceError(error);
    if (!row) throw new Error("That PRD was not found, or you don't have permission to change it.");
    return row as { id: string; status: PrdStatus };
  });

// ------------------------------------------------------------------ status

export const transitionPrd = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    parseInput(
      z
        .object({
          code: codeSchema,
          prdId: z.string().uuid(),
          to: z.enum(["submitted", "approved", "returned", "draft"]),
          note: z.string().trim().max(2000).optional(),
        })
        .refine((v) => v.to !== "returned" || !!v.note, {
          message: "Say what needs to change when returning a PRD.",
        }),
      d,
    ),
  )
  .handler(async ({ data, context }): Promise<{ id: string; status: PrdStatus }> => {
    const patch: Record<string, unknown> = { status: data.to };
    if (data.to === "returned") patch.returned_note = data.note;
    const { data: row, error } = await db(context.supabase)
      .from("egov_prds")
      .update(patch)
      .eq("id", data.prdId)
      .eq("country_code", data.code)
      .select("id,status")
      .maybeSingle();
    if (error) throw governanceError(error);
    if (!row) throw new Error("That PRD was not found, or you don't have access to it.");
    return row as { id: string; status: PrdStatus };
  });

export const deletePrd = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    parseInput(z.object({ code: codeSchema, prdId: z.string().uuid() }), d),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { data: rows, error } = await db(context.supabase)
      .from("egov_prds")
      .delete()
      .eq("id", data.prdId)
      .eq("country_code", data.code)
      .select("id");
    if (error) throw governanceError(error);
    if (!rows || rows.length === 0)
      throw new Error("That PRD was not found, or you don't have access to it.");
    return { ok: true };
  });

// ------------------------------------------------------------------ staleness

/**
 * Recomputes every section's context pack and marks those whose corpus lines
 * changed as out of date. Takes a snapshot first so the diff can be shown.
 */
export const checkStale = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    parseInput(z.object({ code: codeSchema, prdId: z.string().uuid() }), d),
  )
  .handler(async ({ data, context }): Promise<{ stale: string[] }> => {
    const c = db(context.supabase);
    const { data: prdRow, error } = await c
      .from("egov_prds")
      .select("id,scope,brand")
      .eq("id", data.prdId)
      .eq("country_code", data.code)
      .maybeSingle();
    if (error) throw governanceError(error);
    if (!prdRow) throw new Error("That PRD was not found.");
    const prd = prdRow as { id: string; scope: PrdScope; brand: BrandTokens };
    const { data: sections } = await c
      .from("egov_prd_sections")
      .select("id,stage_key,status,context_hash")
      .eq("prd_id", prd.id);
    const { buildContextPack } = await import("./context.server");
    const stale: string[] = [];
    for (const s of (sections ?? []) as Array<
      Pick<SectionRow, "id" | "stage_key" | "status" | "context_hash">
    >) {
      if (s.status === "pending" || !s.context_hash) continue;
      const pack = await buildContextPack(
        context.supabase,
        data.code,
        s.stage_key,
        prd.scope,
        prd.brand,
      );
      if (pack.hash !== s.context_hash) {
        stale.push(s.stage_key);
        await c.from("egov_prd_sections").update({ status: "stale" }).eq("id", s.id);
      }
    }
    return { stale };
  });

// ------------------------------------------------------------------ export

export const exportPrdMarkdown = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    parseInput(z.object({ code: codeSchema, prdId: z.string().uuid() }), d),
  )
  .handler(async ({ data, context }): Promise<{ filename: string; markdown: string }> => {
    const c = db(context.supabase);
    const [{ data: row, error }, { data: sections }, { data: country }] = await Promise.all([
      c
        .from("egov_prds")
        .select(PRD_COLS)
        .eq("id", data.prdId)
        .eq("country_code", data.code)
        .maybeSingle(),
      c.from("egov_prd_sections").select(SECTION_COLS).eq("prd_id", data.prdId).order("ordinal"),
      c.from("countries").select("name").eq("code", data.code).maybeSingle(),
    ]);
    if (error) throw governanceError(error);
    if (!row) throw new Error("That PRD was not found.");
    const prd = row as PrdRow;
    const brand = brandOf(prd.brand);
    const markdown = prdToMarkdown(
      prd,
      ((country as { name?: string } | null)?.name ?? data.code).trim(),
      (sections ?? []) as SectionRow[],
      brand,
    );
    return { filename: `prd-${data.code.toLowerCase()}-v${prd.version}.md`, markdown };
  });
