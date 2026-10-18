// Chamber 05 · Super Admin media scan: single-flight full scan, shared outlet
// sync and per-country coverage. Server-only.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const LOCK = "media-full-scan";

export async function withScanLock<T>(holder: string, minutes: number, fn: () => Promise<T>, lockName = LOCK) {
  const LOCK_NAME = lockName;
  const now = new Date().toISOString();
  await supabaseAdmin.from("narrative_scan_locks").delete().eq("name", LOCK_NAME).lt("expires_at", now);
  const { error } = await supabaseAdmin.from("narrative_scan_locks").insert({
    name: LOCK_NAME,
    holder,
    expires_at: new Date(Date.now() + minutes * 60_000).toISOString(),
  });
  if (error) throw new Error("A full scan is already running. Try again in a few minutes.");
  try {
    return await fn();
  } finally {
    await supabaseAdmin.from("narrative_scan_locks").delete().eq("name", LOCK_NAME).eq("holder", holder);
  }
}

/** Resolve a feed for every shared outlet and register it under the regional code. */
export async function syncOutlets() {
  const { resolveFeedFor } = await import("@/lib/press-discover.server");
  const { REGIONAL_CODE } = await import("@/lib/press-tick.server");
  const { data: outlets } = await supabaseAdmin.from("narrative_outlets").select("*").eq("active", true);
  let linked = 0;
  for (const o of outlets ?? []) {
    let feed = o.feed_url as string | null;
    if (!feed) {
      feed = await resolveFeedFor({ scope: o.scope as "regional" | "international", name: o.name, domain: o.domain, rss: null }).catch(() => null);
    }
    const status = feed ? "linked" : "no feed found";
    await supabaseAdmin
      .from("narrative_outlets")
      .update({ feed_url: feed, feed_status: status, last_synced_at: new Date().toISOString() })
      .eq("id", o.id);
    if (!feed) continue;
    await supabaseAdmin.from("narrative_feeds").upsert(
      {
        country_code: REGIONAL_CODE,
        scope: o.scope,
        kind: "rss",
        endpoint: feed,
        label: `${o.name} (shared outlet)`,
        tier_hint: o.scope,
        weight: o.credibility / 3,
        active: true,
      },
      { onConflict: "country_code,endpoint" },
    );
    linked++;
  }
  return { outlets: outlets?.length ?? 0, linked };
}

import { priorityFor } from "@/lib/narrative-priority";

export async function coverageReport() {
  const since7 = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const [{ data: cs }, { data: mcs }, { data: feeds }, { data: sigs }] = await Promise.all([
    supabaseAdmin.from("countries").select("code,name"),
    supabaseAdmin.from("narrative_media_countries").select("code,name,is_regional"),
    supabaseAdmin
      .from("narrative_feeds")
      .select("id,country_code,active,last_polled_at,consecutive_failures"),
    supabaseAdmin
      .from("intake_items")
      .select("scope_key,is_political,is_economic,link_status,recommendation,severity,reach")
      .gte("created_at", since7)
      .limit(20000),
  ]);
  type Row = {
    code: string;
    name: string;
    media_only: boolean;
    active_feeds: number;
    failing_feeds: number;
    last_polled_at: string | null;
    signals_7d: number;
    political_7d: number;
    economic_7d: number;
    broken_links_7d: number;
    strong_sources: number;
    p12_7d: number;
  };
  const rows = new Map<string, Row>();
  const add = (code: string, name: string, media_only: boolean) =>
    rows.set(code, {
      code, name, media_only,
      active_feeds: 0, failing_feeds: 0, last_polled_at: null,
      signals_7d: 0, political_7d: 0, economic_7d: 0, broken_links_7d: 0, strong_sources: 0, p12_7d: 0,
    });
  for (const c of cs ?? []) add(c.code as string, (c.name as string) ?? c.code, false);
  for (const c of mcs ?? []) add(c.code as string, c.name as string, true);
  const { data: st } = await supabaseAdmin.from("narrative_source_stats").select("feed_id,tier");
  const tierOf = new Map((st ?? []).map((x) => [x.feed_id as string, x.tier as number]));
  for (const f of feeds ?? []) {
    const r = rows.get(f.country_code as string);
    if (!r) continue;
    if (f.active && (tierOf.get(f.id as string) ?? 9) <= 2) r.strong_sources++;
    if (f.active) r.active_feeds++;
    if ((f.consecutive_failures as number) >= 3) r.failing_feeds++;
    const lp = f.last_polled_at as string | null;
    if (lp && (!r.last_polled_at || lp > r.last_polled_at)) r.last_polled_at = lp;
  }
  for (const s of sigs ?? []) {
    const r = rows.get(s.scope_key as string);
    if (!r) continue;
    r.signals_7d++;
    if (s.is_political) r.political_7d++;
    if (s.is_economic) r.economic_7d++;
    if (s.link_status === "broken") r.broken_links_7d++;
    if (priorityFor(s as never).level <= 2) r.p12_7d++;
  }
  return Array.from(rows.values()).sort((a, b) => a.active_feeds - b.active_feeds);
}

export async function sourceReport() {
  const [{ data: feeds }, { data: st }] = await Promise.all([
    supabaseAdmin.from("narrative_feeds").select("id,country_code,label,endpoint,scope,active,reach_tier,admin_weight"),
    supabaseAdmin.from("narrative_source_stats").select("*"),
  ]);
  const byId = new Map((st ?? []).map((x) => [x.feed_id as string, x]));
  return (feeds ?? []).map((f) => ({ ...f, stats: byId.get(f.id as string) ?? null }));
}
