// @domain personas
// @tables field_collections,field_responses,research_invitations,research_contacts,studies
// @ui src/components/personas/field/FieldworkPanel.tsx; src/routes/f.$token.tsx

// Chamber 07 · Field collection — opening hosted links, issuing per-contact
// invitations, importing external results, and folding every return into the
// second brain.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";

function randomToken(bytes = 18): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

function participantCode(n: number): string {
  return `P-${String(n).padStart(4, "0")}`;
}

// ── Collections ────────────────────────────────────────────────────────────

export const getCollection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ studyId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: collections, error } = await supabase
      .from("field_collections")
      .select("*")
      .eq("study_id", data.studyId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const collection = collections?.[0] ?? null;
    if (!collection) return { collection: null, invitations: [], responseCount: 0 };

    const [{ data: invites }, { count }] = await Promise.all([
      supabase
        .from("research_invitations")
        .select("id,status,participant_code,contact_id,invited_at,completed_at,reminder_count")
        .eq("collection_id", collection.id as string)
        .order("created_at"),
      supabase
        .from("field_responses")
        .select("id", { count: "exact", head: true })
        .eq("collection_id", collection.id as string),
    ]);

    type InviteContact = {
      id: string;
      full_name: string;
      email: string | null;
      organisation: string | null;
      role_title: string | null;
      consent_status: string;
      opted_out_at: string | null;
    };
    const contactIds = (invites ?? []).map((i) => i.contact_id as string);
    let contacts: InviteContact[] = [];
    if (contactIds.length > 0) {
      const { data: cs } = await supabase
        .from("research_contacts")
        .select("id,full_name,email,organisation,role_title,consent_status,opted_out_at")
        .in("id", contactIds);
      contacts = (cs ?? []) as InviteContact[];
    }
    const byId = new Map<string, InviteContact>(contacts.map((c) => [c.id, c]));

    return {
      collection,
      invitations: (invites ?? []).map((i) => ({
        ...i,
        contact: byId.get(i.contact_id as string) ?? null,
      })),
      responseCount: count ?? 0,
    };
  });

export const openCollection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        studyId: z.string().uuid(),
        instrumentId: z.string().uuid().nullish(),
        access: z.enum(["invited", "open"]).optional(),
        targetN: z.number().int().min(1).max(1_000_000).nullish(),
        responseCap: z.number().int().min(1).max(1_000_000).nullish(),
        closesAt: z.string().nullish(),
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

    const { data: existing } = await supabase
      .from("field_collections")
      .select("id")
      .eq("study_id", data.studyId)
      .eq("mode", "hosted")
      .maybeSingle();

    const patch = {
      instrument_id: data.instrumentId ?? null,
      access: data.access ?? "invited",
      status: "open",
      target_n: data.targetN ?? null,
      response_cap: data.responseCap ?? null,
      opens_at: new Date().toISOString(),
      closes_at: data.closesAt ?? null,
    };

    if (existing?.id) {
      const { error } = await supabase
        .from("field_collections")
        .update(patch as never)
        .eq("id", existing.id as string);
      if (error) throw new Error(error.message);
      return { id: existing.id as string };
    }

    const { data: row, error } = await supabase
      .from("field_collections")
      .insert({
        study_id: data.studyId,
        country_code: study.country_code as string,
        mode: "hosted",
        public_token: randomToken(),
        ...patch,
      } as never)
      .select("id,public_token")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const closeCollection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ collectionId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("field_collections")
      .update({ status: "closed", closes_at: new Date().toISOString() } as never)
      .eq("id", data.collectionId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

// ── Invitations ────────────────────────────────────────────────────────────

export const inviteContacts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        collectionId: z.string().uuid(),
        contactIds: z.array(z.string().uuid()).min(1).max(2_000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: collection } = await supabase
      .from("field_collections")
      .select("id,study_id,country_code")
      .eq("id", data.collectionId)
      .maybeSingle();
    if (!collection) throw new Error("Collection not found");

    // Consent gate — an opted-out contact is never enrolled.
    const { data: contacts } = await supabase
      .from("research_contacts")
      .select("id,opted_out_at,consent_status")
      .in("id", data.contactIds);
    const eligible = (contacts ?? []).filter(
      (c) => !c.opted_out_at && c.consent_status !== "declined",
    );

    const { data: existing } = await supabase
      .from("research_invitations")
      .select("contact_id,participant_code")
      .eq("collection_id", data.collectionId);
    const already = new Set((existing ?? []).map((e) => e.contact_id as string));
    let seq = (existing ?? []).length;

    let added = 0;
    for (const c of eligible) {
      if (already.has(c.id as string)) continue;
      seq += 1;
      const { error } = await supabase.from("research_invitations").insert({
        country_code: collection.country_code as string,
        study_id: collection.study_id as string,
        collection_id: data.collectionId,
        contact_id: c.id as string,
        token: randomToken(),
        participant_code: participantCode(seq),
        status: "pending",
      } as never);
      if (!error) added += 1;
    }

    return {
      added,
      skippedOptedOut: data.contactIds.length - eligible.length,
      skippedDuplicate: eligible.length - added,
    };
  });

export const removeInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("research_invitations")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

// ── Responses ──────────────────────────────────────────────────────────────

export const listResponses = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({ collectionId: z.string().uuid(), limit: z.number().int().max(2_000).optional() })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("field_responses")
      .select("id,participant_code,answers,source,submitted_at,ingested_to_corpus_at")
      .eq("collection_id", data.collectionId)
      .order("submitted_at", { ascending: false })
      .limit(data.limit ?? 500);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

/** Import responses exported from an external survey tool. */
export const importResponses = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        studyId: z.string().uuid(),
        source: z.string().max(80).optional(),
        rows: z.array(z.record(z.string(), z.unknown())).min(1).max(5_000),
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

    let { data: collection } = await supabase
      .from("field_collections")
      .select("id")
      .eq("study_id", data.studyId)
      .eq("mode", "imported")
      .maybeSingle();

    if (!collection) {
      const { data: created, error } = await supabase
        .from("field_collections")
        .insert({
          study_id: data.studyId,
          country_code: study.country_code as string,
          mode: "imported",
          access: "open",
          status: "open",
        } as never)
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      collection = created;
    }

    const { count } = await supabase
      .from("field_responses")
      .select("id", { count: "exact", head: true })
      .eq("collection_id", collection.id as string);
    let seq = count ?? 0;

    let inserted = 0;
    for (const r of data.rows) {
      seq += 1;
      const { error } = await supabase.from("field_responses").insert({
        collection_id: collection.id as string,
        study_id: data.studyId,
        country_code: study.country_code as string,
        participant_code: participantCode(seq),
        answers: r as unknown as Json,
        source: data.source ?? "import",
      } as never);
      if (!error) inserted += 1;
    }

    return { inserted, collectionId: collection.id as string };
  });

/** Push everything collected so far into the second brain. */
export const ingestCollection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ collectionId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: collection } = await supabase
      .from("field_collections")
      .select("id,study_id")
      .eq("id", data.collectionId)
      .maybeSingle();
    if (!collection) throw new Error("Collection not found");

    const { data: responses } = await supabase
      .from("field_responses")
      .select("participant_code,answers,submitted_at")
      .eq("collection_id", data.collectionId);
    if (!responses?.length) throw new Error("No responses to ingest yet.");

    const { buildFieldTag, ingestResponsesToCorpus } = await import("./field-corpus.server");
    const tag = await buildFieldTag(collection.study_id as string);
    const res = await ingestResponsesToCorpus({
      tag,
      collectionId: data.collectionId,
      responses: responses as Array<{
        participant_code: string;
        answers: unknown;
        submitted_at: string;
      }>,
    });
    return { ok: true as const, memoryId: res?.id ?? null, count: responses.length };
  });
