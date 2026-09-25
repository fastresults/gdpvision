// @domain investments
// @tables investors,investor_interests,investment_projects,profiles
// @ui src/routes/_authenticated/admin/countries.$code.investors.tsx
//
// Investor directory and the interest pipeline. The database enforces the
// stage gates (INTEREST_STAGE_GATE in syndication/db.ts): no data room without
// an NDA date, no due diligence or later without a matched investor whose KYC
// is cleared, and a reason for every lost opportunity. Only a compliance
// officer can clear or fail an investor's KYC. Messages come back through
// governanceError() so the person sees exactly which gate stopped them.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { codeSchema, parseInput } from "@/lib/investments/pipeline.functions";
import {
  db,
  governanceError,
  INTEREST_STAGES,
  INVESTOR_KINDS,
  loadCapabilities,
  type InterestRow,
  type InvestorRow,
  type KycStatus,
} from "@/lib/syndication/db";

function interestError(e: { message?: string } | null): Error {
  if (e?.message && /duplicate key/i.test(e.message)) {
    return new Error(
      "This investor is already in the pipeline for this project. Update that entry instead.",
    );
  }
  return governanceError(e);
}

const OPEN = (stage: string) => stage !== "closed_won" && stage !== "closed_lost";

export type InvestorView = InvestorRow & { openInterests: number };

export const listInvestors = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => parseInput(z.object({ code: codeSchema }), d))
  .handler(async ({ data, context }) => {
    const c = db(context.supabase);
    const [inv, ints, capabilities] = await Promise.all([
      c.from("investors").select("*").eq("country_code", data.code).order("name"),
      c
        .from("investor_interests")
        .select("investor_id,stage")
        .eq("country_code", data.code)
        .not("investor_id", "is", null),
      loadCapabilities(context.supabase, context.userId, data.code),
    ]);
    if (inv.error) throw governanceError(inv.error);
    const open = new Map<string, number>();
    for (const i of (ints.data ?? []) as Array<Pick<InterestRow, "investor_id" | "stage">>) {
      if (i.investor_id && OPEN(i.stage))
        open.set(i.investor_id, (open.get(i.investor_id) ?? 0) + 1);
    }
    const investors: InvestorView[] = ((inv.data ?? []) as InvestorRow[]).map((r) => ({
      ...r,
      sectors: r.sectors ?? [],
      openInterests: open.get(r.id) ?? 0,
    }));
    return { investors, capabilities };
  });

const optText = (max: number) =>
  z
    .string()
    .max(max)
    .nullable()
    .optional()
    .transform((v) => (v == null || v.trim() === "" ? null : v.trim()));

export const saveInvestor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    parseInput(
      z
        .object({
          code: codeSchema,
          id: z.string().uuid().optional(),
          name: z.string().trim().min(2, "Give the investor's name.").max(200),
          kind: z.enum(INVESTOR_KINDS),
          hq_country: optText(80),
          website: optText(300),
          contact_name: optText(120),
          contact_email: z
            .string()
            .trim()
            .max(200)
            .nullable()
            .optional()
            .transform((v) => (v ? v : null))
            .refine(
              (v) => v == null || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
              "The contact email does not look right.",
            ),
          ticket_min_usd: z
            .number()
            .nonnegative("Ticket sizes cannot be negative.")
            .nullable()
            .optional(),
          ticket_max_usd: z
            .number()
            .nonnegative("Ticket sizes cannot be negative.")
            .nullable()
            .optional(),
          sectors: z.array(z.string().trim().min(1).max(60)).max(30).default([]),
          notes: optText(4000),
        })
        .refine(
          (v) =>
            v.ticket_min_usd == null ||
            v.ticket_max_usd == null ||
            v.ticket_min_usd <= v.ticket_max_usd,
          "The minimum ticket is larger than the maximum.",
        ),
      d,
    ),
  )
  .handler(async ({ data, context }) => {
    const { code, id, ...fields } = data;
    const row = {
      ...fields,
      ticket_min_usd: fields.ticket_min_usd ?? null,
      ticket_max_usd: fields.ticket_max_usd ?? null,
      country_code: code,
    };
    const c = db(context.supabase);
    const q = id
      ? c
          .from("investors")
          .update(row)
          .eq("id", id)
          .eq("country_code", code)
          .select("id")
          .maybeSingle()
      : c.from("investors").insert(row).select("id").single();
    const { data: saved, error } = await q;
    if (error) throw governanceError(error);
    if (!saved) throw new Error("This investor does not exist or you do not have access to it.");
    return saved as { id: string };
  });

export const setKyc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    parseInput(
      z.object({
        code: codeSchema,
        id: z.string().uuid(),
        status: z.enum(["not_started", "in_progress", "cleared", "failed"]),
      }),
      d,
    ),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await db(context.supabase)
      .from("investors")
      .update({ kyc_status: data.status })
      .eq("id", data.id)
      .eq("country_code", data.code)
      .select("id,kyc_status")
      .maybeSingle();
    if (error) throw governanceError(error);
    if (!row) throw new Error("This investor does not exist or you do not have access to it.");
    return row as { id: string; kyc_status: KycStatus };
  });

export type InterestView = InterestRow & {
  investorName: string | null;
  investorKyc: KycStatus | null;
  projectTitle: string;
  ownerName: string | null;
};

export const listInterests = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    parseInput(z.object({ code: codeSchema, projectId: z.string().uuid().optional() }), d),
  )
  .handler(async ({ data, context }) => {
    const c = db(context.supabase);
    let iq = c
      .from("investor_interests")
      .select("*")
      .eq("country_code", data.code)
      .order("updated_at", { ascending: false });
    if (data.projectId) iq = iq.eq("project_id", data.projectId);
    const [ints, investors, projects] = await Promise.all([
      iq,
      c.from("investors").select("id,name,kyc_status").eq("country_code", data.code).order("name"),
      c
        .from("investment_projects")
        .select("id,title,approval_status")
        .eq("country_code", data.code)
        .order("title"),
    ]);
    if (ints.error) throw governanceError(ints.error);
    const invById = new Map(
      ((investors.data ?? []) as Array<Pick<InvestorRow, "id" | "name" | "kyc_status">>).map(
        (i) => [i.id, i],
      ),
    );
    const projById = new Map(
      ((projects.data ?? []) as Array<{ id: string; title: string }>).map((p) => [p.id, p.title]),
    );
    const rows = (ints.data ?? []) as InterestRow[];

    // Owner names, where the viewer can read profiles; otherwise just "You" / "Assigned".
    const ownerIds = Array.from(
      new Set(rows.map((r) => r.owner_id).filter((v): v is string => !!v)),
    );
    const names = new Map<string, string>();
    if (ownerIds.length) {
      const { data: profs } = await c.from("profiles").select("id,display_name").in("id", ownerIds);
      for (const p of (profs ?? []) as Array<{ id: string; display_name: string | null }>) {
        if (p.display_name) names.set(p.id, p.display_name);
      }
    }

    const interests: InterestView[] = rows.map((r) => {
      const inv = r.investor_id ? invById.get(r.investor_id) : undefined;
      return {
        ...r,
        investorName: inv?.name ?? null,
        investorKyc: inv?.kyc_status ?? null,
        projectTitle: projById.get(r.project_id) ?? "Unknown project",
        ownerName: r.owner_id
          ? r.owner_id === context.userId
            ? "You"
            : (names.get(r.owner_id) ?? "Assigned")
          : null,
      };
    });
    return {
      interests,
      investors: (investors.data ?? []) as Array<Pick<InvestorRow, "id" | "name" | "kyc_status">>,
      projects: (projects.data ?? []) as Array<{
        id: string;
        title: string;
        approval_status: string;
      }>,
      userId: context.userId,
    };
  });

const dateStr = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date in the form YYYY-MM-DD.")
  .nullable()
  .optional()
  .or(z.literal("").transform(() => null));

export const saveInterest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    parseInput(
      z.object({
        code: codeSchema,
        id: z.string().uuid().optional(),
        project_id: z.string().uuid().optional(),
        investor_id: z.string().uuid().nullable().optional(),
        stage: z.enum(INTEREST_STAGES),
        indicative_amount_usd: z
          .number()
          .nonnegative("The amount cannot be negative.")
          .nullable()
          .optional(),
        next_step: optText(500),
        next_step_due: dateStr,
        owner_id: z.string().uuid().nullable().optional(),
        nda_signed_at: dateStr,
        lost_reason: optText(1000),
        // Manual entries without an investor record yet.
        contact_name: optText(120),
        contact_email: optText(200),
        organisation: optText(160),
        message: optText(2000),
      }),
      d,
    ),
  )
  .handler(async ({ data, context }) => {
    const c = db(context.supabase);
    const fields: Record<string, unknown> = {
      investor_id: data.investor_id ?? null,
      stage: data.stage,
      indicative_amount_usd: data.indicative_amount_usd ?? null,
      next_step: data.next_step ?? null,
      next_step_due: data.next_step_due ?? null,
      nda_signed_at: data.nda_signed_at ?? null,
      lost_reason: data.lost_reason ?? null,
    };
    if (data.owner_id !== undefined) fields.owner_id = data.owner_id;

    if (data.id) {
      // Inbound contact details are what the enquirer sent; they are not edited here.
      const { data: row, error } = await c
        .from("investor_interests")
        .update(fields)
        .eq("id", data.id)
        .eq("country_code", data.code)
        .select("id")
        .maybeSingle();
      if (error) throw interestError(error);
      if (!row) throw new Error("This interest does not exist or you do not have access to it.");
      return row as { id: string };
    }

    if (!data.project_id) throw new Error("Choose the project this interest is in.");
    if (!data.investor_id && !data.contact_name && !data.organisation) {
      throw new Error("Choose an investor, or give a contact name or organisation.");
    }
    const { data: row, error } = await c
      .from("investor_interests")
      .insert({
        ...fields,
        owner_id: data.owner_id ?? context.userId,
        country_code: data.code,
        project_id: data.project_id,
        source: "manual",
        contact_name: data.contact_name ?? null,
        contact_email: data.contact_email ?? null,
        organisation: data.organisation ?? null,
        message: data.message ?? null,
      })
      .select("id")
      .single();
    if (error) throw interestError(error);
    return row as { id: string };
  });
