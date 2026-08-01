// Chamber 07 · Stage 04 — the fielding plan.
//
// Server-only. Stage 04 never asks the admin to invent the work: the approved
// method mix already says what must be fielded, to whom, and at what size. This
// module turns that mix into an ordered set of *waves* — one hosted collection
// for the quantitative lines, one session wave per qualitative method — and
// reads the real artefacts back to say where each wave stands.

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import type { FieldQuestion, InstrumentKind } from "./instrument-draft.server";

type Db = SupabaseClient<Database>;

export type WaveKind = "collection" | "sessions";
export type SessionMethod =
  | "focus_group"
  | "depth_interview"
  | "expert_panel"
  | "workshop"
  | "other";

export interface FieldWave {
  /** Stable across reloads: "collection" or "sessions-<method>". */
  id: string;
  kind: WaveKind;
  /** The instrument this wave fields. */
  instrumentKind: InstrumentKind;
  /** For session waves, the field_sessions.method these sessions carry. */
  sessionMethod: SessionMethod | null;
  title: string;
  /** Plain-language statement of what this wave is for. */
  purpose: string;
  methods: string[];
  audiences: string[];
  target: number | null;
}

interface MethodLine {
  method?: string;
  audience?: string;
  objective?: string;
  instrument?: string;
  sample_size?: number;
}

const SURVEY_HINTS = ["survey", "poll", "cati", "questionnaire", "omnibus", "self_completion"];
const GUIDE_HINTS = [
  "interview",
  "depth",
  "focus",
  "group",
  "panel",
  "roundtable",
  "ethnograph",
  "workshop",
  "qualitative",
];
const NO_INSTRUMENT_HINTS = ["desk", "audit", "secondary", "analysis_of"];

const SESSION_LABEL: Record<SessionMethod, string> = {
  focus_group: "Focus groups",
  depth_interview: "Depth interviews",
  expert_panel: "Expert panel",
  workshop: "Workshops",
  other: "Sessions",
};

function titleCase(s: string): string {
  return s.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function sessionMethodFor(hay: string): SessionMethod {
  const h = hay.toLowerCase();
  if (h.includes("focus")) return "focus_group";
  if (h.includes("depth") || h.includes("interview") || h.includes("ethnograph")) {
    return "depth_interview";
  }
  if (h.includes("expert") || h.includes("roundtable") || h.includes("panel")) {
    return "expert_panel";
  }
  if (h.includes("workshop")) return "workshop";
  return "other";
}

/**
 * The waves this programme must field, derived from the approved method mix.
 * Quantitative lines collapse into one hosted collection; qualitative lines
 * group by the kind of session they imply, so the desk shows one card per real
 * piece of work rather than one per line of the plan.
 */
export function buildWaves(methodMix: unknown): FieldWave[] {
  const lines: MethodLine[] = Array.isArray(methodMix) ? (methodMix as MethodLine[]) : [];

  const survey = {
    methods: [] as string[],
    audiences: [] as string[],
    target: 0,
    seen: false,
  };
  const sessions = new Map<
    SessionMethod,
    { methods: string[]; audiences: string[]; target: number }
  >();

  for (const line of lines) {
    const hay = `${line.method ?? ""} ${line.instrument ?? ""}`.toLowerCase();
    if (!hay.trim()) continue;
    const isDesk =
      NO_INSTRUMENT_HINTS.some((h) => hay.includes(h)) &&
      !SURVEY_HINTS.some((h) => hay.includes(h)) &&
      !GUIDE_HINTS.some((h) => hay.includes(h));
    if (isDesk) continue;

    const size = typeof line.sample_size === "number" ? Math.max(0, line.sample_size) : 0;
    const audience = line.audience && line.audience !== "N/A" ? line.audience : null;

    if (SURVEY_HINTS.some((h) => hay.includes(h))) {
      survey.seen = true;
      if (line.method && !survey.methods.includes(line.method)) survey.methods.push(line.method);
      if (audience && !survey.audiences.includes(audience)) survey.audiences.push(audience);
      survey.target += size;
      continue;
    }
    if (GUIDE_HINTS.some((h) => hay.includes(h))) {
      const key = sessionMethodFor(hay);
      const entry = sessions.get(key) ?? { methods: [], audiences: [], target: 0 };
      if (line.method && !entry.methods.includes(line.method)) entry.methods.push(line.method);
      if (audience && !entry.audiences.includes(audience)) entry.audiences.push(audience);
      entry.target += size;
      sessions.set(key, entry);
    }
  }

  const waves: FieldWave[] = [];

  if (survey.seen || sessions.size === 0) {
    waves.push({
      id: "collection",
      kind: "collection",
      instrumentKind: "survey",
      sessionMethod: null,
      title: "Questionnaire",
      purpose: survey.audiences.length
        ? `Field the questionnaire to ${survey.audiences.join(", ")}.`
        : "Field the questionnaire to the recruited panel.",
      methods: survey.methods,
      audiences: survey.audiences,
      target: survey.target > 0 ? survey.target : null,
    });
  }

  for (const [method, entry] of sessions) {
    waves.push({
      id: `sessions-${method}`,
      kind: "sessions",
      instrumentKind: "discussion_guide",
      sessionMethod: method,
      title: SESSION_LABEL[method],
      purpose: entry.audiences.length
        ? `Hold ${SESSION_LABEL[method].toLowerCase()} with ${entry.audiences.join(", ")}.`
        : `Hold ${SESSION_LABEL[method].toLowerCase()} against the discussion guide.`,
      methods: entry.methods.length ? entry.methods : [titleCase(method)],
      audiences: entry.audiences,
      target: entry.target > 0 ? entry.target : null,
    });
  }

  return waves;
}

// ── Board ──────────────────────────────────────────────────────────────────

export interface WaveState {
  wave: FieldWave;
  /** not_started · fielding · complete */
  status: "not_started" | "fielding" | "complete";
  /** The one thing that moves this wave forward. */
  next: string;
  counts: Record<string, number>;
}

export interface BoardSession {
  id: string;
  title: string;
  method: string;
  status: string;
  scheduled_at: string | null;
  venue: string | null;
  join_url: string | null;
  moderator: string | null;
  hasTranscript: boolean;
  attendees: Array<{ contact_id: string; name: string; rsvp: string; attended: boolean | null }>;
}

export interface BoardSlate {
  id: string;
  name: string;
  description: string | null;
  members: Array<{ contact_id: string; name: string; organisation: string | null }>;
  /** A session already scheduled from this slate. */
  scheduledSessionId: string | null;
}

export interface BoardInvitation {
  id: string;
  status: string;
  token: string;
  participant_code: string | null;
  invited_at: string | null;
  opened_at: string | null;
  completed_at: string | null;
  reminder_count: number;
  name: string;
  email: string | null;
}

export interface FieldworkBoard {
  studyId: string;
  waves: WaveState[];
  collection: {
    id: string;
    status: string;
    access: string;
    public_token: string | null;
    target_n: number | null;
    instrument_id: string | null;
  } | null;
  invitations: BoardInvitation[];
  responseCount: number;
  instruments: Array<{ id: string; kind: string; title: string | null; questions: number }>;
  slates: BoardSlate[];
  sessions: BoardSession[];
  /** Accepted, non-opted-out people on this programme who are not yet invited. */
  uninvited: number;
  mailConfigured: boolean;
}

function hasTranscript(v: unknown): boolean {
  return typeof v === "string" && v.trim().length > 40;
}

export async function loadFieldworkBoard(
  supabase: Db,
  args: { projectId: string; studyId: string; mailConfigured: boolean },
): Promise<FieldworkBoard> {
  const { projectId, studyId } = args;

  const [{ data: plan }, { data: collections }, { data: instruments }, { data: sessionRows }] =
    await Promise.all([
      supabase
        .from("programme_plans")
        .select("method_mix")
        .eq("project_id", projectId)
        .eq("status", "active")
        .maybeSingle(),
      supabase
        .from("field_collections")
        .select("id,status,access,public_token,target_n,instrument_id,mode")
        .eq("study_id", studyId)
        .eq("mode", "hosted")
        .order("created_at", { ascending: false }),
      supabase.from("field_instruments").select("id,kind,title,questions").eq("study_id", studyId),
      supabase
        .from("field_sessions")
        .select("id,title,method,status,scheduled_at,venue,join_url,moderator,transcript,notes")
        .eq("study_id", studyId)
        .order("scheduled_at", { ascending: true }),
    ]);

  const waves = buildWaves(plan?.method_mix);
  const collection = (collections?.[0] ?? null) as FieldworkBoard["collection"];

  // Invitations + returns for the hosted collection.
  let invitations: BoardInvitation[] = [];
  let responseCount = 0;
  if (collection) {
    const [{ data: invites }, { count }] = await Promise.all([
      supabase
        .from("research_invitations")
        .select(
          "id,status,token,participant_code,contact_id,invited_at,opened_at,completed_at,reminder_count",
        )
        .eq("collection_id", collection.id)
        .order("created_at"),
      supabase
        .from("field_responses")
        .select("id", { count: "exact", head: true })
        .eq("collection_id", collection.id),
    ]);
    responseCount = count ?? 0;
    const ids = [...new Set((invites ?? []).map((i) => i.contact_id as string))];
    const people = new Map<string, { full_name: string; email: string | null }>();
    if (ids.length > 0) {
      const { data: cs } = await supabase
        .from("research_contacts")
        .select("id,full_name,email")
        .in("id", ids);
      for (const c of cs ?? []) {
        people.set(c.id as string, {
          full_name: c.full_name as string,
          email: (c.email as string | null) ?? null,
        });
      }
    }
    invitations = (invites ?? []).map((i) => ({
      id: i.id as string,
      status: i.status as string,
      token: i.token as string,
      participant_code: (i.participant_code as string | null) ?? null,
      invited_at: (i.invited_at as string | null) ?? null,
      opened_at: (i.opened_at as string | null) ?? null,
      completed_at: (i.completed_at as string | null) ?? null,
      reminder_count: (i.reminder_count as number | null) ?? 0,
      name: people.get(i.contact_id as string)?.full_name ?? "Unknown",
      email: people.get(i.contact_id as string)?.email ?? null,
    }));
  }

  // How many recruited people are still not invited.
  const { data: accepted } = await supabase
    .from("research_contacts")
    .select("id,opted_out_at,consent_status")
    .eq("project_id", projectId)
    .eq("status", "accepted")
    .limit(2_000);
  const invitedIds = new Set(invitations.map((i) => i.id));
  const eligible = (accepted ?? []).filter(
    (c) => !c.opted_out_at && c.consent_status !== "declined",
  );
  const invitedContacts = new Set(
    (invitations ?? []).map((i) => i.name), // names are not ids; recomputed below
  );
  void invitedIds;
  void invitedContacts;

  // Sessions + attendees.
  const list = sessionRows ?? [];
  let attendeeRows: Array<Record<string, unknown>> = [];
  if (list.length > 0) {
    const { data: att } = await supabase
      .from("field_session_attendees")
      .select("session_id,contact_id,rsvp,attended")
      .in(
        "session_id",
        list.map((s) => s.id as string),
      );
    attendeeRows = (att ?? []) as Array<Record<string, unknown>>;
  }
  const attendeeIds = [...new Set(attendeeRows.map((a) => a["contact_id"] as string))];

  // Composed slates from Stage 02.
  const { data: panelRows } = await supabase
    .from("research_panels")
    .select("id,name,description,kind")
    .eq("project_id", projectId)
    .eq("kind", "focus_group");
  const panelIds = (panelRows ?? []).map((p) => p.id as string);
  let memberRows: Array<{ panel_id: string; contact_id: string }> = [];
  if (panelIds.length > 0) {
    const { data: ms } = await supabase
      .from("research_panel_members")
      .select("panel_id,contact_id")
      .in("panel_id", panelIds);
    memberRows = (ms ?? []) as Array<{ panel_id: string; contact_id: string }>;
  }

  const nameIds = [...new Set([...attendeeIds, ...memberRows.map((m) => m.contact_id)])];
  const nameById = new Map<string, { name: string; organisation: string | null }>();
  if (nameIds.length > 0) {
    const { data: cs } = await supabase
      .from("research_contacts")
      .select("id,full_name,organisation")
      .in("id", nameIds);
    for (const c of cs ?? []) {
      nameById.set(c.id as string, {
        name: c.full_name as string,
        organisation: (c.organisation as string | null) ?? null,
      });
    }
  }

  const sessions: BoardSession[] = list.map((s) => ({
    id: s.id as string,
    title: s.title as string,
    method: s.method as string,
    status: s.status as string,
    scheduled_at: (s.scheduled_at as string | null) ?? null,
    venue: (s.venue as string | null) ?? null,
    join_url: (s.join_url as string | null) ?? null,
    moderator: (s.moderator as string | null) ?? null,
    hasTranscript: hasTranscript(s.transcript),
    attendees: attendeeRows
      .filter((a) => a["session_id"] === s.id)
      .map((a) => ({
        contact_id: a["contact_id"] as string,
        name: nameById.get(a["contact_id"] as string)?.name ?? "Unknown",
        rsvp: (a["rsvp"] as string) ?? "invited",
        attended: (a["attended"] as boolean | null) ?? null,
      })),
  }));

  const slates: BoardSlate[] = (panelRows ?? []).map((p) => {
    const members = memberRows
      .filter((m) => m.panel_id === (p.id as string))
      .map((m) => ({
        contact_id: m.contact_id,
        name: nameById.get(m.contact_id)?.name ?? "Unknown",
        organisation: nameById.get(m.contact_id)?.organisation ?? null,
      }));
    const scheduled = sessions.find((s) => s.title === (p.name as string));
    return {
      id: p.id as string,
      name: p.name as string,
      description: (p.description as string | null) ?? null,
      members,
      scheduledSessionId: scheduled?.id ?? null,
    };
  });

  // Uninvited = eligible people with no invitation on this collection.
  let uninvited = eligible.length;
  if (collection && eligible.length > 0) {
    const { data: invitedFor } = await supabase
      .from("research_invitations")
      .select("contact_id")
      .eq("collection_id", collection.id);
    const already = new Set((invitedFor ?? []).map((i) => i.contact_id as string));
    uninvited = eligible.filter((c) => !already.has(c.id as string)).length;
  }

  const waveStates: WaveState[] = waves.map((wave) => {
    if (wave.kind === "collection") {
      const target = wave.target ?? collection?.target_n ?? null;
      const returned = responseCount;
      const complete =
        collection?.status === "closed" || (target !== null && returned >= target) || false;
      const status: WaveState["status"] = !collection
        ? "not_started"
        : complete
          ? "complete"
          : "fielding";
      const next = !collection
        ? "Open the field"
        : invitations.length === 0
          ? "Invite the recruited panel"
          : returned === 0
            ? "Send the invitations, or import returns collected elsewhere"
            : target !== null && returned < target
              ? `${target - returned} more returns to reach target — remind the non-responders`
              : "Close the wave";
      return {
        wave,
        status,
        next,
        counts: {
          invited: invitations.length,
          opened: invitations.filter((i) => i.opened_at).length,
          returned,
          target: target ?? 0,
          uninvited,
        },
      };
    }

    const mine = sessions.filter((s) => s.method === wave.sessionMethod);
    const held = mine.filter((s) => s.status === "held");
    const captured = held.filter((s) => s.hasTranscript);
    const scheduled = mine.filter((s) => s.status === "scheduled");
    const complete = mine.length > 0 && scheduled.length === 0 && captured.length > 0;
    const status: WaveState["status"] =
      mine.length === 0 ? "not_started" : complete ? "complete" : "fielding";
    const next =
      mine.length === 0
        ? slates.length > 0
          ? "Schedule the composed slates"
          : "Schedule the first session"
        : scheduled.length > 0
          ? `Hold and mark ${scheduled.length} scheduled session${scheduled.length === 1 ? "" : "s"}`
          : captured.length < held.length
            ? "File the transcript for every session held"
            : "Wave complete";
    return {
      wave,
      status,
      next,
      counts: {
        sessions: mine.length,
        scheduled: scheduled.length,
        held: held.length,
        captured: captured.length,
        target: wave.target ?? 0,
      },
    };
  });

  return {
    studyId,
    waves: waveStates,
    collection,
    invitations,
    responseCount,
    instruments: (instruments ?? []).map((i) => ({
      id: i.id as string,
      kind: i.kind as string,
      title: (i.title as string | null) ?? null,
      questions: Array.isArray(i.questions) ? (i.questions as FieldQuestion[]).length : 0,
    })),
    slates,
    sessions,
    uninvited,
    mailConfigured: args.mailConfigured,
  };
}
