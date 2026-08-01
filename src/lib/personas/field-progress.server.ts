// Chamber 07 · Field progress — server-only computation behind
// field-progress.functions.ts. Reads the real artefacts of a field programme
// and reports, stage by stage, whether it is done and what is missing.

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import type { FieldFinding, FieldProgress, FieldStageProgress } from "./field-stages";

type Db = SupabaseClient<Database>;

function stage(
  complete: boolean,
  blocker: string | null,
  counts: Record<string, number> = {},
): FieldStageProgress {
  return { complete, blocker: complete ? null : blocker, counts };
}

/**
 * The one `studies` row that carries this programme's field work. Created on
 * first entry into a field stage, once the plan is active. Idempotent.
 */
export async function ensureFieldStudyRow(
  supabase: Db,
  projectId: string,
  userId: string | null,
): Promise<string | null> {
  const { data: project } = await supabase
    .from("persona_projects")
    .select("id,title,country_code,visibility")
    .eq("id", projectId)
    .maybeSingle();
  if (!project) throw new Error("Research programme not found");

  const { data: existing } = await supabase
    .from("studies")
    .select("id")
    .eq("project_id", projectId)
    .eq("mode", "field")
    .order("created_at", { ascending: true })
    .limit(1);
  const found = existing?.[0]?.id as string | undefined;
  if (found) return found;

  const { data: plan } = await supabase
    .from("programme_plans")
    .select("summary,method_mix")
    .eq("project_id", projectId)
    .eq("status", "active")
    .maybeSingle();
  if (!plan) return null; // no active plan — nothing to hang field work on yet

  const mix = JSON.stringify(plan.method_mix ?? "").toLowerCase();
  const method = mix.includes("focus") || mix.includes("interview") || mix.includes("depth")
    ? "focus_group"
    : "survey";

  const { data: row, error } = await supabase
    .from("studies")
    .insert({
      country_code: project.country_code as string,
      project_id: projectId,
      mode: "field",
      kind: method,
      method,
      title: `${project.title} · field`,
      objective: (plan.summary as string | null) ?? null,
      status: "draft",
      visibility: (project.visibility as string | null) ?? "private",
      owner_country_code: project.country_code as string,
      owner_user_id: userId,
      uploaded_by: userId,
    } as never)
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return row.id as string;
}

export async function computeFieldProgress(
  supabase: Db,
  projectId: string,
  userId: string | null,
): Promise<FieldProgress> {
  const { data: project } = await supabase
    .from("persona_projects")
    .select("id,title,country_code,status")
    .eq("id", projectId)
    .maybeSingle();
  if (!project) throw new Error("Research programme not found");
  const countryCode = project.country_code as string;

  const [{ data: brief }, { data: plan }] = await Promise.all([
    supabase
      .from("persona_projects")
      .select("brief_committed_at")
      .eq("id", projectId)
      .maybeSingle(),
    supabase
      .from("programme_plans")
      .select("id,status")
      .eq("project_id", projectId)
      .eq("status", "active")
      .maybeSingle(),
  ]);

  const briefCommitted = !!(brief as { brief_committed_at?: string | null } | null)
    ?.brief_committed_at;
  const planActive = !!plan;

  const studyId = planActive ? await ensureFieldStudyRow(supabase, projectId, userId) : null;

  // ── Participants ────────────────────────────────────────────────────────
  const { data: panels } = await supabase
    .from("research_panels")
    .select("id")
    .eq("project_id", projectId);
  const panelIds = (panels ?? []).map((p) => p.id as string);
  let panelMembers = 0;
  if (panelIds.length > 0) {
    const { count } = await supabase
      .from("research_panel_members")
      .select("contact_id", { count: "exact", head: true })
      .in("panel_id", panelIds);
    panelMembers = count ?? 0;
  }
  const { count: contactCount } = await supabase
    .from("research_contacts")
    .select("id", { count: "exact", head: true })
    .eq("country_code", countryCode);

  const participants = stage(
    panelMembers > 0,
    panelIds.length === 0
      ? "No panel yet — build one from the contact book."
      : "The panel is empty — add contacts to it.",
    { contacts: contactCount ?? 0, panels: panelIds.length, members: panelMembers },
  );

  // ── Instruments ─────────────────────────────────────────────────────────
  let instrumentCount = 0;
  if (studyId) {
    const { count } = await supabase
      .from("field_instruments")
      .select("id", { count: "exact", head: true })
      .eq("study_id", studyId);
    instrumentCount = count ?? 0;
  }
  const instruments = stage(
    instrumentCount > 0,
    "No instrument yet — let the AI draft one from the brief and the plan.",
    { instruments: instrumentCount },
  );

  // ── Fieldwork ───────────────────────────────────────────────────────────
  let responses = 0;
  let sessionsHeld = 0;
  let sessions = 0;
  let collections = 0;
  if (studyId) {
    const [{ count: r }, { data: ss }, { count: c }] = await Promise.all([
      supabase
        .from("field_responses")
        .select("id", { count: "exact", head: true })
        .eq("study_id", studyId),
      supabase.from("field_sessions").select("status").eq("study_id", studyId),
      supabase
        .from("field_collections")
        .select("id", { count: "exact", head: true })
        .eq("study_id", studyId),
    ]);
    responses = r ?? 0;
    sessions = (ss ?? []).length;
    sessionsHeld = (ss ?? []).filter((s) => s.status === "held").length;
    collections = c ?? 0;
  }
  const fieldwork = stage(
    responses > 0 || sessionsHeld > 0,
    collections === 0 && sessions === 0
      ? "Nothing in the field yet — open a collection or schedule a session."
      : "No returns yet — invite the panel, or mark a session held.",
    { responses, sessions, sessionsHeld, collections },
  );

  // ── Evidence ────────────────────────────────────────────────────────────
  let synthesised = false;
  let fieldFinding: FieldFinding | null = null;
  if (studyId) {
    const { data: s } = await supabase
      .from("studies")
      .select("config")
      .eq("id", studyId)
      .maybeSingle();
    fieldFinding =
      ((s?.config as Record<string, unknown> | null)?.["field_finding"] as FieldFinding | null) ??
      null;
    synthesised = !!fieldFinding;
  }
  const closed = project.status === "completed";
  const evidence = stage(
    synthesised && closed,
    !synthesised
      ? "The returns have not been synthesised yet."
      : "Synthesised — close the programme to file it to the second brain.",
    { synthesised: synthesised ? 1 : 0, closed: closed ? 1 : 0 },
  );

  return {
    studyId,
    fieldFinding,
    planActive,
    briefCommitted,
    stages: {
      brief: stage(briefCommitted, "The source brief is not committed."),
      plan: stage(planActive, "No approved programme plan yet."),
      participants,
      instruments,
      fieldwork,
      evidence,
    },
  };
}
