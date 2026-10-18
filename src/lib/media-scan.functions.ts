// @domain core
// @tables narrative_source_stats,narrative_outlets,narrative_media_countries,narrative_feeds,narrative_harvest_runs,intake_items
// @ui src/routes/_authenticated/admin/media-scan.tsx

// Chamber 05 · Super Admin media scan controls (admin only).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/require-admin";

export const getMediaScanOverview = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .handler(async () => {
    const { coverageReport } = await import("@/lib/media-scan.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [coverage, { data: outlets }, { data: runs }, { data: lock }] = await Promise.all([
      coverageReport(),
      supabaseAdmin.from("narrative_outlets").select("*").order("scope").order("name"),
      supabaseAdmin
        .from("narrative_harvest_runs")
        .select("id,window_key,started_at,finished_at,feeds_polled,items_fetched,items_new,items_promoted,triggered_by,countries_run")
        .order("started_at", { ascending: false })
        .limit(8),
      supabaseAdmin.from("narrative_scan_locks").select("holder,expires_at").maybeSingle(),
    ]);
    return { coverage, outlets: outlets ?? [], runs: runs ?? [], running: lock ?? null };
  });

export const runMediaScan = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: unknown) => z.object({ countryCode: z.string().nullable() }).parse(d))
  .handler(async ({ data, context }) => {
    const { withScanLock } = await import("@/lib/media-scan.server");
    const { runPressTick } = await import("@/lib/press-tick.server");
    return withScanLock(`${context.userId}:${Date.now()}`, 15, () =>
      runPressTick({
        windowKey: "manual",
        filterCountry: data.countryCode,
        triggeredBy: "super-admin",
      }),
    );
  });

export const syncSharedOutlets = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .handler(async () => {
    const { syncOutlets } = await import("@/lib/media-scan.server");
    return syncOutlets();
  });

export const discoverCountryOutlets = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: unknown) => z.object({ code: z.string(), name: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const { discoverForCountry } = await import("@/lib/press-discover.server");
    const r = await discoverForCountry(data.code, data.name);
    return { suggested: r.suggested, inserted: r.inserted };
  });

export const upsertOutlet = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        name: z.string().min(2).max(120),
        domain: z.string().min(3).max(200),
        feed_url: z.string().url().nullable().optional(),
        scope: z.enum(["regional", "international"]),
        credibility: z.number().int().min(1).max(5),
        active: z.boolean().default(true),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const domain = data.domain.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "").toLowerCase();
    const row = { ...data, domain, feed_url: data.feed_url ?? null, updated_at: new Date().toISOString() };
    const { error } = await context.supabase.from("narrative_outlets").upsert(row, { onConflict: "domain" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteOutlet = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("narrative_outlets").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listSources = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .handler(async () => {
    const { sourceReport } = await import("@/lib/media-scan.server");
    return sourceReport();
  });

export const updateSource = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        reach_tier: z.number().int().min(1).max(5).nullable().optional(),
        admin_weight: z.number().min(0.5).max(1.5).optional(),
        active: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { id, ...patch } = data;
    const { error } = await supabaseAdmin.from("narrative_feeds").update(patch).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const recomputeSources = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .handler(async () => {
    const { withScanLock } = await import("@/lib/media-scan.server");
    const { recomputeSourceStats } = await import("@/lib/narrative-source-stats.server");
    return withScanLock(`manual:${Date.now()}`, 10, recomputeSourceStats, "source-stats");
  });
