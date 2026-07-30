// @domain marketing
// @tables calculator_leads
// @ui src/components/calculator/LeadDialog.tsx

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const requestSchema = z.object({
  name: z.string().trim().min(1, "Your name is required").max(200),
  role: z.string().trim().min(1, "Your role is required").max(200),
  organisation: z.string().trim().min(1, "Your organisation is required").max(200),
  email: z.string().trim().email("A working email is required").max(320),
  country: z.string().trim().max(120).optional(),
  /** The modelled configuration and verdict, stored verbatim. */
  configuration: z.record(z.string(), z.unknown()),
  userAgent: z.string().trim().max(1000).optional(),
  // Honeypot — real people leave this empty.
  website: z.string().max(0).optional(),
  utm_source: z.string().trim().max(200).optional(),
  utm_medium: z.string().trim().max(200).optional(),
  utm_campaign: z.string().trim().max(200).optional(),
  utm_content: z.string().trim().max(200).optional(),
  referrer: z.string().trim().max(1000).optional(),
});

export type CalculatorLeadInput = z.infer<typeof requestSchema>;

export const recordCalculatorLead = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => requestSchema.parse(input))
  .handler(async ({ data }) => {
    if (data.website && data.website.length > 0) {
      // Silently succeed on a honeypot trip; give the bot nothing.
      return { ok: true as const };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const blank = (v: string | undefined) => (v && v.length > 0 ? v : null);

    const { error } = await supabaseAdmin.from("calculator_leads").insert({
      name: data.name,
      role: data.role,
      organisation: data.organisation,
      email: data.email,
      country: blank(data.country),
      configuration: data.configuration as never,
      utm_source: blank(data.utm_source),
      utm_medium: blank(data.utm_medium),
      utm_campaign: blank(data.utm_campaign),
      utm_content: blank(data.utm_content),
      referrer: blank(data.referrer),
      user_agent: blank(data.userAgent),
      status: "new",
    });

    if (error) {
      console.error("[calculator] lead insert failed", error);
      return { ok: false as const, error: "Could not record the request." };
    }

    return { ok: true as const };
  });
