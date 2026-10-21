// @domain events
// @tables events, event_sessions, event_speakers, event_links, event_registrations, event_host_enquiries
// @ui src/routes/events.index.tsx

// Public GDP Events reads and the anonymous registration / host-enquiry actions.
import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import { sortByDate } from "./rules";

function publicClient() {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) throw new Error("Events are not configured.");
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

const LIST_COLS =
  "id, slug, title, tagline, summary, format, theme, country_code, city, venue, starts_at, ends_at, registration_close, capacity, hero_url, colour, hosts, is_placeholder, date_tba, series_id, edition_label, site_url" as const;

export const listPublicEvents = createServerFn({ method: "GET" }).handler(async () => {
  const sb = publicClient();
  const { data, error } = await sb.from("events").select(LIST_COLS).eq("status", "published").eq("archived", false);
  if (error) throw new Error(error.message);
  return sortByDate(data ?? []);
});

export const listPublicSeries = createServerFn({ method: "GET" }).handler(async () => {
  const sb = publicClient();
  const { data, error } = await sb.from("event_series").select("id, slug, name, short_name, site_url, sector, colour, logo_url, summary, position").order("position");
  if (error) throw new Error(error.message);
  return data ?? [];
});

export const getPublicSeries = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ slug: z.string().min(1).max(80) }).parse(d))
  .handler(async ({ data }) => {
    const sb = publicClient();
    const { data: series, error } = await sb.from("event_series").select("id, slug, name, short_name, site_url, sector, colour, logo_url, summary").eq("slug", data.slug).maybeSingle();
    if (error) throw new Error(error.message);
    if (!series) return null;
    const { data: evs } = await sb.from("events").select(LIST_COLS).eq("series_id", series.id).eq("status", "published").eq("archived", false);
    const ids = (evs ?? []).map((e) => e.id);
    const { data: media } = ids.length
      ? await sb.from("event_media").select("event_id, kind, url, caption, credit, position").in("event_id", ids).order("position")
      : { data: [] as { event_id: string; kind: string; url: string; caption: string | null; credit: string | null; position: number }[] };
    return { series, events: sortByDate(evs ?? []), media: media ?? [] };
  });

export const getPublicEvent = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ slug: z.string().min(1).max(160) }).parse(d))
  .handler(async ({ data }) => {
    const sb = publicClient();
    const { data: ev, error } = await sb
      .from("events")
      .select(`${LIST_COLS}, body, recording_url, registration_url`)
      .eq("slug", data.slug)
      .eq("status", "published")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!ev) return null;
    const [sessions, speakers, links, taken, partners] = await Promise.all([
      sb.from("event_sessions").select("id, position, starts_at, title, description, speaker_names").eq("event_id", ev.id).order("position"),
      sb.from("event_speakers").select("id, position, name, role, organisation, photo_url").eq("event_id", ev.id).order("position"),
      sb.from("event_links").select("id, kind, ref, label").eq("event_id", ev.id),
      sb.rpc("event_seats_taken", { _event_id: ev.id }),
      sb.from("event_partners").select("id, name, tier, logo_url, url, position").eq("event_id", ev.id).order("position"),
    ]);
    return {
      event: ev,
      sessions: sessions.data ?? [],
      speakers: speakers.data ?? [],
      links: links.data ?? [],
      taken: (taken.data as number | null) ?? 0,
      partners: partners.data ?? [],
    };
  });

const RegisterInput = z.object({
  slug: z.string().min(1).max(160),
  name: z.string().trim().min(2).max(200),
  email: z.string().trim().email().max(320),
  organisation: z.string().trim().max(200).optional().default(""),
  role: z.string().trim().max(200).optional().default(""),
  country: z.string().trim().max(120).optional().default(""),
  needs: z.string().trim().max(1000).optional().default(""),
});

export type RegisterOutcome =
  | { outcome: "ok"; status: "confirmed" | "waitlist" }
  | { outcome: "duplicate"; status: string }
  | { outcome: "closed" | "not_found" | "invalid" };

export const registerForEvent = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => RegisterInput.parse(d))
  .handler(async ({ data }): Promise<RegisterOutcome> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: res, error } = await supabaseAdmin.rpc("register_for_event", {
      _slug: data.slug,
      _name: data.name,
      _email: data.email,
      _organisation: data.organisation,
      _role: data.role,
      _country: data.country,
      _needs: data.needs,
    });
    if (error) throw new Error("Registration could not be saved. Please try again.");
    return res as RegisterOutcome;
  });

export const submitHostEnquiry = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        name: z.string().trim().min(2).max(200),
        email: z.string().trim().email().max(320),
        organisation: z.string().trim().max(200).optional().default(""),
        country: z.string().trim().max(120).optional().default(""),
        message: z.string().trim().min(10).max(3000),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("event_host_enquiries").insert(data);
    if (error) throw new Error("Your enquiry could not be sent. Please try again.");
    return { ok: true };
  });
