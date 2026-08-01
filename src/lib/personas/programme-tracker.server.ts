// @domain personas
// @tables programme_team,programme_plans,programme_phases,programme_milestones,programme_deliverables,studies,field_collections,field_responses,field_sessions
// @ui src/components/personas/field/tracker/TrackerModal.tsx
//
// Chamber 07 · The internal tracker's reads and writes. Everything the board
// shows comes from one query, so a status change is never half-applied across
// two views of the same programme.

import type { SupabaseClient } from "@supabase/supabase-js";

import type { TrackerData, TrackerItem, TrackerNote } from "./tracker-shared";

type DB = SupabaseClient<any, any, any>;

function notesOf(v: unknown): TrackerNote[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((n): n is Record<string, unknown> => !!n && typeof n === "object")
    .map((n) => ({ at: String(n["at"] ?? ""), body: String(n["body"] ?? "") }))
    .filter((n) => n.body.length > 0);
}

export async function readTracker(supabase: DB, projectId: string): Promise<TrackerData> {
  const { data: planRows, error: planErr } = await supabase
    .from("programme_plans")
    .select("id,status,version")
    .eq("project_id", projectId)
    .order("version", { ascending: false })
    .limit(1);
  if (planErr) throw new Error(planErr.message);
  const planId = (planRows?.[0]?.id as string | undefined) ?? null;

  const { data: team } = await supabase
    .from("programme_team")
    .select("id,name,email,role")
    .eq("project_id", projectId)
    .order("created_at");

  const empty: TrackerData = {
    planId,
    team: (team ?? []) as TrackerData["team"],
    items: [],
    field: { collections: 0, open: 0, responses: 0, sessions: 0, held: 0 },
  };
  if (!planId) return empty;

  const [{ data: phases }, { data: milestones }, { data: deliverables }] = await Promise.all([
    supabase.from("programme_phases").select("id,name,position").eq("plan_id", planId),
    supabase.from("programme_milestones").select("*").eq("plan_id", planId).order("due_on"),
    supabase.from("programme_deliverables").select("*").eq("plan_id", planId).order("due_on"),
  ]);

  const phaseName = new Map<string, string>();
  for (const p of phases ?? []) phaseName.set(p.id as string, p.name as string);

  const items: TrackerItem[] = [
    ...(milestones ?? []).map((m: Record<string, any>) => ({
      id: m["id"] as string,
      kind: "milestone" as const,
      title: m["title"] as string,
      detail: (m["detail"] as string) ?? null,
      phase: m["phase_id"] ? (phaseName.get(m["phase_id"] as string) ?? null) : null,
      dueOn: (m["due_on"] as string) ?? null,
      status: (m["status"] as string) ?? "planned",
      assigneeId: (m["assignee_id"] as string) ?? null,
      blockedReason: (m["blocked_reason"] as string) ?? null,
      notes: notesOf(m["notes"]),
    })),
    ...(deliverables ?? []).map((d: Record<string, any>) => ({
      id: d["id"] as string,
      kind: "deliverable" as const,
      title: d["title"] as string,
      detail: (d["detail"] as string) ?? null,
      phase: (d["kind"] as string) ?? null,
      dueOn: (d["due_on"] as string) ?? null,
      status: (d["status"] as string) ?? "planned",
      assigneeId: (d["assignee_id"] as string) ?? null,
      blockedReason: (d["blocked_reason"] as string) ?? null,
      notes: notesOf(d["notes"]),
    })),
  ];

  // Fieldwork reality, counted rather than asserted.
  const field = { collections: 0, open: 0, responses: 0, sessions: 0, held: 0 };
  const { data: studies } = await supabase
    .from("studies")
    .select("id")
    .eq("project_id", projectId)
    .limit(1);
  const studyId = studies?.[0]?.id as string | undefined;
  if (studyId) {
    const [cols, sessions] = await Promise.all([
      supabase.from("field_collections").select("id,status").eq("study_id", studyId),
      supabase.from("field_sessions").select("id,status").eq("study_id", studyId),
    ]);
    const collections = (cols.data ?? []) as { id: string; status: string }[];
    field.collections = collections.length;
    field.open = collections.filter((c) => c.status === "open").length;
    const sess = (sessions.data ?? []) as { status: string }[];
    field.sessions = sess.length;
    field.held = sess.filter((s) => s.status === "held" || s.status === "complete").length;
    if (collections.length) {
      const { count } = await supabase
        .from("field_responses")
        .select("id", { count: "exact", head: true })
        .in(
          "collection_id",
          collections.map((c) => c.id),
        );
      field.responses = count ?? 0;
    }
  }

  return { planId, team: (team ?? []) as TrackerData["team"], items, field };
}

export async function writeItem(
  supabase: DB,
  args: {
    kind: "milestone" | "deliverable";
    itemId: string;
    status?: string | null;
    assigneeId?: string | null;
    blockedReason?: string | null;
    dueOn?: string | null;
    note?: string | null;
  },
): Promise<void> {
  const table = args.kind === "milestone" ? "programme_milestones" : "programme_deliverables";
  const patch: Record<string, unknown> = {};
  if (args.status !== undefined && args.status !== null) patch["status"] = args.status;
  if (args.assigneeId !== undefined) patch["assignee_id"] = args.assigneeId;
  if (args.blockedReason !== undefined) patch["blocked_reason"] = args.blockedReason;
  if (args.dueOn !== undefined) patch["due_on"] = args.dueOn;

  if (args.note && args.note.trim()) {
    const { data: row } = await supabase.from(table).select("notes").eq("id", args.itemId).single();
    const existing = notesOf((row as { notes?: unknown } | null)?.notes);
    patch["notes"] = [...existing, { at: new Date().toISOString(), body: args.note.trim() }];
  }
  if (Object.keys(patch).length === 0) return;
  const { error } = await supabase.from(table).update(patch).eq("id", args.itemId);
  if (error) throw new Error(error.message);
}
