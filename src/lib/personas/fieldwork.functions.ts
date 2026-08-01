// @domain personas
// @tables field_collections,research_invitations,research_contacts,field_sessions,field_session_attendees,research_panels,research_panel_members,comms_log,studies,programme_plans
// @ui src/components/personas/field/FieldworkStage.tsx

// Chamber 07 · Stage 04 — the field desk.
//
// One read for the whole stage (the fielding plan plus every artefact behind
// it) and one server function per real action: open a wave, invite the people
// already recruited, actually send, remind the silent, schedule a composed
// slate, close a wave. Nothing here asks the admin to invent work the approved
// plan has already specified.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getFieldworkBoard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ projectId: z.string().uuid(), studyId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { loadFieldworkBoard } = await import("./fieldwork-plan.server");
    const { mailConfigured } = await import("./comms-delivery.server");
    return loadFieldworkBoard(context.supabase, {
      projectId: data.projectId,
      studyId: data.studyId,
      mailConfigured: mailConfigured(),
    });
  });

/** Open the hosted collection for the questionnaire wave. */
export const openWave = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        studyId: z.string().uuid(),
        targetN: z.number().int().min(1).max(1_000_000).nullish(),
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

    const { data: instruments } = await supabase
      .from("field_instruments")
      .select("id,kind")
      .eq("study_id", data.studyId);
    const instrumentId =
      (instruments ?? []).find((i) => i.kind === "survey")?.id ??
      (instruments ?? [])[0]?.id ??
      null;
    if (!instrumentId) {
      throw new Error("No instrument drafted yet — go back to Instruments first.");
    }

    const { data: existing } = await supabase
      .from("field_collections")
      .select("id")
      .eq("study_id", data.studyId)
      .eq("mode", "hosted")
      .maybeSingle();

    const patch = {
      instrument_id: instrumentId as string,
      access: "invited",
      status: "open",
      target_n: data.targetN ?? null,
      opens_at: new Date().toISOString(),
    };

    if (existing?.id) {
      const { error } = await supabase
        .from("field_collections")
        .update(patch as never)
        .eq("id", existing.id as string);
      if (error) throw new Error(error.message);
      return { id: existing.id as string };
    }

    const bytes = new Uint8Array(18);
    crypto.getRandomValues(bytes);
    const token = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");

    const { data: row, error } = await supabase
      .from("field_collections")
      .insert({
        study_id: data.studyId,
        country_code: study.country_code as string,
        mode: "hosted",
        public_token: token,
        ...patch,
      } as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id as string };
  });

/**
 * Issue an invitation to every recruited participant on this programme who has
 * not got one yet. Consent is enforced here, not in the UI.
 */
export const inviteWave = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ collectionId: z.string().uuid(), projectId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: collection } = await supabase
      .from("field_collections")
      .select("id,study_id,country_code")
      .eq("id", data.collectionId)
      .maybeSingle();
    if (!collection) throw new Error("Collection not found");

    const { data: people } = await supabase
      .from("research_contacts")
      .select("id,opted_out_at,consent_status")
      .eq("project_id", data.projectId)
      .eq("status", "accepted")
      .limit(2_000);
    const eligible = (people ?? []).filter(
      (c) => !c.opted_out_at && c.consent_status !== "declined",
    );
    if (eligible.length === 0) {
      return {
        ok: false as const,
        issued: 0,
        message: "No accepted participants yet — accept a slate in Participants first.",
      };
    }

    const { data: already } = await supabase
      .from("research_invitations")
      .select("contact_id")
      .eq("collection_id", data.collectionId);
    const have = new Set((already ?? []).map((i) => i.contact_id as string));
    const todo = eligible.filter((c) => !have.has(c.id as string));

    let seq = have.size;
    let issued = 0;
    for (const person of todo) {
      seq += 1;
      const bytes = new Uint8Array(18);
      crypto.getRandomValues(bytes);
      const token = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
      const { error } = await supabase.from("research_invitations").insert({
        country_code: collection.country_code as string,
        study_id: collection.study_id as string,
        collection_id: data.collectionId,
        contact_id: person.id as string,
        token,
        participant_code: `P-${String(seq).padStart(4, "0")}`,
        status: "pending",
      } as never);
      if (!error) issued += 1;
    }

    return {
      ok: true as const,
      issued,
      message:
        issued === 0
          ? "Everyone recruited already holds an invitation."
          : `${issued} invitation${issued === 1 ? "" : "s"} issued.`,
    };
  });

/**
 * Actually send. Composes from the programme's own words, logs every message,
 * and reports honestly when no mail provider is configured — a "ready" message
 * is composed and logged but not dispatched.
 */
export const sendWaveInvites = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        collectionId: z.string().uuid(),
        origin: z.string().url().max(300),
        purpose: z.enum(["invite", "reminder"]).default("invite"),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { deliver, firstName } = await import("./comms-delivery.server");
    // The participant-facing host is resolved here, never trusted from the
    // browser: an admin working in the editor preview would otherwise issue
    // links that ask a member of the public to sign in.
    const publicOrigin = serverPublicOrigin(data.origin);

    const { data: collection } = await supabase
      .from("field_collections")
      .select("id,study_id,country_code")
      .eq("id", data.collectionId)
      .maybeSingle();
    if (!collection) throw new Error("Collection not found");

    const { data: study } = await supabase
      .from("studies")
      .select("title,objective,project_id")
      .eq("id", collection.study_id as string)
      .maybeSingle();
    let programme = (study?.title as string) ?? "a national research programme";
    if (study?.project_id) {
      const { data: p } = await supabase
        .from("persona_projects")
        .select("title")
        .eq("id", study.project_id as string)
        .maybeSingle();
      if (p?.title) programme = p.title as string;
    }

    const { data: invites } = await supabase
      .from("research_invitations")
      .select("id,contact_id,token,status,reminder_count,completed_at")
      .eq("collection_id", data.collectionId);
    const pool = (invites ?? []).filter((i) =>
      data.purpose === "reminder" ? !i.completed_at : i.status === "pending",
    );
    if (pool.length === 0) {
      return {
        sent: 0,
        ready: 0,
        skipped: 0,
        mailConfigured: !!process.env.RESEND_API_KEY && !!process.env.RESEARCH_FROM_EMAIL,
        message:
          data.purpose === "reminder"
            ? "Nobody is outstanding — every invitation has been returned."
            : "Everyone invited has already been written to.",
      };
    }

    const { data: contacts } = await supabase
      .from("research_contacts")
      .select("id,full_name,email,opted_out_at,consent_status")
      .in(
        "id",
        pool.map((i) => i.contact_id as string),
      );
    const byId = new Map(
      (contacts ?? []).map((c) => [
        c.id as string,
        c as {
          id: string;
          full_name: string;
          email: string | null;
          opted_out_at: string | null;
          consent_status: string;
        },
      ]),
    );

    let sent = 0;
    let ready = 0;
    let skipped = 0;

    for (const inv of pool) {
      const c = byId.get(inv.contact_id as string);
      if (!c || !c.email || c.opted_out_at || c.consent_status === "declined") {
        skipped += 1;
        continue;
      }
      const link = participantLink(publicOrigin, inv.token as string);
      const subject =
        data.purpose === "reminder"
          ? `A reminder — ${programme}`
          : `Your voice is asked for — ${programme}`;
      const body =
        data.purpose === "reminder"
          ? `Dear ${firstName(c.full_name)},\n\nA short while ago you were asked to take part in ${programme}. Your answers are still wanted and the questionnaire takes only a few minutes.\n\n${link}\n\nIf you would rather not be contacted again, use ${link}?opt_out=1 and we will not write to you.\n\nWith thanks,\nThe research team`
          : `Dear ${firstName(c.full_name)},\n\nYou have been selected to take part in ${programme}${study?.objective ? ` — ${String(study.objective).slice(0, 240)}` : ""}.\n\nYour answers are confidential and reported only in aggregate. The questionnaire takes a few minutes:\n\n${link}\n\nIf you would rather not take part, use ${link}?opt_out=1 and we will not write to you again.\n\nWith thanks,\nThe research team`;

      const result = await deliver({ to: c.email, subject, body });
      if (result.status === "sent") sent += 1;
      else ready += 1;

      await supabase.from("comms_log").insert({
        country_code: collection.country_code as string,
        contact_id: c.id,
        study_id: collection.study_id as string,
        invitation_id: inv.id as string,
        purpose: data.purpose === "reminder" ? "reminder" : "invite",
        channel: "email",
        to_address: c.email,
        subject,
        body,
        status: result.status,
        error: result.error,
        sent_at: result.status === "sent" ? new Date().toISOString() : null,
        sent_by: userId,
      } as never);

      const patch: Record<string, unknown> =
        data.purpose === "reminder"
          ? { reminder_count: ((inv.reminder_count as number) ?? 0) + 1 }
          : { status: "invited", invited_at: new Date().toISOString() };
      await supabase
        .from("research_invitations")
        .update(patch as never)
        .eq("id", inv.id as string);
      await supabase
        .from("research_contacts")
        .update({ last_contacted_at: new Date().toISOString() } as never)
        .eq("id", c.id);
    }

    const mailConfigured = !!process.env.RESEND_API_KEY && !!process.env.RESEARCH_FROM_EMAIL;
    return {
      sent,
      ready,
      skipped,
      mailConfigured,
      message: mailConfigured
        ? `${sent} sent${skipped ? `, ${skipped} skipped on consent` : ""}.`
        : `${ready} message${ready === 1 ? "" : "s"} composed and logged, but no mail provider is configured — copy the links or export them instead.`,
    };
  });

/** Schedule a session from a slate composed in Participants, seating everyone. */
export const scheduleFromSlate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        studyId: z.string().uuid(),
        slateId: z.string().uuid().nullish(),
        title: z.string().trim().min(1).max(240),
        method: z
          .enum(["focus_group", "depth_interview", "expert_panel", "workshop", "other"])
          .default("focus_group"),
        scheduled_at: z.string().nullish(),
        venue: z.string().max(400).nullish(),
        join_url: z.string().max(1_000).nullish(),
        moderator: z.string().max(200).nullish(),
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
    const countryCode = study.country_code as string;

    const { data: session, error } = await supabase
      .from("field_sessions")
      .insert({
        study_id: data.studyId,
        country_code: countryCode,
        title: data.title,
        method: data.method,
        scheduled_at: data.scheduled_at ?? null,
        venue: data.venue ?? null,
        join_url: data.join_url ?? null,
        moderator: data.moderator ?? null,
        status: "scheduled",
      } as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    let seated = 0;
    if (data.slateId) {
      const { data: members } = await supabase
        .from("research_panel_members")
        .select("contact_id")
        .eq("panel_id", data.slateId);
      const ids = (members ?? []).map((m) => m.contact_id as string);
      if (ids.length > 0) {
        const { data: people } = await supabase
          .from("research_contacts")
          .select("id,opted_out_at,consent_status")
          .in("id", ids);
        const eligible = (people ?? [])
          .filter((c) => !c.opted_out_at && c.consent_status !== "declined")
          .map((c) => c.id as string);
        if (eligible.length > 0) {
          await supabase.from("field_session_attendees").insert(
            eligible.map((cid, i) => ({
              session_id: session.id as string,
              contact_id: cid,
              country_code: countryCode,
              participant_code: `P-${String(i + 1).padStart(4, "0")}`,
              rsvp: "invited",
            })) as never,
          );
          seated = eligible.length;
        }
      }
    }

    return { id: session.id as string, seated };
  });

/** Close a wave: the hosted collection stops accepting returns. */
export const closeWave = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({ collectionId: z.string().uuid(), reason: z.string().max(600).nullish() })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("field_collections")
      .update({ status: "closed", closes_at: new Date().toISOString() } as never)
      .eq("id", data.collectionId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
