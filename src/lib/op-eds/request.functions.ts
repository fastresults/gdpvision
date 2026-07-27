// @domain marketing
// @tables op_ed_requests, op_ed_events
// @ui src/components/marketing/OpEdGate.tsx, src/routes/op-eds.$slug.tsx

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { OP_EDS } from "./content";

const SLUGS = new Set(OP_EDS.map((o) => o.slug));

const attribution = {
  utm_source: z.string().trim().max(200).optional(),
  utm_medium: z.string().trim().max(200).optional(),
  utm_campaign: z.string().trim().max(200).optional(),
  utm_content: z.string().trim().max(200).optional(),
  referrer: z.string().trim().max(1000).optional(),
};

const requestSchema = z.object({
  slug: z.string().refine((s) => SLUGS.has(s), "Unknown op-ed"),
  name: z.string().trim().min(1, "Your name is required").max(200),
  role: z.string().trim().min(1, "Your role is required").max(200),
  organisation: z.string().trim().min(1, "Your organisation is required").max(200),
  email: z.string().trim().email("A working email is required").max(320),
  userAgent: z.string().trim().max(1000).optional(),
  // Honeypot — real people leave this empty.
  website: z.string().max(0).optional(),
  ...attribution,
});

export type OpEdRequestInput = z.infer<typeof requestSchema>;

const eventSchema = z.object({
  slug: z.string().refine((s) => SLUGS.has(s), "Unknown op-ed"),
  event: z.enum([
    "op_ed_view",
    "op_ed_scroll_to_form",
    "op_ed_submit",
    "op_ed_pdf_open",
    "op_ed_briefing_click",
  ]),
  visitorKey: z.string().trim().max(64).optional(),
  ...attribution,
});

function blankToNull(v: string | undefined): string | null {
  return v && v.length > 0 ? v : null;
}

/**
 * Records the reader, then hands back a short-lived signed URL for the PDF.
 * Public by design — this is the campaign's front door.
 */
export const requestOpEd = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => requestSchema.parse(input))
  .handler(async ({ data }) => {
    if (data.website && data.website.length > 0) {
      // Silently succeed on a honeypot trip; give the bot nothing.
      return { ok: true as const, url: null as string | null };
    }

    const op = OP_EDS.find((o) => o.slug === data.slug)!;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error } = await supabaseAdmin.from("op_ed_requests").insert({
      slug: op.slug,
      chamber: op.chamber,
      name: data.name,
      role: data.role,
      organisation: data.organisation,
      email: data.email,
      utm_source: blankToNull(data.utm_source),
      utm_medium: blankToNull(data.utm_medium),
      utm_campaign: blankToNull(data.utm_campaign),
      utm_content: blankToNull(data.utm_content),
      referrer: blankToNull(data.referrer),
      user_agent: blankToNull(data.userAgent),
      status: "new",
    });

    if (error) {
      console.error("[op-ed] insert failed", error);
      return { ok: false as const, error: "Could not record the request." };
    }

    const signed = await supabaseAdmin.storage.from("op-eds").createSignedUrl(op.pdfKey, 60 * 60);

    if (signed.error || !signed.data?.signedUrl) {
      console.error("[op-ed] signed url failed", signed.error);
      // The lead is captured; be honest that the file is not available.
      return {
        ok: true as const,
        url: null as string | null,
        note: "The PDF is being finalised. We will send it to you directly.",
      };
    }

    return { ok: true as const, url: signed.data.signedUrl };
  });

/** First-party page analytics. No third-party script anywhere on this site. */
export const trackOpEdEvent = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => eventSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("op_ed_events").insert({
      slug: data.slug,
      event: data.event,
      visitor_key: blankToNull(data.visitorKey),
      utm_source: blankToNull(data.utm_source),
      utm_medium: blankToNull(data.utm_medium),
      utm_campaign: blankToNull(data.utm_campaign),
      utm_content: blankToNull(data.utm_content),
      referrer: blankToNull(data.referrer),
    });
    if (error) console.error("[op-ed] event failed", error);
    return { ok: true as const };
  });
