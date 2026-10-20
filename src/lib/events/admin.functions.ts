// @domain events
// @tables events, event_links, event_registrations, event_host_enquiries
// @ui src/routes/_authenticated/admin/events.tsx

// Super-admin management of GDP Events: events, Second Brain links, attendees, host enquiries.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  if (!data) throw new Error("Only administrators can manage events.");
}

export const adminListEvents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data, error } = await context.supabase
      .from("events")
      .select("*, event_links(id, kind, ref, label), event_registrations(id, status)")
      .order("starts_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const EventInput = z.object({
  id: z.string().uuid().optional(),
  slug: z.string().trim().min(3).max(160).regex(/^[a-z0-9-]+$/, "Use lowercase letters, numbers and dashes"),
  title: z.string().trim().min(3).max(200),
  tagline: z.string().trim().max(300).nullable().optional(),
  summary: z.string().trim().max(2000).nullable().optional(),
  body: z.string().trim().max(10000).nullable().optional(),
  status: z.enum(["draft", "published"]),
  format: z.enum(["in_person", "online", "hybrid"]),
  theme: z.string().trim().max(120).nullable().optional(),
  country_code: z.string().trim().max(4).nullable().optional(),
  city: z.string().trim().max(120).nullable().optional(),
  venue: z.string().trim().max(200).nullable().optional(),
  starts_at: z.string().min(10),
  ends_at: z.string().nullable().optional(),
  registration_close: z.string().nullable().optional(),
  capacity: z.number().int().min(0).nullable().optional(),
  hero_url: z.string().trim().max(1000).nullable().optional(),
  colour: z.enum(["sea", "coral", "mango", "palm", "night"]),
  is_placeholder: z.boolean().optional(),
});

export const adminSaveEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => EventInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const row = { ...data, updated_at: new Date().toISOString(), created_by: data.id ? undefined : context.userId };
    const { data: saved, error } = await context.supabase.from("events").upsert(row, { onConflict: "id" }).select("id").single();
    if (error) throw new Error(error.message);
    return saved;
  });

export const adminDeleteEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase.from("events").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminAddEventLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        event_id: z.string().uuid(),
        kind: z.enum(["chamber", "country", "index", "op_ed", "page"]),
        ref: z.string().trim().min(1).max(200),
        label: z.string().trim().max(200).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    // Upsert on (event_id, kind, ref) so the same Second Brain item is never linked twice.
    const { error } = await context.supabase.from("event_links").upsert(data, { onConflict: "event_id,kind,ref" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminRemoveEventLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase.from("event_links").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminListRegistrations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ event_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: rows, error } = await context.supabase
      .from("event_registrations")
      .select("id, name, email, organisation, role, country, needs, status, attended, created_at")
      .eq("event_id", data.event_id)
      .order("created_at");
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const adminUpdateRegistration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["confirmed", "waitlist", "cancelled"]).optional(),
        attended: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { id, ...patch } = data;
    const { error } = await context.supabase.from("event_registrations").update(patch).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminListHostEnquiries = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data, error } = await context.supabase
      .from("event_host_enquiries")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });
