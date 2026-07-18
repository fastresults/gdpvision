// Chamber 05 · server functions exposed to the UI (feeds CRUD, suggest, manual run, radar stats).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";

// ─── Types (kept thin so this file stays a client-safe wrapper) ─────────────

export interface FeedRow {
  id: string;
  country_code: string;
  scope: "local" | "regional" | "international";
  kind: "rss" | "json" | "gdelt" | "google_news" | "html";
  endpoint: string;
  label: string | null;
  language: string | null;
  sector_hint: string | null;
  ministry_hint: string | null;
  weight: number;
  active: boolean;
  last_polled_at: string | null;
  last_status: string | null;
  last_error: string | null;
  consecutive_failures: number;
  is_seed: boolean;
  is_query: boolean;
  discovered_at: string | null;
  tier_hint: string | null;
}

export interface HarvestRun {
  id: string;
  window_key: string | null;
  started_at: string;
  finished_at: string | null;
  countries_run: string[];
  feeds_polled: number;
  items_fetched: number;
  items_new: number;
  items_promoted: number;
  errors: Json;
  triggered_by: string;
}

// ─── List / upsert / delete feeds ────────────────────────────────────────────

export const listFeeds = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ countryCode: z.string() }).parse(d))
  .handler(async ({ data, context }): Promise<FeedRow[]> => {
    const { data: rows, error } = await context.supabase
      .from("narrative_feeds")
      .select("id,country_code,scope,kind,endpoint,label,language,sector_hint,ministry_hint,weight,active,last_polled_at,last_status,last_error,consecutive_failures,is_seed,is_query,discovered_at,tier_hint")
      .eq("country_code", data.countryCode)
      .order("scope", { ascending: true })
      .order("label", { ascending: true });
    if (error) throw new Error(error.message);
    return (rows ?? []) as unknown as FeedRow[];
  });

const UpsertFeed = z.object({
  id: z.string().uuid().optional(),
  countryCode: z.string(),
  scope: z.enum(["local", "regional", "international"]),
  kind: z.enum(["rss", "json", "gdelt", "google_news", "html"]),
  endpoint: z.string().url(),
  label: z.string().optional(),
  sectorHint: z.string().optional(),
  ministryHint: z.string().optional(),
  active: z.boolean().optional(),
});

export const upsertFeed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => UpsertFeed.parse(d))
  .handler(async ({ data, context }) => {
    const row = {
      country_code: data.countryCode,
      scope: data.scope,
      kind: data.kind,
      endpoint: data.endpoint,
      label: data.label ?? null,
      sector_hint: data.sectorHint ?? null,
      ministry_hint: data.ministryHint ?? null,
      active: data.active ?? true,
    };
    if (data.id) {
      const { error } = await context.supabase
        .from("narrative_feeds").update(row).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: ins, error } = await context.supabase
      .from("narrative_feeds")
      .upsert({ ...row }, { onConflict: "country_code,endpoint" })
      .select("id").single();
    if (error) throw new Error(error.message);
    return { id: ins.id };
  });

export const deleteFeed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("narrative_feeds").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ─── Test a feed (no writes — parse only) ───────────────────────────────────

export const testFeed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: f, error } = await context.supabase
      .from("narrative_feeds")
      .select("id,country_code,scope,kind,endpoint,etag,active,consecutive_failures")
      .eq("id", data.id).single();
    if (error || !f) throw new Error(error?.message ?? "feed not found");
    const { fetchFeed } = await import("@/lib/press-monitor.server");
    const r = await fetchFeed({
      id: f.id, country_code: f.country_code,
      scope: f.scope as "local" | "regional" | "international",
      kind: f.kind as "rss" | "json" | "gdelt" | "google_news" | "html",
      endpoint: f.endpoint, etag: f.etag, active: f.active,
      consecutive_failures: f.consecutive_failures ?? 0,
    });
    return {
      status: r.status,
      count: r.items.length,
      sample: r.items.slice(0, 3).map((i) => ({ title: i.title, url: i.url })),
      error: r.error ?? null,
    };
  });

// ─── Trigger a manual tick for one country ──────────────────────────────────

export const runManualTick = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ countryCode: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    // Only admins & country_admins can trigger
    const { data: role } = await context.supabase.rpc("has_country_role", {
      _user_id: context.userId, _role: "country_admin", _country_code: data.countryCode,
    });
    if (!role) throw new Error("Only country admins can run the press tick.");
    const { runPressTick } = await import("@/lib/press-tick.server");
    return await runPressTick({
      windowKey: "manual",
      filterCountry: data.countryCode,
      triggeredBy: "manual",
    });
  });

// ─── Latest harvest run (for the persistent banner) ─────────────────────────

export const lastHarvestRun = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("narrative_harvest_runs")
      .select("*")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data as HarvestRun | null;
  });

// ─── Radar 24h heat-strip data ──────────────────────────────────────────────

export interface HeatCell { hour: string; local: number; regional: number; international: number; }

export const heatStrip24h = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ countryCode: z.string() }).parse(d))
  .handler(async ({ data, context }): Promise<HeatCell[]> => {
    const since = new Date(Date.now() - 24 * 3600_000);
    const { data: rows, error } = await context.supabase
      .from("intake_items")
      .select("created_at,scope")
      .eq("scope_key", data.countryCode)
      .gte("created_at", since.toISOString())
      .limit(1000);
    if (error) throw new Error(error.message);
    // Bucket into 24 hourly cells
    const cells: HeatCell[] = Array.from({ length: 24 }, (_, i) => {
      const t = new Date(Date.now() - (23 - i) * 3600_000);
      t.setMinutes(0, 0, 0);
      return { hour: t.toISOString(), local: 0, regional: 0, international: 0 };
    });
    const buckets = new Map(cells.map((c, i) => [new Date(c.hour).getTime(), i] as const));
    for (const r of rows ?? []) {
      const t = new Date(r.created_at as string);
      t.setMinutes(0, 0, 0);
      const idx = buckets.get(t.getTime());
      if (idx === undefined) continue;
      const s = (r.scope as "local"|"regional"|"international") ?? "local";
      cells[idx][s]++;
    }
    return cells;
  });

// ─── AI: suggest seed feeds for a country ───────────────────────────────────

export const suggestFeeds = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ countryCode: z.string(), countryName: z.string() }).parse(d))
  .handler(async ({ data }) => {
    const key = process.env.PERPLEXITY_API_KEY;
    if (!key) throw new Error("PERPLEXITY_API_KEY not configured");
    const prompt = `List 15 press-monitoring RSS or JSON feed URLs for ${data.countryName} (${data.countryCode}).
Split across:
- local: government ministries, national newspapers, national TV, central bank, gazette
- regional: CARICOM, OECS, ECCB, CDB, regional wires
- international: IMF, World Bank, UN, UNDP, UNCTAD country pages, Reuters/AP topic feeds

Return strict JSON array, each item: { "scope": "local|regional|international", "kind": "rss|json|html", "endpoint": "https://...", "label": "..." }.
Only include feeds you have real evidence for. No commentary.`;
    const res = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "sonar-pro",
        messages: [
          { role: "system", content: "You return strict JSON only. No prose." },
          { role: "user", content: prompt },
        ],
        temperature: 0.1,
      }),
    });
    if (!res.ok) throw new Error(`suggest failed: ${res.status}`);
    const j = await res.json();
    const content: string = j?.choices?.[0]?.message?.content ?? "";
    const m = content.match(/\[[\s\S]*\]/);
    if (!m) return { suggestions: [] };
    try {
      const arr = JSON.parse(m[0]) as Array<{ scope: string; kind: string; endpoint: string; label?: string }>;
      return { suggestions: arr.filter((s) => /^https?:\/\//.test(s.endpoint)).slice(0, 15) };
    } catch {
      return { suggestions: [] };
    }
  });

// ─── Layer 4 · run source discovery for one country (admin/country_admin) ───

export const discoverSources = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ countryCode: z.string(), countryName: z.string() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: role } = await context.supabase.rpc("has_country_role", {
      _user_id: context.userId,
      _role: "country_admin",
      _country_code: data.countryCode,
    });
    if (!role) throw new Error("Only country admins can discover sources.");
    const { discoverForCountry } = await import("@/lib/press-discover.server");
    return await discoverForCountry(data.countryCode, data.countryName);
  });

// ─── Coverage for the most recent run (per country) ─────────────────────────

export interface CoverageCell {
  local: number;
  regional: number;
  international: number;
  total: number;
}

export const coverageFor = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ countryCode: z.string() }).parse(d))
  .handler(async ({ data, context }): Promise<CoverageCell> => {
    const { data: run } = await context.supabase
      .from("narrative_harvest_runs")
      .select("coverage")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const cov = ((run?.coverage ?? {}) as unknown as Record<string, CoverageCell>)[data.countryCode];
    return cov ?? { local: 0, regional: 0, international: 0, total: 0 };
  });

// ─── Latest cron sweep coverage (for the "N/22" badge in the sidebar) ───────

export interface CronCoverage {
  runId: string | null;
  startedAt: string | null;
  window: string | null;
  universeCount: number;
  coveredCount: number;
  missing: string[];
}

export const latestCronCoverage = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CronCoverage> => {
    const { data: run } = await context.supabase
      .from("narrative_harvest_runs")
      .select("id,started_at,window_key,countries_run,coverage")
      .eq("triggered_by", "cron")
      .not("finished_at", "is", null)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!run) {
      return { runId: null, startedAt: null, window: null, universeCount: 0, coveredCount: 0, missing: [] };
    }
    const cov = (run.coverage ?? {}) as Record<string, unknown>;
    const universe = Array.isArray(cov._universe) ? (cov._universe as string[]) : (run.countries_run ?? []);
    const missing = Array.isArray(cov._missing) ? (cov._missing as string[]) : [];
    return {
      runId: run.id as string,
      startedAt: run.started_at as string,
      window: (run.window_key as string | null) ?? null,
      universeCount: universe.length,
      coveredCount: Math.max(0, universe.length - missing.length),
      missing,
    };
  });


