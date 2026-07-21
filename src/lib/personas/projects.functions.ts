// Chamber 07 · Research projects — each country can run multiple concurrent
// research programs (each with its own brief → segments → studies → memo).

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "project";
}

// List every research project for a country with rollup counts.
export const listProjects = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ countryCode: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: projects } = await supabase
      .from("persona_projects")
      .select("id,title,slug,status,visibility,created_at,updated_at")
      .eq("country_code", data.countryCode)
      .order("updated_at", { ascending: false });

    const list = projects ?? [];
    if (list.length === 0) return [] as Array<{
      id: string; title: string; slug: string; status: string; visibility: string;
      created_at: string; updated_at: string;
      studies_total: number; studies_done: number; segments_total: number;
      has_program_memo: boolean;
    }>;

    const ids = list.map((p) => p.id as string);
    const [{ data: studies }, { data: memos }, { count: countrySegments }] = await Promise.all([
      supabase.from("studies").select("id,status,project_id").in("project_id", ids),
      supabase.from("study_program_reports").select("id,project_id,updated_at").in("project_id", ids),
      supabase
        .from("persona_segments")
        .select("id", { count: "exact", head: true })
        .eq("country_code", data.countryCode),
    ]);

    const perProject = new Map<string, { total: number; done: number; memo: boolean }>();
    for (const p of list) perProject.set(p.id as string, { total: 0, done: 0, memo: false });
    for (const s of studies ?? []) {
      const b = perProject.get(s.project_id as string);
      if (!b) continue;
      b.total += 1;
      if (s.status === "complete" || s.status === "synthesized") b.done += 1;
    }
    for (const m of memos ?? []) {
      const b = perProject.get(m.project_id as string);
      if (b) b.memo = true;
    }

    return list.map((p) => {
      const b = perProject.get(p.id as string) ?? { total: 0, done: 0, segments: 0, memo: false };
      return {
        id: p.id as string,
        title: p.title as string,
        slug: p.slug as string,
        status: p.status as string,
        visibility: p.visibility as string,
        created_at: p.created_at as string,
        updated_at: p.updated_at as string,
        studies_total: b.total,
        studies_done: b.done,
        segments_total: b.segments,
        has_program_memo: b.memo,
      };
    });
  });

// Create a new project. Slug is derived from title and made unique per country.
export const createProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        countryCode: z.string(),
        title: z.string().min(2).max(120),
        visibility: z.enum(["public", "private"]).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const base = slugify(data.title);
    let slug = base;
    for (let i = 1; i < 20; i++) {
      const { data: clash } = await supabase
        .from("persona_projects")
        .select("id")
        .eq("country_code", data.countryCode)
        .eq("slug", slug)
        .maybeSingle();
      if (!clash) break;
      slug = `${base}-${i + 1}`;
    }
    const visibility = data.visibility ?? "public";
    const { data: row, error } = await supabase
      .from("persona_projects")
      .insert({
        country_code: data.countryCode,
        title: data.title.trim(),
        slug,
        status: "active",
        visibility,
        owner_country_code: visibility === "private" ? data.countryCode : null,
        uploaded_by: visibility === "private" ? userId : null,
        created_by: userId,
      } as never)
      .select("id,title,slug")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const renameProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ projectId: z.string(), title: z.string().min(2).max(120) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("persona_projects")
      .update({ title: data.title.trim() })
      .eq("id", data.projectId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const archiveProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ projectId: z.string(), archived: z.boolean().optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("persona_projects")
      .update({ status: data.archived === false ? "active" : "archived" })
      .eq("id", data.projectId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
