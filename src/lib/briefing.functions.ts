// @domain core
// @tables briefing_requests
// @ui src/components/marketing/BriefingForm.tsx

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { REGISTRY_CODES } from "@/lib/caricom-registry";

const submitBriefingSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  role: z.string().trim().min(1, "Role is required").max(200),
  government: z.string().trim().min(1, "Government or ministry is required").max(200),
  nation: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .refine((code) => REGISTRY_CODES.has(code), "Select a nation from the registry"),
  email: z.string().trim().email("A working email is required").max(320),
  message: z.string().trim().max(5000).optional().or(z.literal("")),
  // Honeypot — real users leave this empty; bots fill it.
  website: z.string().max(0).optional(),
});

export type SubmitBriefingInput = z.infer<typeof submitBriefingSchema>;

export const submitBriefingRequest = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => submitBriefingSchema.parse(input))
  .handler(async ({ data }) => {
    if (data.website && data.website.length > 0) {
      // Silently succeed on honeypot trip.
      return { ok: true as const, id: null as string | null };
    }

    // Load admin client dynamically per Lovable rule: never at module scope
    // of a *.functions.ts file. Validation already happened above; the admin
    // client is only used to write a single briefing_requests row.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: row, error } = await supabaseAdmin
      .from("briefing_requests")
      .insert({
        name: data.name,
        role: data.role,
        government: data.government,
        nation: data.nation,
        email: data.email,
        message: data.message && data.message.length > 0 ? data.message : null,
        status: "new",
      })
      .select("id")
      .single();

    if (error) {
      console.error("[briefing] insert failed", error);
      return { ok: false as const, error: "Could not record the request" };
    }

    return { ok: true as const, id: row.id };
  });

