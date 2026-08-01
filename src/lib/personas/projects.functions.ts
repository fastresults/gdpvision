// @domain personas
// @tables persona_projects,persona_segment_members,persona_segments,persona_study_drafts,studies,study_evidence,study_instruments,study_program_reports,study_questions,study_reports,study_responses,study_transcripts
// @ui src/components/personas/StudyWizard/ProgramsIndex.tsx; src/components/personas/StudyWizard/ProjectSwitcher.tsx; src/routes/_authenticated/admin/countries.$code.personas.index.tsx

// Chamber 07 · Research projects — each country can run multiple concurrent
// research programs (each with its own brief → segments → studies → memo).

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// List every research project for a country with rollup counts.
export const listProjects = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ countryCode: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: projects } = await supabase
      .from("persona_projects")
      .select("id,title,slug,status,visibility,track,track_chosen_at,created_at,updated_at")
      .eq("country_code", data.countryCode)
      .order("updated_at", { ascending: false });

    const list = projects ?? [];
    if (list.length === 0) return [] as Array<{
      id: string; title: string; slug: string; status: string; visibility: string;
      track: string; track_chosen_at: string | null;
      created_at: string; updated_at: string;
      studies_total: number; studies_done: number; segments_total: number;
       has_program_memo: boolean; instruments_total: number; sessions_total: number;
       reports_total: number; current_stage: string; progress_percent: number;
    }>;

    const ids = list.map((p) => p.id as string);
    const [{ data: studies }, { data: memos }, { data: segments }] = await Promise.all([
      supabase.from("studies").select("id,status,project_id").in("project_id", ids),
      supabase.from("study_program_reports").select("id,project_id,updated_at").in("project_id", ids),
      supabase
        .from("persona_segments")
        .select("id,project_id")
        .in("project_id", ids),
    ]);

    const studyIds = (studies ?? []).map((study) => study.id as string);
    const [{ data: instruments }, { data: sessions }, { data: reports }] = studyIds.length > 0
      ? await Promise.all([
          supabase.from("field_instruments").select("id,study_id").in("study_id", studyIds),
          supabase.from("field_sessions").select("id,study_id,status").in("study_id", studyIds),
          supabase.from("study_reports").select("id,study_id").in("study_id", studyIds),
        ])
      : [{ data: [] }, { data: [] }, { data: [] }];

    const projectByStudy = new Map<string, string>();
    for (const study of studies ?? []) projectByStudy.set(study.id as string, study.project_id as string);

    const perProject = new Map<string, { total: number; done: number; memo: boolean; segments: number; instruments: number; sessions: number; reports: number }>();
    for (const p of list) perProject.set(p.id as string, { total: 0, done: 0, memo: false, segments: 0, instruments: 0, sessions: 0, reports: 0 });
    for (const s of studies ?? []) {
      const b = perProject.get(s.project_id as string);
      if (!b) continue;
      b.total += 1;
      if (s.status === "completed" || s.status === "complete" || s.status === "synthesized") b.done += 1;
    }
    for (const m of memos ?? []) {
      const b = perProject.get(m.project_id as string);
      if (b) b.memo = true;
    }
    for (const segment of segments ?? []) {
      const b = perProject.get(segment.project_id as string);
      if (b) b.segments += 1;
    }
    for (const instrument of instruments ?? []) {
      const projectId = projectByStudy.get(instrument.study_id as string);
      const project = projectId ? perProject.get(projectId) : undefined;
      if (project) project.instruments += 1;
    }
    for (const session of sessions ?? []) {
      const projectId = projectByStudy.get(session.study_id as string);
      const project = projectId ? perProject.get(projectId) : undefined;
      if (project) project.sessions += 1;
    }
    for (const report of reports ?? []) {
      const projectId = projectByStudy.get(report.study_id as string);
      const project = projectId ? perProject.get(projectId) : undefined;
      if (project) project.reports += 1;
    }

    return list.map((p) => {
      const b = perProject.get(p.id as string) ?? { total: 0, done: 0, memo: false, segments: 0, instruments: 0, sessions: 0, reports: 0 };
      const row = p as Record<string, unknown>;
      const track = (row.track as string | null) ?? "synthetic";
      const trackChosen = (row.track_chosen_at as string | null) ?? null;
      const isField = track === "field";
      const stage = !trackChosen
        ? "Choose track"
        : isField
          ? b.reports > 0 ? "Evidence" : b.sessions > 0 ? "Fieldwork" : b.instruments > 0 ? "Instruments" : b.total > 0 ? "Programme" : "Brief"
          : b.memo ? "Results" : b.total > 0 ? "Studies" : b.segments > 0 ? "Participants" : "Brief";
      const progress = !trackChosen
        ? 0
        : isField
          ? b.reports > 0 ? 100 : b.sessions > 0 ? 80 : b.instruments > 0 ? 60 : b.total > 0 ? 40 : 20
          : b.memo ? 100 : b.total > 0 ? Math.max(50, Math.round((b.done / b.total) * 90)) : b.segments > 0 ? 35 : 15;
      return {
        id: p.id as string,
        title: p.title as string,
        slug: p.slug as string,
        status: p.status as string,
        visibility: p.visibility as string,
        track,
        track_chosen_at: trackChosen,
        created_at: p.created_at as string,
        updated_at: p.updated_at as string,
        studies_total: b.total,
        studies_done: b.done,
        segments_total: b.segments,
        has_program_memo: b.memo,
        instruments_total: b.instruments,
        sessions_total: b.sessions,
        reports_total: b.reports,
        current_stage: stage,
        progress_percent: progress,
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
        track: z.enum(["synthetic", "field", "blended"]).optional(),
        // Stage 00 is AI-first: the material captured before the project
        // existed travels in with it, so nothing is ever re-entered.
        brief_raw: z.string().max(40_000).optional(),
        // The one governing source brief; brief_uploads is supporting context.
        brief_source: z
          .object({
            name: z.string(),
            path: z.string(),
            mime: z.string(),
            size: z.number(),
            excerpt: z.string().optional(),
          })
          .nullish(),
        brief_uploads: z
          .array(
            z.object({
              name: z.string(),
              path: z.string(),
              mime: z.string(),
              size: z.number(),
              excerpt: z.string().optional(),
            }),
          )
          .max(20)
          .optional(),
        brief_scope: z.unknown().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const slugify = (input: string) => input
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "project";
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
        track: data.track ?? "synthetic",
        track_chosen_at: data.track ? new Date().toISOString() : null,
        owner_country_code: visibility === "private" ? data.countryCode : null,
        uploaded_by: visibility === "private" ? userId : null,
        created_by: userId,
        ...(data.brief_raw !== undefined ? { brief_raw: data.brief_raw } : {}),
        ...(data.brief_source !== undefined ? { brief_source: data.brief_source ?? null } : {}),
        ...(data.brief_uploads !== undefined ? { brief_uploads: data.brief_uploads } : {}),
        ...(data.brief_scope !== undefined && data.brief_scope !== null
          ? { brief_scope: data.brief_scope }
          : {}),
      } as never)

      .select("id,title,slug")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

// Set (or change) which research track a programme runs on.
export const setProjectTrack = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        projectId: z.string().uuid(),
        track: z.enum(["synthetic", "field", "blended"]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("persona_projects")
      .update({ track: data.track, track_chosen_at: new Date().toISOString() } as never)
      .eq("id", data.projectId);
    if (error) throw new Error(error.message);
    return { ok: true as const, track: data.track };
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

// Permanently delete a project and all dependent research artifacts
// (segments, studies, program reports, drafts).
export const deleteProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ projectId: z.string() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const pid = data.projectId;

    // Best-effort cascade in case FKs aren't set to CASCADE.
    await supabase.from("study_program_reports").delete().eq("project_id", pid);
    const { data: studies } = await supabase
      .from("studies")
      .select("id")
      .eq("project_id", pid);
    const studyIds = (studies ?? []).map((s) => s.id as string);
    if (studyIds.length > 0) {
      await supabase.from("study_evidence").delete().in("study_id", studyIds);
      await supabase.from("study_responses").delete().in("study_id", studyIds);
      await supabase.from("study_transcripts").delete().in("study_id", studyIds);
      await supabase.from("study_questions").delete().in("study_id", studyIds);
      await supabase.from("study_instruments").delete().in("study_id", studyIds);
      await supabase.from("study_reports").delete().in("study_id", studyIds);
      await supabase.from("persona_study_drafts").delete().in("study_id", studyIds);
    }
    await supabase.from("persona_study_drafts").delete().eq("project_id", pid);
    await supabase.from("studies").delete().eq("project_id", pid);

    const { data: segments } = await supabase
      .from("persona_segments")
      .select("id")
      .eq("project_id", pid);
    const segmentIds = (segments ?? []).map((s) => s.id as string);
    if (segmentIds.length > 0) {
      await supabase.from("persona_segment_members").delete().in("segment_id", segmentIds);
      await supabase.from("persona_segments").delete().in("id", segmentIds);
    }

    const { error } = await supabase
      .from("persona_projects")
      .delete()
      .eq("id", pid);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
