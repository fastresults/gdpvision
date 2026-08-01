// Chamber 07 · Field progress — server-only computation behind
// field-progress.functions.ts. Reads the real artefacts of a field programme
// and reports, stage by stage, whether it is done and what is missing.

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import type { FieldFinding, FieldProgress, FieldStageProgress } from "./field-stages";
import { requiredInstruments } from "./instrument-draft.server";

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
  const method =
    mix.includes("focus") || mix.includes("interview") || mix.includes("depth")
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

  const [{ data: brief }, { data: plan }, { count: planDrafts }] = await Promise.all([
    supabase
      .from("persona_projects")
      .select("brief_committed_at")
      .eq("id", projectId)
      .maybeSingle(),
    supabase
      .from("programme_plans")
      .select("id,status,updated_at")
      .eq("project_id", projectId)
      .eq("status", "active")
      .maybeSingle(),
    supabase
      .from("programme_plans")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId),
  ]);

  const briefCommitted = !!(brief as { brief_committed_at?: string | null } | null)
    ?.brief_committed_at;
  const planActive = !!plan;
  const planDrafted = (planDrafts ?? 0) > 0;


  // The freshness clock for the client dossier: any of these moving after a
  // briefing was assembled means the assembled document no longer describes
  // the programme as it stands.
  const inputStamps: Array<string | null | undefined> = [
    (brief as { brief_committed_at?: string | null } | null)?.brief_committed_at,
    (plan as { updated_at?: string | null } | null)?.updated_at,
  ];


  const studyId = planActive ? await ensureFieldStudyRow(supabase, projectId, userId) : null;

  // ── Participants ────────────────────────────────────────────────────────
  const { data: panels } = await supabase
    .from("research_panels")
    .select("id")
    .eq("project_id", projectId);
  const panelIds = (panels ?? []).map((p) => p.id as string);
  let panelMembers = 0;
  let memberIds: string[] = [];
  if (panelIds.length > 0) {
    const [{ data: members }, { data: lastMember }] = await Promise.all([
      supabase.from("research_panel_members").select("contact_id").in("panel_id", panelIds),
      supabase
        .from("research_panel_members")
        .select("added_at")
        .in("panel_id", panelIds)
        .order("added_at", { ascending: false })
        .limit(1),
    ]);
    memberIds = [...new Set((members ?? []).map((m) => m.contact_id as string))];
    panelMembers = memberIds.length;
    inputStamps.push(lastMember?.[0]?.added_at as string | undefined);
  }

  // Contactable = on the panel, not opted out, and reachable by email. This is
  // the number that decides whether an invitation can actually go anywhere.
  let contactable = 0;
  if (memberIds.length > 0) {
    const { count } = await supabase
      .from("research_contacts")
      .select("id", { count: "exact", head: true })
      .in("id", memberIds)
      .is("opted_out_at", null)
      .not("email", "is", null)
      .neq("consent_status", "declined");
    contactable = count ?? 0;
  }

  const { count: contactCount } = await supabase
    .from("research_contacts")
    .select("id", { count: "exact", head: true })
    .eq("country_code", countryCode);

  const participants = stage(
    panelMembers > 0 && contactable === panelMembers,
    panelIds.length === 0
      ? "No panel yet — build one from the contact book."
      : panelMembers === 0
        ? "The panel is empty — add contacts to it."
        : contactable === 0
          ? "No panel member has a usable email address."
          : `${panelMembers - contactable} panel member${panelMembers - contactable === 1 ? " is" : "s are"} not reachable or has declined.`,
    {
      contacts: contactCount ?? 0,
      panels: panelIds.length,
      members: panelMembers,
      contactable,
    },
  );


  // ── Instruments ─────────────────────────────────────────────────────────
  // The plan decides what this programme must hold: a questionnaire for every
  // quantitative line, a discussion guide for every qualitative one.
  let instrumentCount = 0;
  let heldKinds: string[] = [];
  let requiredKinds: string[] = [];
  let questionCount = 0;
  let frontlineCount = 0;
  if (studyId) {
    const [{ data: rows }, { data: activePlan }] = await Promise.all([
      supabase
        .from("field_instruments")
        .select("kind,updated_at,questions")
        .eq("study_id", studyId),
      supabase
        .from("programme_plans")
        .select("method_mix")
        .eq("project_id", projectId)
        .eq("status", "active")
        .maybeSingle(),
    ]);
    heldKinds = [...new Set((rows ?? []).map((r) => r.kind as string))];
    instrumentCount = (rows ?? []).length;
    requiredKinds = requiredInstruments(activePlan?.method_mix).map((r) => r.kind);
    for (const r of rows ?? []) {
      inputStamps.push(r.updated_at as string | undefined);
      const qs = Array.isArray(r.questions) ? (r.questions as Array<Record<string, unknown>>) : [];
      questionCount += qs.length;
      // The mandatory closing block that asks where the work breaks.
      frontlineCount += qs.filter((q) => q?.["intent"] === "frontline_insight").length;
    }
  }

  const missingKinds = requiredKinds.filter((k) => !heldKinds.includes(k));
  const label = (k: string) =>
    k === "discussion_guide" ? "a discussion guide" : "a questionnaire";
  const instruments = stage(
    requiredKinds.length > 0 && missingKinds.length === 0,
    missingKinds.length > 0
      ? `The plan still needs ${missingKinds.map(label).join(" and ")} — the chamber drafts them on arrival.`
      : "No approved plan to draft instruments against.",
    {
      instruments: instrumentCount,
      required: requiredKinds.length,
      held: heldKinds.length,
      missing: missingKinds.length,
      questions: questionCount,
      frontline: frontlineCount,
    },
  );


  // ── Fieldwork ───────────────────────────────────────────────────────────
  // Complete means every wave the approved plan obliges has actually closed —
  // not merely that one return arrived from somewhere.
  let waveTotal = 0;
  let waveDone = 0;
  let nextMove = "Open the field.";
  let responses = 0;
  if (studyId) {
    const { loadFieldworkBoard } = await import("./fieldwork-plan.server");
    const board = await loadFieldworkBoard(supabase, {
      projectId,
      studyId,
      mailConfigured: false,
    });
    waveTotal = board.waves.length;
    waveDone = board.waves.filter((w) => w.status === "complete").length;
    responses = board.responseCount;
    nextMove = board.waves.find((w) => w.status !== "complete")?.next ?? nextMove;
  }
  const fieldwork = stage(
    waveTotal > 0 && waveDone === waveTotal,
    waveTotal === 0
      ? "The approved plan obliges no fieldwork — add a survey or session line to the method mix."
      : `${waveDone}/${waveTotal} waves complete — ${nextMove.toLowerCase()}.`,
    { waves: waveTotal, wavesComplete: waveDone, responses },
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

  const inputsUpdatedAt =
    inputStamps
      .filter((s): s is string => typeof s === "string" && s.length > 0)
      .sort()
      .at(-1) ?? null;

  return {
    studyId,
    fieldFinding,
    planActive,
    briefCommitted,
    inputsUpdatedAt,

    stages: {
      brief: stage(briefCommitted, "The source brief is not committed.", {
        committed: briefCommitted ? 1 : 0,
      }),
      plan: stage(planActive, "No approved programme plan yet.", {
        drafted: planDrafted ? 1 : 0,
        active: planActive ? 1 : 0,
      }),

      participants,
      instruments,
      fieldwork,
      evidence,
    },
  };
}
