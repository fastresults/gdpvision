import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
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
      return { ok: true, id: null as string | null };
    }

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
    if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
      console.error("[briefing] missing supabase env");
      return { ok: false as const, error: "Service unavailable" };
    }

    const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: row, error } = await supabase
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
