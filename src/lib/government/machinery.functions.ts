// @domain government
// @tables government_offices,statutory_bodies,ministries,sectors,countries
// @ui src/routes/_authenticated/admin/countries.$code.government.tsx
//
// The machinery-of-government record: read it, edit a row, verify it and
// make it public. The database (drizzle/migrations/0022) decides who may
// write (global admin or a PRD approver for the country), refuses a public
// row that is not verified, and sends an edited verified row back to draft.
// Research and back-fill are in research.functions.ts.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { codeSchema, parseInput } from "@/lib/investments/pipeline.functions";
import { db, governanceError } from "@/lib/syndication/db";

import {
  BODY_KINDS,
  OFFICE_KEYS,
  OFFICE_PRECEDENCE,
  slugify,
  type BodyRow,
  type OfficeRow,
} from "./db";

export interface GovernmentAdmin {
  countryName: string;
  offices: OfficeRow[];
  bodies: BodyRow[];
  ministries: Array<{ slug: string; name: string }>;
  sectors: Array<{ code: string; label: string }>;
  canEdit: boolean;
  researchAvailable: boolean;
}

export const getGovernment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => parseInput(z.object({ code: codeSchema }), d))
  .handler(async ({ data, context }): Promise<GovernmentAdmin> => {
    const c = db(context.supabase);
    const [offices, bodies, ministries, sectors, country, admin, approver] = await Promise.all([
      c.from("government_offices").select("*").eq("country_code", data.code).order("precedence"),
      c.from("statutory_bodies").select("*").eq("country_code", data.code).order("name"),
      c.from("ministries").select("slug,name").eq("country_code", data.code).order("sort_order"),
      c.from("sectors").select("code,label").order("sort_order"),
      c.from("countries").select("name").eq("code", data.code).maybeSingle(),
      c.rpc("has_role", { _user_id: context.userId, _role: "admin" }),
      c.rpc("can_approve_egov", { _user_id: context.userId, _country_code: data.code }),
    ]);
    if (offices.error) throw governanceError(offices.error);
    if (bodies.error) throw governanceError(bodies.error);
    return {
      countryName: ((country.data as { name?: string } | null)?.name ?? data.code).trim(),
      offices: (offices.data ?? []) as OfficeRow[],
      bodies: (bodies.data ?? []) as BodyRow[],
      ministries: (ministries.data ?? []) as Array<{ slug: string; name: string }>,
      sectors: (sectors.data ?? []) as Array<{ code: string; label: string }>,
      canEdit: !!admin.data || !!approver.data,
      researchAvailable: !!process.env.PERPLEXITY_API_KEY || !!process.env.LOVABLE_API_KEY,
    };
  });

// ------------------------------------------------------------------ review

const Table = z.enum(["office", "body"]);
const tableName = (t: z.infer<typeof Table>) =>
  t === "office" ? "government_offices" : "statutory_bodies";

/** Verify, publish, unpublish or retire one row, or a batch of rows. */
export const setMachineryStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    parseInput(
      z.object({
        code: codeSchema,
        table: Table,
        ids: z.array(z.string().uuid()).min(1).max(200),
        action: z.enum(["verify", "publish", "unpublish", "retire", "reopen"]),
      }),
      d,
    ),
  )
  .handler(async ({ data, context }): Promise<{ updated: number }> => {
    const patch =
      data.action === "verify"
        ? { status: "verified" }
        : data.action === "publish"
          ? { status: "verified", visibility: "public" }
          : data.action === "unpublish"
            ? { visibility: "private" }
            : data.action === "retire"
              ? { status: "retired", visibility: "private" }
              : { status: "draft", visibility: "private" };
    const { data: rows, error } = await db(context.supabase)
      .from(tableName(data.table))
      .update(patch)
      .in("id", data.ids)
      .eq("country_code", data.code)
      .select("id");
    if (error) throw governanceError(error);
    return { updated: (rows ?? []).length };
  });

export const deleteMachineryRow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    parseInput(z.object({ code: codeSchema, table: Table, id: z.string().uuid() }), d),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { data: rows, error } = await db(context.supabase)
      .from(tableName(data.table))
      .delete()
      .eq("id", data.id)
      .eq("country_code", data.code)
      .select("id");
    if (error) throw governanceError(error);
    if (!rows?.length) throw new Error("That record was not found, or you can't change it.");
    return { ok: true };
  });

// ------------------------------------------------------------------ edit

const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => v || null)
    .nullable();

const OfficeInput = z.object({
  id: z.string().uuid().optional(),
  office_key: z.enum(OFFICE_KEYS),
  title: z.string().trim().min(2).max(200),
  holder_name: text(160),
  ministry_slug: text(80),
  portfolio: z.string().trim().max(300).default(""),
  precedence: z.number().int().min(0).max(999).optional(),
  party: text(120),
  appointed_on: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  portrait_url: z.string().trim().url().max(500).nullable().optional(),
  bio: text(2000).optional(),
  source_url: z.string().trim().url().max(500).nullable().optional(),
});

export const saveOffice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    parseInput(z.object({ code: codeSchema, office: OfficeInput }), d),
  )
  .handler(async ({ data, context }): Promise<{ id: string }> => {
    const o = data.office;
    const row = {
      country_code: data.code,
      office_key: o.office_key,
      title: o.title,
      holder_name: o.holder_name,
      ministry_slug: o.ministry_slug,
      portfolio: o.portfolio,
      precedence: o.precedence ?? OFFICE_PRECEDENCE[o.office_key],
      party: o.party,
      appointed_on: o.appointed_on ?? null,
      portrait_url: o.portrait_url ?? null,
      ...(o.bio !== undefined ? { bio: o.bio } : {}),
      source_url: o.source_url ?? null,
    };
    const c = db(context.supabase).from("government_offices");
    const q = o.id
      ? c.update(row).eq("id", o.id).eq("country_code", data.code)
      : c.insert({ ...row, origin: "manual" });
    const { data: saved, error } = await q.select("id").maybeSingle();
    if (error) throw governanceError(error);
    if (!saved) throw new Error("That office was not found, or you can't change it.");
    return saved as { id: string };
  });

const BodyInput = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2).max(200),
  acronym: text(20),
  kind: z.enum(BODY_KINDS),
  parent_ministry_slug: text(80),
  enabling_act: text(300),
  act_year: z.number().int().min(1800).max(2100).nullable().optional(),
  mandate: z.string().trim().max(2000).default(""),
  head_name: text(160),
  head_title: text(120),
  board_chair: text(160),
  sector_code: text(64),
  services: z.array(z.string().trim().min(1).max(160)).max(40).default([]),
  website: z.string().trim().url().max(500).nullable().optional(),
  source_url: z.string().trim().url().max(500).nullable().optional(),
});

export const saveBody = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => parseInput(z.object({ code: codeSchema, body: BodyInput }), d))
  .handler(async ({ data, context }): Promise<{ id: string }> => {
    const b = data.body;
    const row = {
      country_code: data.code,
      name: b.name,
      acronym: b.acronym,
      kind: b.kind,
      parent_ministry_slug: b.parent_ministry_slug,
      enabling_act: b.enabling_act,
      act_year: b.act_year ?? null,
      mandate: b.mandate,
      head_name: b.head_name,
      head_title: b.head_title,
      board_chair: b.board_chair,
      sector_code: b.sector_code,
      services: b.services,
      website: b.website ?? null,
      source_url: b.source_url ?? null,
    };
    const c = db(context.supabase).from("statutory_bodies");
    const q = b.id
      ? c.update(row).eq("id", b.id).eq("country_code", data.code)
      : c.insert({
          ...row,
          slug: slugify(b.acronym ? `${b.name} ${b.acronym}` : b.name),
          origin: "manual",
        });
    const { data: saved, error } = await q.select("id").maybeSingle();
    if (error) throw governanceError(error);
    if (!saved) throw new Error("That body was not found, or you can't change it.");
    return saved as { id: string };
  });
