// @domain events
// @tables event_series, events, event_sessions, event_speakers, event_partners, event_media, event_registrations, event_site_snapshots, memory_objects
// @ui src/routes/_authenticated/events-admin/route.tsx

// Events Admin toolkit: dashboard, series, programme (agenda/speakers/partners/media), check-in and site sync.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  if (!data) throw new Error("Only administrators can manage events.");
}

export const eventsAdminAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    return { admin: Boolean(data) };
  });

export const eventsDashboard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const sb = context.supabase;
    const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
    const [evs, regs, recent, enq] = await Promise.all([
      sb.from("events").select("id, slug, title, status, starts_at, date_tba, venue, summary, hero_url, capacity, series_id, event_sessions(id), event_speakers(id)").eq("archived", false),
      sb.from("event_registrations").select("event_id, status"),
      sb.from("event_registrations").select("id", { count: "exact", head: true }).gte("created_at", weekAgo),
      sb.from("event_host_enquiries").select("id", { count: "exact", head: true }),
    ]);
    if (evs.error) throw new Error(evs.error.message);
    const rows = (evs.data ?? []).map((e: any) => {
      const r = (regs.data ?? []).filter((x: any) => x.event_id === e.id);
      const gaps: string[] = [];
      if (!e.starts_at) gaps.push("dates");
      if (!e.venue) gaps.push("venue");
      if (!e.summary) gaps.push("description");
      if (!e.hero_url) gaps.push("photo");
      if (!e.event_sessions?.length) gaps.push("agenda");
      if (!e.event_speakers?.length) gaps.push("speakers");
      return {
        id: e.id, slug: e.slug, title: e.title, status: e.status, starts_at: e.starts_at as string | null,
        confirmed: r.filter((x: any) => x.status === "confirmed").length,
        waitlist: r.filter((x: any) => x.status === "waitlist").length,
        capacity: e.capacity as number | null, gaps,
      };
    });
    return { events: rows, registrationsThisWeek: recent.count ?? 0, enquiries: enq.count ?? 0 };
  });

// ---------- Series ----------
export const adminListSeries = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data, error } = await context.supabase.from("event_series").select("*, events(id, slug, title, edition_label, status, starts_at, archived)").order("position");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const SeriesInput = z.object({
  id: z.string().uuid().optional(),
  slug: z.string().trim().min(2).max(80).regex(/^[a-z0-9-]+$/),
  name: z.string().trim().min(3).max(200),
  short_name: z.string().trim().max(40).nullable().optional(),
  site_url: z.string().trim().url().max(500),
  sector: z.string().trim().max(120).nullable().optional(),
  colour: z.enum(["sea", "coral", "mango", "palm", "night"]),
  logo_url: z.string().trim().max(1000).nullable().optional(),
  summary: z.string().trim().max(2000).nullable().optional(),
  position: z.number().int().min(0).max(999).optional(),
});

export const adminSaveSeries = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SeriesInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase.from("event_series").upsert({ ...data, updated_at: new Date().toISOString() }, { onConflict: "slug" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Copy an edition forward: new draft in the same series with dates cleared and agenda/speakers/partners copied. */
export const adminCopyEditionForward = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ event_id: z.string().uuid(), edition_label: z.string().trim().min(2).max(40) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const sb = context.supabase;
    const { data: src, error } = await sb.from("events").select("*").eq("id", data.event_id).single();
    if (error || !src) throw new Error("Edition not found.");
    const baseSlug = String(src.slug).replace(/-\d{4}$/, "");
    const { id: _id, created_at: _c, updated_at: _u, imported_at: _i, ...rest } = src;
    const { data: created, error: insErr } = await sb
      .from("events")
      .insert({ ...rest, slug: `${baseSlug}-${data.edition_label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`, edition_label: data.edition_label, status: "draft", starts_at: null, ends_at: null, registration_close: null, date_tba: true, recording_url: null, created_by: context.userId })
      .select("id")
      .single();
    if (insErr) throw new Error(insErr.message.includes("duplicate") ? "That edition already exists." : insErr.message);
    for (const t of ["event_speakers", "event_partners"] as const) {
      const { data: rows } = await sb.from(t).select("*").eq("event_id", src.id);
      if (rows?.length) await sb.from(t).insert(rows.map(({ id: _x, ...r }: any) => ({ ...r, event_id: created.id })));
    }
    return { id: created.id as string };
  });

// ---------- Programme: agenda, speakers, partners, media ----------
const TABLES = {
  sessions: "event_sessions",
  speakers: "event_speakers",
  partners: "event_partners",
  media: "event_media",
} as const;
type Kind = keyof typeof TABLES;

export const adminGetProgramme = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ event_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const sb: any = context.supabase;
    const [sessions, speakers, partners, media] = await Promise.all(
      (Object.values(TABLES) as string[]).map((t): Promise<{ data: any[] | null }> => sb.from(t).select("*").eq("event_id", data.event_id).order("position")),
    );
    return { sessions: (sessions!.data ?? []) as any[], speakers: (speakers!.data ?? []) as any[], partners: (partners!.data ?? []) as any[], media: (media!.data ?? []) as any[] };
  });

const ItemSchemas: Record<Kind, z.ZodTypeAny> = {
  sessions: z.object({ title: z.string().trim().min(2).max(300), description: z.string().trim().max(2000).nullable().optional(), starts_at: z.string().nullable().optional(), speaker_names: z.array(z.string().trim().max(200)).max(20).optional() }),
  speakers: z.object({ name: z.string().trim().min(2).max(200), role: z.string().trim().max(200).nullable().optional(), organisation: z.string().trim().max(200).nullable().optional(), photo_url: z.string().trim().max(1000).nullable().optional() }),
  partners: z.object({ name: z.string().trim().min(2).max(200), tier: z.string().trim().max(80).nullable().optional(), logo_url: z.string().trim().max(1000).nullable().optional(), url: z.string().trim().max(1000).nullable().optional() }),
  media: z.object({ kind: z.enum(["photo", "recording", "deck"]), url: z.string().trim().url().max(1000), caption: z.string().trim().max(300).nullable().optional(), credit: z.string().trim().max(200).nullable().optional() }),
};

export const adminSaveProgrammeItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ kind: z.enum(["sessions", "speakers", "partners", "media"]), event_id: z.string().uuid(), id: z.string().uuid().optional(), position: z.number().int().min(0).max(9999).optional(), item: z.record(z.unknown()) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const item = ItemSchemas[data.kind].parse(data.item) as Record<string, unknown>;
    const row = { ...item, event_id: data.event_id, ...(data.position != null ? { position: data.position } : {}) };
    const t = TABLES[data.kind];
    const sbx: any = context.supabase;
    const q = data.id ? sbx.from(t).update(row).eq("id", data.id) : sbx.from(t).insert(row);
    const { error } = await q;
    if (error) throw new Error(error.message.includes("duplicate") ? "That item is already on this event." : error.message);
    return { ok: true };
  });

export const adminDeleteProgrammeItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ kind: z.enum(["sessions", "speakers", "partners", "media"]), id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const sbx: any = context.supabase;
    const { error } = await sbx.from(TABLES[data.kind]).delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Reusable speaker library: every distinct speaker across all editions. */
export const adminSpeakerLibrary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data } = await context.supabase.from("event_speakers").select("name, role, organisation, photo_url").order("name");
    const seen = new Map<string, any>();
    for (const s of data ?? []) if (!seen.has(s.name.toLowerCase())) seen.set(s.name.toLowerCase(), s);
    return [...seen.values()];
  });

// ---------- Check-in ----------
export const adminCheckIn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ token: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: res, error } = await context.supabase.rpc("event_check_in", { _token: data.token });
    if (error) throw new Error(error.message);
    return res as { outcome: "ok" | "already" | "cancelled" | "not_found"; name?: string; at?: string };
  });

export const adminListCheckins = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ event_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: rows, error } = await context.supabase
      .from("event_registrations")
      .select("id, name, email, organisation, status, checkin_token, checked_in_at, source")
      .eq("event_id", data.event_id)
      .neq("status", "cancelled")
      .order("name");
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

// ---------- Site sync ----------
const MONTHS = "Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec";
function readSite(html: string) {
  const meta = (re: RegExp) => html.match(re)?.[1]?.trim() ?? null;
  const decode = (v: string | null) => v?.replace(/&amp;/g, "&").replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"') ?? null;
  const text = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  const dateLine =
    text.match(new RegExp(`((?:${MONTHS})[a-z]* \\d{1,2}(?:\\s*[–-]\\s*\\d{1,2})?,? \\d{4})`))?.[1] ??
    (/(dates? to be announced|dates? tba)/i.test(text) ? "Dates to be announced" : null);
  return {
    title: decode(meta(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)/i) ?? meta(/<title>([^<]+)<\/title>/i)),
    description: decode(meta(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)/i) ?? meta(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)/i)),
    image: meta(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)/i),
    date_text: dateLine,
  };
}

export const adminSyncPreview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ series_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const sb = context.supabase;
    const { data: series } = await sb.from("event_series").select("id, site_url").eq("id", data.series_id).single();
    if (!series) throw new Error("Series not found.");
    const res = await fetch(series.site_url, { headers: { "User-Agent": "GDPVision-Events-Sync/1.0" } });
    if (!res.ok) return { ok: false as const, error: `The summit website answered ${res.status}.` };
    const found = readSite(await res.text());
    // Ignore generic share images hosted elsewhere; only the summit's own photos count.
    try { if (found.image && new URL(found.image).host !== new URL(series.site_url).host) found.image = null; } catch { found.image = null; }
    const { data: ev } = await sb.from("events").select("id, title, summary, hero_url, starts_at, date_tba").eq("series_id", series.id).eq("archived", false).order("starts_at", { ascending: false, nullsFirst: true }).limit(1).maybeSingle();
    const { data: snap } = await sb.from("event_site_snapshots").insert({ series_id: series.id, extracted: found }).select("id").single();
    await sb.from("event_series").update({ last_synced_at: new Date().toISOString() }).eq("id", series.id);
    const changes = ev
      ? [
          { field: "summary", label: "Description", current: ev.summary, found: found.description },
          { field: "hero_url", label: "Main photo", current: ev.hero_url, found: found.image },
          { field: "date_text", label: "Dates shown on site", current: ev.starts_at ? ev.starts_at.slice(0, 10) : "Dates to be announced", found: found.date_text },
        ].filter((c) => c.found && c.found !== c.current)
      : [];
    return { ok: true as const, snapshot_id: snap?.id as string | undefined, event: ev, found, changes, source: series.site_url };
  });

export const adminSyncApply = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ event_id: z.string().uuid(), snapshot_id: z.string().uuid().optional(), summary: z.string().max(2000).optional(), hero_url: z.string().url().max(1000).optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const patch: Record<string, unknown> = { imported_at: new Date().toISOString() };
    if (data.summary) patch.summary = data.summary;
    if (data.hero_url) patch.hero_url = data.hero_url;
    const { error } = await (context.supabase as any).from("events").update(patch).eq("id", data.event_id);
    if (error) throw new Error(error.message);
    if (data.snapshot_id) await context.supabase.from("event_site_snapshots").update({ applied: true }).eq("id", data.snapshot_id);
    return { ok: true };
  });

// ---------- Deep scrape (every page + AI extraction + Second Brain) ----------
export const adminDeepScrape = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ series_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { deepScrapeSeries } = await import("./deep-scrape.server");
    try {
      const r = await deepScrapeSeries(supabaseAdmin, data.series_id, true);
      return { ok: true as const, found: r.found, brain_records: Number((r as { applied?: { brain_records?: number } }).applied?.brain_records ?? 0) };
    } catch (e) {
      return { ok: false as const, error: (e as Error).message };
    }
  });

// ---------- Second Brain sync (one click: everything in Events Admin → Second Brain) ----------
export const adminBrainStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const sb: any = context.supabase;
    const kinds = ["event", "event_topic", "event_speaker", "event_partner"];
    const counts = await Promise.all(kinds.map((k) => sb.from("memory_objects").select("id", { count: "exact", head: true }).eq("kind", k).eq("visibility", "public")));
    const { data: last } = await sb.from("memory_objects").select("updated_at").in("kind", kinds).order("updated_at", { ascending: false }).limit(1).maybeSingle();
    return {
      summits: counts[0].count ?? 0, topics: counts[1].count ?? 0, speakers: counts[2].count ?? 0, partners: counts[3].count ?? 0,
      last_updated: (last?.updated_at as string | undefined) ?? null,
    };
  });

export const adminSyncBrain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { syncEventsToBrain } = await import("./brain-sync.server");
    try {
      return { ok: true as const, ...(await syncEventsToBrain(supabaseAdmin)) };
    } catch (e) {
      return { ok: false as const, error: (e as Error).message };
    }
  });
