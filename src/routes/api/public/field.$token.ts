// Chamber 07 · Participant endpoint.
//
// The one door a research participant ever touches. The invitation token is the
// credential: it resolves exactly one invitation, on one collection, and never
// returns anything about the programme beyond the instrument being answered and
// the participant's own first name. No PII of other participants is exposed.

import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const AnswerSchema = z.object({
  answers: z.record(z.string().max(60), z.unknown()),
});

const OptOutSchema = z.object({ opt_out: z.literal(true) });

type SupabaseAdmin = (typeof import("@/integrations/supabase/client.server"))["supabaseAdmin"];

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

export const Route = createFileRoute("/api/public/field/$token")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const token = String(params.token ?? "").slice(0, 120);
        if (!/^[a-f0-9]{16,80}$/.test(token)) return json({ state: "invalid" }, 404);
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: invite } = await supabaseAdmin
          .from("research_invitations")
          .select("id,collection_id,contact_id,participant_code,status,completed_at,declined_at")
          .eq("token", token)
          .maybeSingle();
        if (!invite) return openLinkGet(supabaseAdmin, token);
        if (invite.declined_at) return json({ state: "opted_out" });
        if (invite.completed_at) return json({ state: "done" });

        const { data: collection } = await supabaseAdmin
          .from("field_collections")
          .select("id,status,instrument_id,response_cap,closes_at")
          .eq("id", invite.collection_id as string)
          .maybeSingle();
        if (!collection) return json({ state: "invalid" }, 404);
        if (collection.status !== "open") return json({ state: "closed" });
        if (collection.closes_at && new Date(collection.closes_at as string) < new Date()) {
          return json({ state: "closed" });
        }

        const { data: instrument } = await supabaseAdmin
          .from("field_instruments")
          .select("title,intro,outro,questions")
          .eq("id", (collection.instrument_id as string) ?? "")
          .maybeSingle();
        if (!instrument) return json({ state: "closed" });

        const { data: contact } = await supabaseAdmin
          .from("research_contacts")
          .select("full_name")
          .eq("id", invite.contact_id as string)
          .maybeSingle();

        await supabaseAdmin
          .from("research_invitations")
          .update({
            opened_at: new Date().toISOString(),
            status: invite.status === "pending" ? "invited" : (invite.status as string),
          } as never)
          .eq("id", invite.id as string);

        return json({
          state: "ok",
          firstName:
            String(contact?.full_name ?? "")
              .trim()
              .split(/\s+/)[0] ?? "",
          instrument: {
            title: instrument.title,
            intro: instrument.intro,
            outro: instrument.outro,
            questions: instrument.questions,
          },
        });
      },

      POST: async ({ request, params }) => {
        const token = String(params.token ?? "").slice(0, 120);
        if (!/^[a-f0-9]{16,80}$/.test(token)) return json({ state: "invalid" }, 404);
        const raw: unknown = await request.json().catch(() => null);
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: invite } = await supabaseAdmin
          .from("research_invitations")
          .select("id,collection_id,study_id,country_code,contact_id,participant_code,completed_at")
          .eq("token", token)
          .maybeSingle();
        if (!invite) return openLinkPost(supabaseAdmin, token, raw);

        // Opt-out is honoured before anything else.
        const optOut = OptOutSchema.safeParse(raw);
        if (optOut.success) {
          const now = new Date().toISOString();
          await supabaseAdmin
            .from("research_contacts")
            .update({ opted_out_at: now, consent_status: "declined" } as never)
            .eq("id", invite.contact_id as string);
          await supabaseAdmin
            .from("research_invitations")
            .update({ status: "declined", declined_at: now } as never)
            .eq("id", invite.id as string);
          return json({ state: "opted_out" });
        }

        if (invite.completed_at) return json({ state: "done" });

        const parsed = AnswerSchema.safeParse(raw);
        if (!parsed.success) return json({ state: "invalid_body" }, 400);

        const { data: collection } = await supabaseAdmin
          .from("field_collections")
          .select("id,status,response_cap")
          .eq("id", invite.collection_id as string)
          .maybeSingle();
        if (!collection || collection.status !== "open") return json({ state: "closed" });

        if (collection.response_cap) {
          const { count } = await supabaseAdmin
            .from("field_responses")
            .select("id", { count: "exact", head: true })
            .eq("collection_id", collection.id as string);
          if ((count ?? 0) >= (collection.response_cap as number)) return json({ state: "closed" });
        }

        const { error } = await supabaseAdmin.from("field_responses").insert({
          collection_id: invite.collection_id as string,
          study_id: invite.study_id as string,
          country_code: invite.country_code as string,
          invitation_id: invite.id as string,
          participant_code: (invite.participant_code as string | null) ?? "P-0000",
          answers: parsed.data.answers as never,
          source: "hosted",
        } as never);
        if (error) return json({ state: "error" }, 500);

        const now = new Date().toISOString();
        await supabaseAdmin
          .from("research_invitations")
          .update({ status: "completed", completed_at: now } as never)
          .eq("id", invite.id as string);

        return json({ state: "done" });
      },
    },
  },
});

/**
 * The anonymous route in: a collection published with an open link. There is no
 * invitation and no contact behind it, so nothing personal is read or written —
 * the return is filed under a sequential participant code.
 */
async function openLinkGet(admin: SupabaseAdmin, token: string) {
  const collection = await openCollection(admin, token);
  if (!collection) return json({ state: "invalid" }, 404);
  if (collection.status !== "open") return json({ state: "closed" });
  if (collection.closes_at && new Date(collection.closes_at) < new Date()) {
    return json({ state: "closed" });
  }

  const { data: instrument } = await admin
    .from("field_instruments")
    .select("title,intro,outro,questions")
    .eq("id", collection.instrument_id ?? "")
    .maybeSingle();
  if (!instrument) return json({ state: "closed" });

  return json({
    state: "ok",
    firstName: "",
    instrument: {
      title: instrument.title,
      intro: instrument.intro,
      outro: instrument.outro,
      questions: instrument.questions,
    },
  });
}

async function openLinkPost(admin: SupabaseAdmin, token: string, raw: unknown) {
  const collection = await openCollection(admin, token);
  if (!collection) return json({ state: "invalid" }, 404);
  if (collection.status !== "open") return json({ state: "closed" });

  const parsed = AnswerSchema.safeParse(raw);
  if (!parsed.success) return json({ state: "invalid_body" }, 400);

  const { count } = await admin
    .from("field_responses")
    .select("id", { count: "exact", head: true })
    .eq("collection_id", collection.id);
  const seq = count ?? 0;
  if (collection.response_cap && seq >= collection.response_cap) return json({ state: "closed" });

  const { error } = await admin.from("field_responses").insert({
    collection_id: collection.id,
    study_id: collection.study_id,
    country_code: collection.country_code,
    participant_code: `P-${String(seq + 1).padStart(4, "0")}`,
    answers: parsed.data.answers as never,
    source: "open_link",
    instrument_version: collection.instrument_version,
  } as never);
  if (error) return json({ state: "error" }, 500);
  return json({ state: "done" });
}

async function openCollection(admin: SupabaseAdmin, token: string) {
  const { data } = await admin
    .from("field_collections")
    .select(
      "id,study_id,country_code,status,instrument_id,instrument_version,response_cap,closes_at",
    )
    .eq("open_token", token)
    .eq("open_enabled", true)
    .maybeSingle();
  return (data ?? null) as {
    id: string;
    study_id: string;
    country_code: string;
    status: string;
    instrument_id: string | null;
    instrument_version: number | null;
    response_cap: number | null;
    closes_at: string | null;
  } | null;
}
