// @domain personas
// @tables field_sessions,field_session_attendees,research_contacts,studies
// @ui src/components/personas/field/SessionsBoard.tsx

// Chamber 07 · Field sessions — focus groups, depth interviews and expert
// panels: scheduling, attendance, recording, transcript, corpus write-back.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listSessions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ studyId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: sessions, error } = await supabase
      .from("field_sessions")
      .select("*")
      .eq("study_id", data.studyId)
      .order("scheduled_at", { ascending: true });
    if (error) throw new Error(error.message);
    const list = sessions ?? [];
    if (list.length === 0) return [];

    const { data: attendees } = await supabase
      .from("field_session_attendees")
      .select("session_id,contact_id,participant_code,rsvp,attended")
      .in(
        "session_id",
        list.map((s) => s.id as string),
      );

    const contactIds = [...new Set((attendees ?? []).map((a) => a.contact_id as string))];
    type Person = { id: string; full_name: string; organisation: string | null };
    let people: Person[] = [];
    if (contactIds.length > 0) {
      const { data: cs } = await supabase
        .from("research_contacts")
        .select("id,full_name,organisation")
        .in("id", contactIds);
      people = (cs ?? []) as Person[];
    }
    const byId = new Map<string, Person>(people.map((p) => [p.id, p]));

    return list.map((s) => ({
      ...s,
      attendees: (attendees ?? [])
        .filter((a) => a.session_id === s.id)
        .map((a) => ({
          contact_id: a.contact_id as string,
          participant_code: (a.participant_code as string | null) ?? null,
          rsvp: a.rsvp as string,
          attended: (a.attended as boolean | null) ?? null,
          name: byId.get(a.contact_id as string)?.full_name ?? "Unknown",
          organisation: byId.get(a.contact_id as string)?.organisation ?? null,
        })),
    }));
  });

export const upsertSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid().nullish(),
        studyId: z.string().uuid(),
        title: z.string().trim().min(1).max(240),
        method: z.enum(["focus_group", "depth_interview", "expert_panel", "workshop", "other"]).optional(),
        scheduled_at: z.string().nullish(),
        duration_minutes: z.number().int().min(5).max(1_440).nullish(),
        venue: z.string().max(400).nullish(),
        join_url: z.string().max(1_000).nullish(),
        moderator: z.string().max(200).nullish(),
        status: z.enum(["scheduled", "held", "cancelled"]).optional(),
        notes: z.string().max(20_000).nullish(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: study } = await supabase
      .from("studies")
      .select("country_code")
      .eq("id", data.studyId)
      .maybeSingle();
    if (!study) throw new Error("Study not found");

    const payload = {
      study_id: data.studyId,
      country_code: study.country_code as string,
      title: data.title,
      method: data.method ?? "focus_group",
      scheduled_at: data.scheduled_at ?? null,
      duration_minutes: data.duration_minutes ?? null,
      venue: data.venue ?? null,
      join_url: data.join_url ?? null,
      moderator: data.moderator ?? null,
      status: data.status ?? "scheduled",
      notes: data.notes ?? null,
    };

    if (data.id) {
      const { error } = await supabase
        .from("field_sessions")
        .update(payload as never)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: row, error } = await supabase
      .from("field_sessions")
      .insert(payload as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("field_sessions").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const setSessionAttendees = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        sessionId: z.string().uuid(),
        countryCode: z.string(),
        contactIds: z.array(z.string().uuid()).max(200),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    // Consent gate — opted-out people are never added to a session.
    const { data: contacts } = await supabase
      .from("research_contacts")
      .select("id,opted_out_at,consent_status")
      .in("id", data.contactIds.length ? data.contactIds : ["00000000-0000-0000-0000-000000000000"]);
    const eligible = (contacts ?? [])
      .filter((c) => !c.opted_out_at && c.consent_status !== "declined")
      .map((c) => c.id as string);

    await supabase.from("field_session_attendees").delete().eq("session_id", data.sessionId);
    if (eligible.length > 0) {
      const { error } = await supabase.from("field_session_attendees").insert(
        eligible.map((cid, i) => ({
          session_id: data.sessionId,
          contact_id: cid,
          country_code: data.countryCode,
          participant_code: `P-${String(i + 1).padStart(4, "0")}`,
          rsvp: "invited",
        })) as never,
      );
      if (error) throw new Error(error.message);
    }
    return { added: eligible.length, skipped: data.contactIds.length - eligible.length };
  });

export const setAttendance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        sessionId: z.string().uuid(),
        contactId: z.string().uuid(),
        rsvp: z.enum(["invited", "accepted", "declined"]).optional(),
        attended: z.boolean().nullish(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const patch: Record<string, unknown> = {};
    if (data.rsvp) patch.rsvp = data.rsvp;
    if (data.attended !== undefined) patch.attended = data.attended;
    if (Object.keys(patch).length === 0) return { ok: true as const };
    const { error } = await context.supabase
      .from("field_session_attendees")
      .update(patch as never)
      .eq("session_id", data.sessionId)
      .eq("contact_id", data.contactId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/**
 * Attach a transcript (typed, uploaded, or produced by transcription) and
 * push it straight into the second brain against the briefed programme.
 */
export const attachSessionTranscript = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        sessionId: z.string().uuid(),
        transcript: z.string().min(1).max(400_000),
        recordingPath: z.string().max(600).nullish(),
        ingest: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: session, error } = await supabase
      .from("field_sessions")
      .update({
        transcript: data.transcript,
        recording_path: data.recordingPath ?? null,
        status: "held",
      } as never)
      .eq("id", data.sessionId)
      .select("id,study_id,title,scheduled_at,notes")
      .single();
    if (error) throw new Error(error.message);

    if (data.ingest === false) return { ok: true as const, memoryId: null };

    const { data: attendees } = await supabase
      .from("field_session_attendees")
      .select("participant_code")
      .eq("session_id", data.sessionId);

    const { buildFieldTag, ingestSessionToCorpus } = await import("./field-corpus.server");
    const tag = await buildFieldTag(session.study_id as string);
    const res = await ingestSessionToCorpus({
      tag,
      sessionId: session.id as string,
      sessionTitle: session.title as string,
      scheduledAt: (session.scheduled_at as string | null) ?? null,
      transcript: data.transcript,
      notes: (session.notes as string | null) ?? null,
      participantCodes: (attendees ?? [])
        .map((a) => (a.participant_code as string | null) ?? "")
        .filter(Boolean),
    });
    return { ok: true as const, memoryId: res?.id ?? null };
  });
