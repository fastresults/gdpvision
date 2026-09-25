// @domain investments
// @tables investment_projects
// @ui src/routes/_authenticated/admin/countries.$code.investments.tsx

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ReadinessCheck = { key: string; label: string; standard: string; ok: boolean };

type ProjectLike = {
  title?: string | null;
  sector?: string | null;
  structure?: string | null;
  capex_usd?: number | null;
  revenue_model?: string | null;
  sponsor?: string | null;
  beneficial_owners?: string | null;
  es_category?: string | null;
  climate_alignment?: string | null;
  risks?: string | null;
  aml_cleared?: boolean | null;
  feasibility_done?: boolean | null;
  land_secured?: boolean | null;
};

/** Pure readiness scoring against investor-grade standards. */
export function readinessChecks(p: ProjectLike): ReadinessCheck[] {
  const has = (v: unknown) => v != null && String(v).trim() !== "";
  return [
    { key: "profile", label: "Sector, structure and size defined", standard: "OC4IDS / SIF", ok: has(p.sector) && has(p.structure) && (p.capex_usd ?? 0) > 0 },
    { key: "revenue", label: "Revenue model described", standard: "World Bank PPP Framework", ok: has(p.revenue_model) },
    { key: "sponsor", label: "Sponsor identified", standard: "OC4IDS", ok: has(p.sponsor) },
    { key: "bo", label: "Beneficial owners disclosed", standard: "FATF R.24", ok: has(p.beneficial_owners) },
    { key: "aml", label: "AML / CBI due diligence cleared", standard: "FATF R.10", ok: !!p.aml_cleared },
    { key: "es", label: "E&S category assigned (A/B/C)", standard: "IFC Performance Standards", ok: has(p.es_category) },
    { key: "climate", label: "Climate / taxonomy alignment stated", standard: "ISSB / EU Taxonomy", ok: has(p.climate_alignment) },
    { key: "risks", label: "Key risks documented", standard: "GI Hub project preparation", ok: has(p.risks) },
    { key: "feasibility", label: "Feasibility study complete", standard: "GI Hub project preparation", ok: !!p.feasibility_done },
    { key: "land", label: "Land and permits secured", standard: "World Bank PPP Framework", ok: !!p.land_secured },
  ];
}

export const listInvestments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ code: z.string().min(2).max(3) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("investment_projects")
      .select("*")
      .eq("country_code", data.code)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

const projectSchema = z.object({
  id: z.string().uuid().optional(),
  code: z.string().min(2).max(3),
  title: z.string().min(2).max(200),
  sector: z.string().max(100).nullable().optional(),
  structure: z.string().max(100).nullable().optional(),
  stage: z.string().max(50).optional(),
  capex_usd: z.number().nonnegative().nullable().optional(),
  revenue_model: z.string().max(1000).nullable().optional(),
  sponsor: z.string().max(200).nullable().optional(),
  beneficial_owners: z.string().max(1000).nullable().optional(),
  es_category: z.string().max(10).nullable().optional(),
  summary: z.string().max(4000).nullable().optional(),
  risks: z.string().max(4000).nullable().optional(),
  climate_alignment: z.string().max(1000).nullable().optional(),
  aml_cleared: z.boolean().optional(),
  feasibility_done: z.boolean().optional(),
  land_secured: z.boolean().optional(),
});

export const saveInvestment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => projectSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { code, id, ...rest } = data;
    const row = { ...rest, country_code: code };
    const q = id
      ? context.supabase.from("investment_projects").update(row).eq("id", id)
      : context.supabase.from("investment_projects").insert(row);
    const { error } = await q;
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const approveInvestment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: p, error } = await context.supabase.from("investment_projects").select("*").eq("id", data.id).single();
    if (error) throw new Error(error.message);
    if (readinessChecks(p).some((c) => !c.ok)) throw new Error("All readiness checks must pass before approval for syndication");
    const { error: e2 } = await context.supabase
      .from("investment_projects")
      .update({ approval_status: "approved", approved_by: context.userId })
      .eq("id", data.id);
    if (e2) throw new Error(e2.message);
    return { ok: true };
  });

/** OC4IDS-style export of approved projects only; private fields excluded. */
export const exportInvestmentsOc4ids = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ code: z.string().min(2).max(3) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("investment_projects")
      .select("id,title,sector,structure,stage,capex_usd,summary,es_category,climate_alignment,updated_at")
      .eq("country_code", data.code)
      .eq("approval_status", "approved");
    if (error) throw new Error(error.message);
    return {
      version: "0.9",
      publishedDate: new Date().toISOString(),
      projects: (rows ?? []).map((r) => ({
        id: r.id,
        title: r.title,
        description: r.summary,
        sector: r.sector ? [r.sector] : [],
        type: r.structure,
        status: r.stage,
        budget: { amount: { amount: r.capex_usd, currency: "USD" } },
        environment: { impactCategories: r.es_category ? [r.es_category] : [], climateMeasures: r.climate_alignment },
        updated: r.updated_at,
      })),
    };
  });
