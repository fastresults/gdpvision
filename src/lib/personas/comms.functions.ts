// @domain personas
// @tables comms_templates,comms_log,research_contacts,research_invitations,field_sessions,studies,persona_projects
// @ui src/components/personas/field/CommsPanel.tsx

// Chamber 07 · Participant communications — invites, reminders, confirmations,
// thank-yous. Drafted by AI from the programme brief and the study's purpose,
// edited by a human, and logged on every send.
//
// Consent is enforced here: an opted-out or declined contact is never sent to,
// regardless of what the caller asks for. Every message carries an opt-out
// link built from the recipient's own invitation token.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { deriveJson } from "./field-ai.server";
import { deliver, firstName, merge } from "./comms-delivery.server";


export const COMMS_PURPOSES = [
  "invite",
  "reminder",
  "confirmation",
  "thank_you",
  "follow_up",
] as const;

const PURPOSE_INTENT: Record<(typeof COMMS_PURPOSES)[number], string> = {
  invite: "a first approach asking this person to take part",
  reminder: "a polite nudge to someone who was invited but has not yet responded",
  confirmation: "confirming a scheduled session, with the practical details",
  thank_you: "thanking a participant after they have taken part",
  follow_up: "following up after participation, e.g. sharing findings or asking one more thing",
};

interface DraftMessage {
  subject: string;
  body: string;
}

function isDraft(v: unknown): v is DraftMessage {
  const d = v as Partial<DraftMessage> | null;
  return !!d && typeof d.subject === "string" && typeof d.body === "string" && d.body.length > 20;
}

// ── Templates ──────────────────────────────────────────────────────────────

export const listTemplates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        countryCode: z.string(),
        projectId: z.string().uuid().nullish(),
        studyId: z.string().uuid().nullish(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("comms_templates")
      .select("*")
      .eq("country_code", data.countryCode)
      .order("created_at", { ascending: false });
    if (data.studyId) q = q.eq("study_id", data.studyId);
    else if (data.projectId) q = q.eq("project_id", data.projectId);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const draftTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        countryCode: z.string(),
        projectId: z.string().uuid().nullish(),
        studyId: z.string().uuid().nullish(),
        purpose: z.enum(COMMS_PURPOSES),
        steering: z.string().max(2_000).nullish(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    let briefBlock = "";
    if (data.projectId) {
      const { data: project } = await supabase
        .from("persona_projects")
        .select("title,brief_raw,brief_scope")
        .eq("id", data.projectId)
        .maybeSingle();
      if (project) {
        briefBlock = `PROGRAMME: ${project.title}\nBRIEF: ${(project.brief_raw ?? "").slice(0, 4_000)}\nSCOPE: ${JSON.stringify(project.brief_scope ?? {}).slice(0, 2_000)}`;
      }
    }
    let studyBlock = "";
    if (data.studyId) {
      const { data: study } = await supabase
        .from("studies")
        .select("title,objective,method")
        .eq("id", data.studyId)
        .maybeSingle();
      if (study) {
        studyBlock = `STUDY: ${study.title}\nOBJECTIVE: ${study.objective ?? ""}\nMETHOD: ${study.method ?? ""}`;
      }
    }

    const system = `You write participant recruitment communications for government-commissioned research. Your tone is courteous, plain, specific and non-coercive. You never overstate incentives, never imply obligation, and always make clear what the person's input will be used for and that they may decline.

Available merge fields — use only these, exactly as written: {{first_name}}, {{full_name}}, {{organisation}}, {{programme}}, {{study}}, {{survey_link}}, {{session_time}}, {{session_venue}}, {{opt_out_link}}.
The body MUST end with an opt-out line containing {{opt_out_link}}.`;

    const user = `${briefBlock}

${studyBlock}

COUNTRY: ${data.countryCode}
MESSAGE PURPOSE: ${data.purpose} — ${PURPOSE_INTENT[data.purpose]}
${data.steering ? `\nSTEERING: ${data.steering}` : ""}

Return JSON: {"subject":"...","body":"plain-text email body with merge fields"}`;

    const draft = await deriveJson<DraftMessage>({ system, user, validate: isDraft });
    const body = draft.body.includes("{{opt_out_link}}")
      ? draft.body
      : `${draft.body}\n\nIf you would prefer not to hear from us about research, you can opt out here: {{opt_out_link}}`;

    const { data: row, error } = await supabase
      .from("comms_templates")
      .insert({
        country_code: data.countryCode,
        project_id: data.projectId ?? null,
        study_id: data.studyId ?? null,
        purpose: data.purpose,
        channel: "email",
        subject: draft.subject,
        body,
        generated_by: "ai",
        created_by: userId,
      } as never)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const saveTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        subject: z.string().max(300).nullish(),
        body: z.string().max(20_000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("comms_templates")
      .update({
        subject: data.subject ?? null,
        body: data.body,
        generated_by: "human",
      } as never)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const deleteTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("comms_templates").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

// ── Merge + send ───────────────────────────────────────────────────────────
// Delivery and the merge grammar live in comms-delivery.server.ts so the send
// path is shared with the fieldwork desk and this file stays a thin wrapper.


export const sendToInvitees = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        templateId: z.string().uuid(),
        invitationIds: z.array(z.string().uuid()).min(1).max(1_000),
        origin: z.string().url().max(300),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: template } = await supabase
      .from("comms_templates")
      .select("*")
      .eq("id", data.templateId)
      .maybeSingle();
    if (!template) throw new Error("Template not found");

    const { data: invites } = await supabase
      .from("research_invitations")
      .select("id,contact_id,token,status,study_id,country_code,reminder_count")
      .in("id", data.invitationIds);
    if (!invites?.length) throw new Error("No invitations selected");

    const { data: contacts } = await supabase
      .from("research_contacts")
      .select("id,full_name,email,organisation,opted_out_at,consent_status")
      .in(
        "id",
        invites.map((i) => i.contact_id as string),
      );
    type C = {
      id: string;
      full_name: string;
      email: string | null;
      organisation: string | null;
      opted_out_at: string | null;
      consent_status: string;
    };
    const byId = new Map<string, C>(((contacts ?? []) as C[]).map((c) => [c.id, c]));

    let programme = "";
    let study = "";
    if (template.study_id) {
      const { data: s } = await supabase
        .from("studies")
        .select("title,project_id")
        .eq("id", template.study_id as string)
        .maybeSingle();
      study = (s?.title as string) ?? "";
      if (s?.project_id) {
        const { data: p } = await supabase
          .from("persona_projects")
          .select("title")
          .eq("id", s.project_id as string)
          .maybeSingle();
        programme = (p?.title as string) ?? "";
      }
    }

    let sent = 0;
    let queued = 0;
    let skipped = 0;

    for (const inv of invites) {
      const c = byId.get(inv.contact_id as string);
      if (!c || !c.email || c.opted_out_at || c.consent_status === "declined") {
        skipped += 1;
        continue;
      }
      const vars = {
        first_name: firstName(c.full_name),
        full_name: c.full_name,
        organisation: c.organisation ?? "",
        programme,
        study,
        survey_link: `${data.origin}/f/${inv.token as string}`,
        opt_out_link: `${data.origin}/f/${inv.token as string}?opt_out=1`,
        session_time: "",
        session_venue: "",
      };
      const subject = merge((template.subject as string) ?? "", vars);
      const body = merge((template.body as string) ?? "", vars);

      const result = await deliver({ to: c.email, subject, body });
      if (result.status === "sent") sent += 1;
      else queued += 1;

      await supabase.from("comms_log").insert({
        country_code: inv.country_code as string,
        contact_id: c.id,
        study_id: (inv.study_id as string | null) ?? null,
        invitation_id: inv.id as string,
        template_id: data.templateId,
        purpose: template.purpose as string,
        channel: "email",
        to_address: c.email,
        subject,
        body,
        status: result.status,
        error: result.error,
        sent_at: result.status === "sent" ? new Date().toISOString() : null,
        sent_by: userId,
      } as never);

      const patch: Record<string, unknown> = { };
      if (template.purpose === "reminder") {
        patch.reminder_count = ((inv.reminder_count as number) ?? 0) + 1;
      } else if (inv.status === "pending") {
        patch.status = "invited";
        patch.invited_at = new Date().toISOString();
      }
      if (Object.keys(patch).length > 0) {
        await supabase.from("research_invitations").update(patch as never).eq("id", inv.id as string);
      }
      await supabase
        .from("research_contacts")
        .update({ last_contacted_at: new Date().toISOString() } as never)
        .eq("id", c.id);
    }

    return { sent, queued, skipped, providerConfigured: !!process.env.RESEND_API_KEY };
  });

export const listCommsLog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        countryCode: z.string(),
        studyId: z.string().uuid().nullish(),
        limit: z.number().int().max(500).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("comms_log")
      .select("id,purpose,to_address,subject,status,error,sent_at,created_at,contact_id")
      .eq("country_code", data.countryCode)
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 200);
    if (data.studyId) q = q.eq("study_id", data.studyId);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });
