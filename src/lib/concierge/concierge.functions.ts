// Concierge server functions. All requester-facing text passes through the
// minister lexicon scrubber. Uses `requireSupabaseAuth` (RLS enforces
// per-country and per-role access).

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  enforceMinisterLexicon,
  scrubMinisterPayload,
  LEXICON,
  type ChamberId,
} from "./minister-lexicon";

const chamberEnum = z.enum([
  "ledger",
  "portfolio",
  "scenario",
  "fdi",
  "narrative",
  "cabinet",
  "persona",
]);

const channelEnum = z.enum(["typed", "pasted", "voice"]);

const requestCardSchema = z.object({
  question: z.string().max(600).default(""),
  why_it_matters: z.string().max(1200).default(""),
  deliverable_shape: z.string().max(200).default(""),
  built_on: z.array(z.string().max(240)).max(6).default([]),
  when_needed: z.string().max(80).default(""),
});
export type RequestCard = z.infer<typeof requestCardSchema>;

const attachmentSchema = z.object({
  path: z.string(),
  name: z.string(),
  size: z.number().optional(),
  content_type: z.string().optional(),
  summary: z.string().max(600).optional(),
});
export type Attachment = z.infer<typeof attachmentSchema>;

const saveDraftSchema = z.object({
  country_code: z.string().min(2).max(8),
  step: z.number().int().min(1).max(5).default(1),
  raw_text: z.string().max(20000).optional().default(""),
  channel: channelEnum.optional(),
  minister_summary: z.string().max(2000).optional().default(""),
  request_card: requestCardSchema.optional().default({
    question: "",
    why_it_matters: "",
    deliverable_shape: "",
    built_on: [],
    when_needed: "",
  }),
  internal_chamber: chamberEnum.optional(),
  chamber_confidence: z.number().min(0).max(1).optional(),
  attachments: z.array(attachmentSchema).max(20).optional().default([]),
});
export type SaveDraftInput = z.infer<typeof saveDraftSchema>;

export const getMyDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ country_code: z.string() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase
      .from("service_request_drafts")
      .select("*")
      .eq("user_id", context.userId)
      .eq("country_code", data.country_code)
      .maybeSingle();
    return row ?? null;
  });

export const saveDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => saveDraftSchema.parse(input))
  .handler(async ({ data, context }) => {
    const scrubbedCard = scrubMinisterPayload(data.request_card);
    const scrubbedSummary = data.minister_summary
      ? enforceMinisterLexicon(data.minister_summary).scrubbed
      : "";

    const { data: row, error } = await context.supabase
      .from("service_request_drafts")
      .upsert(
        {
          user_id: context.userId,
          country_code: data.country_code,
          step: data.step,
          raw_text: data.raw_text ?? "",
          channel: data.channel ?? null,
          minister_summary: scrubbedSummary,
          request_card: scrubbedCard as never,
          internal_chamber: data.internal_chamber ?? null,
          chamber_confidence: data.chamber_confidence ?? null,
          attachments: (data.attachments ?? []) as never,
        },
        { onConflict: "user_id,country_code" },
      )
      .select("*")
      .single();

    if (error) throw new Error(error.message);
    return row;
  });

export const discardDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ country_code: z.string() }).parse(input))
  .handler(async ({ data, context }) => {
    await context.supabase
      .from("service_request_drafts")
      .delete()
      .eq("user_id", context.userId)
      .eq("country_code", data.country_code);
    return { ok: true };
  });

const submitSchema = z.object({
  country_code: z.string().min(2).max(8),
  raw_text: z.string().min(4).max(20000),
  channel: channelEnum.default("typed"),
  minister_summary: z.string().max(2000).optional().default(""),
  request_card: requestCardSchema,
  internal_chamber: chamberEnum,
  chamber_confidence: z.number().min(0).max(1).default(0.6),
  attachments: z.array(attachmentSchema).max(20).default([]),
  requester_name: z.string().max(200).optional(),
  requester_title: z.string().max(200).optional(),
});
export type SubmitRequestInput = z.infer<typeof submitSchema>;

export const submitRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => submitSchema.parse(input))
  .handler(async ({ data, context }) => {
    const card = scrubMinisterPayload(data.request_card);
    const summary = data.minister_summary
      ? enforceMinisterLexicon(data.minister_summary).scrubbed
      : "";

    const { data: row, error } = await context.supabase
      .from("service_requests")
      .insert({
        country_code: data.country_code,
        requester_id: context.userId,
        requester_name: data.requester_name ?? null,
        requester_title: data.requester_title ?? null,
        status: "new",
        question: card.question || data.raw_text.slice(0, 400),
        why_it_matters: card.why_it_matters || null,
        deliverable_shape: LEXICON[data.internal_chamber].requestShape,
        built_on: (card.built_on ?? []) as never,
        when_needed: card.when_needed || null,
        minister_summary: summary,
        submitted_channel: data.channel,
        internal_chamber: data.internal_chamber,
        chamber_confidence: data.chamber_confidence,
        attachments: data.attachments as never,
        raw_intake: data.raw_text,
      })
      .select("*")
      .single();

    if (error) throw new Error(error.message);

    await context.supabase.from("service_request_events").insert({
      request_id: row.id,
      actor_id: context.userId,
      actor_kind: "minister",
      event_type: "submitted",
      minister_summary: "You sent this request to our team.",
      internal_note: `New ${data.internal_chamber} request via ${data.channel}.`,
    });

    // Clear the draft after successful submission.
    await context.supabase
      .from("service_request_drafts")
      .delete()
      .eq("user_id", context.userId)
      .eq("country_code", data.country_code);

    return row;
  });

export const listMyRequests = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ country_code: z.string() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("service_requests")
      .select("*")
      .eq("country_code", data.country_code)
      .eq("requester_id", context.userId)
      .order("submitted_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const getRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const [reqRes, evRes, delRes] = await Promise.all([
      context.supabase.from("service_requests").select("*").eq("id", data.id).maybeSingle(),
      context.supabase
        .from("service_request_events")
        .select("*")
        .eq("request_id", data.id)
        .order("created_at", { ascending: true }),
      context.supabase
        .from("service_request_deliverables")
        .select("*")
        .eq("request_id", data.id)
        .order("created_at", { ascending: false }),
    ]);
    if (reqRes.error) throw new Error(reqRes.error.message);
    return {
      request: reqRes.data,
      events: evRes.data ?? [],
      deliverables: delRes.data ?? [],
    };
  });

// Agency-side listing (admins). RLS still enforces country/admin scoping.
export const listAgencyRequests = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ country_code: z.string().optional() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("service_requests")
      .select("*")
      .order("submitted_at", { ascending: false })
      .limit(200);
    if (data.country_code) q = q.eq("country_code", data.country_code);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

const updateStatusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum([
    "new",
    "triaged",
    "in_progress",
    "review",
    "ready",
    "delivered",
    "accepted",
    "revising",
    "closed",
  ]),
  minister_summary: z.string().max(600).optional(),
  internal_note: z.string().max(4000).optional(),
  expected_by: z.string().datetime().optional(),
});

export const updateRequestStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => updateStatusSchema.parse(input))
  .handler(async ({ data, context }) => {
    const patch: Record<string, unknown> = { status: data.status };
    if (data.expected_by) patch.expected_by = data.expected_by;
    if (data.status === "delivered") patch.delivered_at = new Date().toISOString();
    if (data.status === "accepted") patch.accepted_at = new Date().toISOString();

    const { error } = await context.supabase
      .from("service_requests")
      .update(patch)
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    const ministerVisible = data.minister_summary
      ? enforceMinisterLexicon(data.minister_summary).scrubbed
      : null;

    await context.supabase.from("service_request_events").insert({
      request_id: data.id,
      actor_id: context.userId,
      actor_kind: "agency",
      event_type: `status:${data.status}`,
      minister_summary: ministerVisible,
      internal_note: data.internal_note ?? null,
    });
    return { ok: true };
  });

const deliverableSchema = z.object({
  request_id: z.string().uuid(),
  title: z.string().min(1).max(300),
  minister_body_md: z.string().max(60000),
  internal_body_md: z.string().max(60000).optional(),
  chamber: chamberEnum.optional(),
  chamber_ref_id: z.string().uuid().optional(),
  chamber_ref_kind: z.string().max(80).optional(),
});

export const attachDeliverable = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => deliverableSchema.parse(input))
  .handler(async ({ data, context }) => {
    const ministerBody = enforceMinisterLexicon(data.minister_body_md).scrubbed;
    const { data: row, error } = await context.supabase
      .from("service_request_deliverables")
      .insert({
        request_id: data.request_id,
        title: data.title,
        minister_body_md: ministerBody,
        internal_body_md: data.internal_body_md ?? null,
        chamber: data.chamber ?? null,
        chamber_ref_id: data.chamber_ref_id ?? null,
        chamber_ref_kind: data.chamber_ref_kind ?? null,
        authored_by: context.userId,
        delivered_at: new Date().toISOString(),
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);

    await context.supabase
      .from("service_requests")
      .update({ status: "delivered", delivered_at: new Date().toISOString() })
      .eq("id", data.request_id);

    await context.supabase.from("service_request_events").insert({
      request_id: data.request_id,
      actor_id: context.userId,
      actor_kind: "agency",
      event_type: "delivered",
      minister_summary: "Your team has finished this request and it is ready for you.",
      internal_note: `Deliverable "${data.title}" attached.`,
    });

    return row;
  });

export const markDeliverableRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), acted: z.boolean().default(false) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const patch: Record<string, unknown> = { read_at: new Date().toISOString() };
    if (data.acted) patch.acted_at = new Date().toISOString();
    const { error } = await context.supabase
      .from("service_request_deliverables")
      .update(patch)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export interface ChamberId2 { id: ChamberId }
