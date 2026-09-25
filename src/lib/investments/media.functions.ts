// @domain investments
// @tables investment_project_media, investment_projects, investment_project_compliance
// @ui admin/countries/$code/investments/$id (ProjectMediaPanel), admin/countries/$code/investments

// Project photos and documents, plus the illustrative desalination sample.
// Files live in the private `investment-media` bucket and are served through
// short-lived signed URLs after RLS confirms the caller can read the row.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireAdmin } from "@/lib/auth/require-admin";

const BUCKET = "investment-media";
const code = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{3}$/);

export type ProjectMedia = {
  id: string;
  kind: "image" | "document";
  title: string;
  caption: string | null;
  mime: string;
  is_cover: boolean;
  url: string | null;
};

export const listProjectMedia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ code, projectId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<ProjectMedia[]> => {
    const { data: rows, error } = await context.supabase
      .from("investment_project_media")
      .select("id,kind,title,caption,mime,is_cover,storage_path,sort")
      .eq("project_id", data.projectId)
      .eq("country_code", data.code)
      .order("is_cover", { ascending: false })
      .order("sort", { ascending: true });
    if (error) throw new Error(error.message);
    if (!rows?.length) return [];
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed } = await supabaseAdmin.storage.from(BUCKET).createSignedUrls(
      rows.map((r) => r.storage_path),
      3600,
    );
    const urlByPath = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));
    return rows.map((r) => ({
      id: r.id,
      kind: r.kind as "image" | "document",
      title: r.title,
      caption: r.caption,
      mime: r.mime,
      is_cover: r.is_cover,
      url: urlByPath.get(r.storage_path) ?? null,
    }));
  });

export const uploadProjectMedia = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: unknown) =>
    z
      .object({
        code,
        projectId: z.string().uuid(),
        title: z.string().trim().min(1).max(200),
        caption: z.string().trim().max(500).nullable().optional(),
        fileName: z.string().trim().min(1).max(200),
        mime: z.string().trim().max(120),
        base64: z.string().max(14_000_000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const kind = data.mime.startsWith("image/") ? "image" : "document";
    if (kind === "document" && data.mime !== "application/pdf") {
      throw new Error("Documents must be PDF files.");
    }
    const safe = data.fileName.replace(/[^a-zA-Z0-9._-]/g, "-").slice(-80);
    const path = `${data.code}/${data.projectId}/${Date.now()}-${safe}`;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const bytes = Uint8Array.from(atob(data.base64), (c) => c.charCodeAt(0));
    const up = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(path, bytes, { contentType: data.mime, upsert: false });
    if (up.error) throw new Error(up.error.message);
    const { error } = await context.supabase.from("investment_project_media").insert({
      project_id: data.projectId,
      country_code: data.code,
      kind,
      title: data.title,
      caption: data.caption ?? null,
      storage_path: path,
      mime: data.mime,
      sort: 100,
      created_by: context.userId,
    });
    if (error) {
      await supabaseAdmin.storage.from(BUCKET).remove([path]);
      throw new Error(error.message);
    }
    return { ok: true };
  });

export const deleteProjectMedia = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("investment_project_media")
      .delete()
      .eq("id", data.id)
      .select("storage_path")
      .maybeSingle();
    if (error) throw new Error(error.message);
    // Sample files are shared by every re-seed; keep them in storage.
    if (row && !row.storage_path.startsWith("samples/")) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.storage.from(BUCKET).remove([row.storage_path]);
    }
    return { ok: true };
  });

// ------------------------------------------------------------ sample project

const SAMPLE_TITLE = "Crabbs Seawater Reverse-Osmosis Desalination Plant (Sample)";
const S = "samples/desalination";

const SAMPLE_MEDIA = [
  {
    kind: "image",
    file: "cover.jpg",
    title: "Plant overview",
    caption: "Illustrative view of the plant, product-water tanks and the main to St John's.",
    cover: true,
  },
  {
    kind: "image",
    file: "site-aerial.jpg",
    title: "Site aerial",
    caption: "Crabbs Peninsula site with intake pier and storage.",
  },
  {
    kind: "image",
    file: "membrane-hall.jpg",
    title: "Membrane hall",
    caption: "Two-pass reverse-osmosis trains.",
  },
  {
    kind: "image",
    file: "intake-outfall.jpg",
    title: "Intake and brine outfall",
    caption: "Velocity-capped intake and multiport brine diffuser.",
  },
  {
    kind: "image",
    file: "solar-array.jpg",
    title: "Solar array",
    caption: "6 MWp solar supply with battery support.",
  },
  { kind: "document", file: "concept-note.pdf", title: "Project concept note" },
  { kind: "document", file: "pre-feasibility.pdf", title: "Pre-feasibility summary" },
  { kind: "document", file: "es-screening.pdf", title: "Environmental and social screening" },
  { kind: "document", file: "financial-summary.pdf", title: "Financial model summary" },
  {
    kind: "document",
    file: "term-sheet.pdf",
    title: "Water purchase agreement — indicative term sheet",
  },
] as const;

export const seedSampleDesalination = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: unknown) => z.object({ code }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing } = await supabaseAdmin
      .from("investment_projects")
      .select("id")
      .eq("country_code", data.code)
      .eq("is_sample", true)
      .eq("title", SAMPLE_TITLE)
      .maybeSingle();
    if (existing) return { id: existing.id, created: false };

    const { data: p, error } = await supabaseAdmin
      .from("investment_projects")
      .insert({
        country_code: data.code,
        is_sample: true,
        title: SAMPLE_TITLE,
        sector: "Water and sanitation",
        structure: "PPP",
        stage: "feasibility",
        capex_usd: 48_000_000,
        summary:
          "SAMPLE — illustrative figures. A 15,000 m³/day seawater reverse-osmosis plant on the Crabbs Peninsula, powered largely by an on-site 6 MWp solar array, adding drought-proof drinking water for Antigua and replacing ageing diesel-driven units. Delivered as a 25-year design-build-operate-transfer PPP with the public water utility as sole offtaker.",
        revenue_model:
          "Bulk water sold to the public utility under a 25-year water purchase agreement: availability payment plus a volumetric charge (~US$1.35/m³, indexed), take-or-pay at 85% availability, backed by a government support letter and a three-month payment reserve.",
        sponsor: "Antigua Public Utilities Authority (illustrative sponsor)",
        es_category: "B",
        climate_alignment:
          "Adaptation: secures potable water against drought and sea-level-driven aquifer salinity. Mitigation: 6 MWp solar cuts grid and diesel use; aligned with the national NDC water and energy targets.",
        risks:
          "Construction cost overrun (contractor, fixed-price EPC); energy price (offtaker, pass-through); membrane performance (operator); offtaker payment (government support letter, reserve account); hurricane damage (insurance, hardened design); brine impact (operator, diffuser monitoring).",
        feasibility_done: true,
        land_secured: true,
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error || !p) throw new Error(error?.message ?? "Could not create the sample project.");

    await supabaseAdmin.from("investment_project_compliance").upsert({
      project_id: p.id,
      country_code: data.code,
      beneficial_owners: [
        {
          name: "Sample Water Holdings Ltd (placeholder)",
          nationality: "Antigua and Barbuda",
          ownership_pct: 60,
          is_pep: false,
          evidence: "Sample record",
        },
        {
          name: "Sample Climate Infrastructure Fund (placeholder)",
          nationality: "Multilateral",
          ownership_pct: 40,
          is_pep: false,
          evidence: "Sample record",
        },
      ],
      aml_status: "cleared",
      aml_reference: "SAMPLE-AML-0001",
      notes: "Placeholder compliance record for the illustrative sample project.",
    });

    await supabaseAdmin.from("investment_project_media").insert(
      SAMPLE_MEDIA.map((m, i) => ({
        project_id: p.id,
        country_code: data.code,
        kind: m.kind,
        title: m.title,
        caption: "caption" in m ? m.caption : "Sample document — illustrative figures only.",
        storage_path: `${S}/${m.file}`,
        mime: m.kind === "image" ? "image/jpeg" : "application/pdf",
        sort: i,
        is_cover: "cover" in m && m.cover,
        created_by: context.userId,
      })),
    );

    // Submit for approval so a second person can demonstrate the approval step.
    const sub = await supabaseAdmin
      .from("investment_projects")
      .update({ approval_status: "submitted" })
      .eq("id", p.id);
    return {
      id: p.id,
      created: true,
      submitted: !sub.error,
      submitError: sub.error?.message ?? null,
    };
  });

export const removeSampleProjects = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: unknown) => z.object({ code }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("investment_projects")
      .delete()
      .eq("country_code", data.code)
      .eq("is_sample", true)
      .select("id");
    if (error) throw new Error(error.message);
    return { removed: rows?.length ?? 0 };
  });
