// Chamber 05 · shared press-tick harvester (invoked inline by server fn + public route).
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  fetchFeed,
  classifySignal,
  pMap,
  canonicalUrl,
  firecrawlUpgrade,
} from "@/lib/press-monitor.server";
import { findCluster, storyKeyFromTitle, attachSibling } from "@/lib/story-cluster.server";
import { computePriorityScore, credibilityFor, PRIORITY_WEIGHTS } from "@/lib/narrative-priority-score";

/** Pseudo-country code for shared regional/international outlets. */
export const REGIONAL_CODE = "CAR";
const LINK_CHECK_CAP = 80;

type LinkCheck = { status: "verified" | "redirected" | "broken" | "unchecked" | "missing"; final_url: string | null };

/** Confirm an article link opens. Redirects to another site are flagged. */
export async function checkLink(url: string): Promise<LinkCheck> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 7_000);
  try {
    const r = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: ac.signal,
      headers: { "User-Agent": "GDPVision-LinkCheck/1.0", Range: "bytes=0-2048" },
    });
    await r.body?.cancel().catch(() => {});
    if (!r.ok && r.status !== 206 && r.status !== 403) return { status: "broken", final_url: r.url || url };
    const host = (u: string) => {
      try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; }
    };
    return { status: host(r.url || url) === host(url) ? "verified" : "redirected", final_url: r.url || url };
  } catch {
    return { status: "broken", final_url: null };
  } finally {
    clearTimeout(t);
  }
}

/** A sibling joined a story: raise the primary's spread factor and score. */
async function bumpSpread(primaryId: string) {
  const { data } = await supabaseAdmin
    .from("intake_items")
    .select("priority_factors,priority_score")
    .eq("id", primaryId)
    .maybeSingle();
  const f = (data?.priority_factors ?? null) as Record<string, number> | null;
  if (!f) return;
  const spread = (f.spread_raw ?? 1) + 1;
  const spreadPts = Math.round((Math.min(spread - 1, 4) / 4) * PRIORITY_WEIGHTS.spread * 10) / 10;
  const score = Math.round(((Number(data?.priority_score) || 0) - (f.spread ?? 0) + spreadPts) * 10) / 10;
  await supabaseAdmin
    .from("intake_items")
    .update({ priority_score: score, priority_factors: { ...f, spread: spreadPts, spread_raw: spread } })
    .eq("id", primaryId);
}

export type PressTickResult = {
  ok: true;
  run_id: string;
  window: string;
  feeds_polled: number;
  items_fetched: number;
  items_new: number;
  items_promoted: number;
  errors: number;
};

export async function runPressTick(opts: {
  windowKey?: string;
  filterCountry?: string | null;
  triggeredBy?: string;
}): Promise<PressTickResult> {
  const windowKey = opts.windowKey ?? "adhoc";
  const filterCountry = opts.filterCountry ?? null;
  const triggeredBy = opts.triggeredBy ?? (filterCountry ? "manual" : "cron");

  const { data: run, error: runErr } = await supabaseAdmin
    .from("narrative_harvest_runs")
    .insert({ window_key: windowKey, triggered_by: triggeredBy })
    .select("id")
    .single();
  if (runErr || !run) throw new Error(runErr?.message ?? "run insert failed");

  const errors: Array<{ scope: string; msg: string }> = [];
  const countryList = new Set<string>();
  // Seed the coverage universe up-front: every country that has at least one
  // active feed. This way `countries_run` always reflects the intended sweep,
  // and any country that is dropped mid-run (feed error, classify failure)
  // shows up as a coverage gap in the UI rather than silently disappearing.
  const universe = new Set<string>();
  {
    let uniQ = supabaseAdmin.from("narrative_feeds").select("country_code").eq("active", true);
    if (filterCountry) uniQ = uniQ.eq("country_code", filterCountry);
    const { data: uni } = await uniQ;
    for (const r of uni ?? []) universe.add(r.country_code as string);
    for (const cc of universe) countryList.add(cc);
  }
  let feedsPolled = 0,
    itemsFetched = 0,
    itemsNew = 0,
    itemsPromoted = 0,
    clustersMerged = 0;

  // Pre-step · once per country per ~20h, auto-revive dead feeds + top up.
  // Skipped for gap-fill sub-runs to keep them cheap.
  if (windowKey !== "gap-fill") {
    try {
      const { revivePressFeeds } = await import("@/lib/press-discover.server");
      await revivePressFeeds({ countryCode: filterCountry });
    } catch (e) {
      errors.push({ scope: "revive", msg: (e as Error).message });
    }
  }

  try {
    let feedsQ = supabaseAdmin
      .from("narrative_feeds")
      .select("id,country_code,scope,kind,endpoint,etag,active,consecutive_failures,tier_hint")
      .eq("active", true);
    if (filterCountry) feedsQ = feedsQ.eq("country_code", filterCountry);
    const { data: feeds, error: fErr } = await feedsQ;
    if (fErr) throw fErr;

    const fetched = await pMap(
      feeds ?? [],
      async (f) => {
        feedsPolled++;
        countryList.add(f.country_code);
        const r = await fetchFeed({
          id: f.id,
          country_code: f.country_code,
          scope: f.scope as "local" | "regional" | "international",
          kind: f.kind as "rss" | "json" | "gdelt" | "google_news" | "html",
          endpoint: f.endpoint,
          etag: f.etag,
          active: f.active,
          consecutive_failures: f.consecutive_failures ?? 0,
        });
        const patch: {
          last_polled_at: string;
          last_status: string;
          last_error: string | null;
          consecutive_failures?: number;
          etag?: string;
          active?: boolean;
        } = {
          last_polled_at: new Date().toISOString(),
          last_status: r.status,
          last_error: r.error ?? null,
        };
        if (r.status === "ok") {
          patch.consecutive_failures = 0;
          if (r.etag) patch.etag = r.etag;
        } else if (r.status === "error") {
          const cf = (f.consecutive_failures ?? 0) + 1;
          patch.consecutive_failures = cf;
          if (cf >= 5) patch.active = false;
          errors.push({ scope: `feed:${f.id}`, msg: r.error ?? "unknown" });
        }
        await supabaseAdmin.from("narrative_feeds").update(patch).eq("id", f.id);
        return { feed: f, items: r.items };
      },
      6,
    );

    for (const { feed, items } of fetched) {
      if (!items.length) continue;
      itemsFetched += items.length;
      const rows = items.map((it) => ({
        feed_id: feed.id,
        country_code: feed.country_code,
        guid_hash: it.guid_hash,
        url: it.url,
        title: it.title,
        raw_excerpt: it.raw_excerpt,
        published_at: it.published_at,
        state: "new",
      }));
      const { data: inserted, error: iErr } = await supabaseAdmin
        .from("narrative_feed_items")
        .upsert(rows, { onConflict: "feed_id,guid_hash", ignoreDuplicates: true })
        .select("id,feed_id,country_code,url,title,raw_excerpt,state");
      if (iErr) {
        errors.push({ scope: `insert:${feed.id}`, msg: iErr.message });
        continue;
      }
      itemsNew += inserted?.length ?? 0;
    }

    const perCountryCap = 60;

    // Fair per-country slice: pull the newest N per country from state=new
    // so a burst from one country cannot starve the classification queue.
    const perCountryFetch = 40;
    type PoolItem = {
      id: string;
      country_code: string;
      url: string | null;
      title: string;
      raw_excerpt: string | null;
      feed_id: string | null;
      tier_hint: string | null;
    };
    // Build feed_id → tier_hint map from feeds we just polled.
    const feedTier = new Map<string, string | null>();
    for (const f of feeds ?? [])
      feedTier.set(f.id as string, (f as { tier_hint?: string | null }).tier_hint ?? null);
    const perCountryPool = new Map<string, PoolItem[]>();
    const targetCountries = filterCountry ? [filterCountry] : Array.from(universe);
    await pMap(
      targetCountries,
      async (cc) => {
        const { data } = await supabaseAdmin
          .from("narrative_feed_items")
          .select("id,country_code,url,title,raw_excerpt,feed_id")
          .eq("state", "new")
          .eq("country_code", cc)
          .order("fetched_at", { ascending: false })
          .limit(perCountryFetch);
        const rows: PoolItem[] = (data ?? []).map((r) => ({
          id: r.id as string,
          country_code: r.country_code as string,
          url: (r.url as string | null) ?? null,
          title: (r.title as string | null) ?? "",
          raw_excerpt: (r.raw_excerpt as string | null) ?? null,
          feed_id: (r.feed_id as string | null) ?? null,
          tier_hint: r.feed_id ? (feedTier.get(r.feed_id as string) ?? null) : null,
        }));
        if (rows.length) perCountryPool.set(cc, rows);
      },
      8,
    );

    const canonSet = new Set<string>();
    const since = new Date(Date.now() - 3 * 86400_000).toISOString();
    const { data: recent } = await supabaseAdmin
      .from("intake_items")
      .select("url")
      .gte("created_at", since)
      .limit(2000);
    for (const r of recent ?? []) if (r.url) canonSet.add(canonicalUrl(r.url));

    // Round-robin interleave so every country gets classification progress.
    const seenPerCountry = new Map<string, number>();
    const toClassify: PoolItem[] = [];
    const cursors = new Map<string, number>();
    const countryQueue = Array.from(perCountryPool.keys());
    let anyLeft = true;
    while (anyLeft) {
      anyLeft = false;
      for (const cc of countryQueue) {
        const pool = perCountryPool.get(cc) ?? [];
        const idx = cursors.get(cc) ?? 0;
        if (idx >= pool.length) continue;
        cursors.set(cc, idx + 1);
        anyLeft = true;
        const it = pool[idx];
        const c = seenPerCountry.get(it.country_code) ?? 0;
        if (c >= perCountryCap) continue;
        if (it.url && canonSet.has(canonicalUrl(it.url))) {
          await supabaseAdmin
            .from("narrative_feed_items")
            .update({ state: "duplicate" })
            .eq("id", it.id);
          clustersMerged++;
          continue;
        }
        seenPerCountry.set(it.country_code, c + 1);
        toClassify.push(it);
      }
    }

    // Layer 3 · Firecrawl upgrade. Reputational/entity lanes get a bigger
    // per-country budget because the classifier needs full text to reliably
    // catch lawsuits, sanctions, envoy stories — snippets aren't enough.
    const upgradeCapDefault = 8;
    const upgradeCapReputational = 15;
    const upgradeSeen = new Map<string, { r: number; d: number }>();
    const isRepLane = (t: string | null) =>
      t === "reputational" || t === "entity" || t === "governance";
    const upgradeTargets = toClassify.filter((it) => {
      if (!it.url) return false;
      const bucket = upgradeSeen.get(it.country_code) ?? { r: 0, d: 0 };
      const cap = isRepLane(it.tier_hint) ? upgradeCapReputational : upgradeCapDefault;
      const used = isRepLane(it.tier_hint) ? bucket.r : bucket.d;
      if (used >= cap) return false;
      if (isRepLane(it.tier_hint)) bucket.r++;
      else bucket.d++;
      upgradeSeen.set(it.country_code, bucket);
      return true;
    });
    const upgraded = new Map<string, string>();
    await pMap(
      upgradeTargets,
      async (it) => {
        const md = await firecrawlUpgrade(it.url!);
        if (md) upgraded.set(it.id, md);
      },
      4,
    );

    const sectorMenuCache = new Map<string, string[]>();
    async function menu(cc: string) {
      const cached = sectorMenuCache.get(cc);
      if (cached) return cached;
      const { data } = await supabaseAdmin
        .from("country_sectors")
        .select("sector_code")
        .eq("country_code", cc);
      const m = (data ?? []).map((r) => r.sector_code as string);
      sectorMenuCache.set(cc, m);
      return m;
    }

    // Every country the scan covers (onboarded + media-only), and the shared
    // regional/international outlets with their credibility.
    const knownCountries: Record<string, string> = {};
    {
      const [{ data: cs }, { data: mcs }] = await Promise.all([
        supabaseAdmin.from("countries").select("code,name"),
        supabaseAdmin.from("narrative_media_countries").select("code,name,is_regional").eq("active", true),
      ]);
      for (const c of cs ?? []) knownCountries[c.code as string] = (c.name as string) ?? c.code;
      for (const c of mcs ?? []) if (!c.is_regional) knownCountries[c.code as string] = c.name as string;
    }
    const outletCred = new Map<string, number>();
    {
      const { data: outs } = await supabaseAdmin.from("narrative_outlets").select("domain,credibility");
      for (const o of outs ?? []) outletCred.set((o.domain as string).toLowerCase(), o.credibility as number);
    }
    const outletOf = (u: string | null) => {
      if (!u) return null;
      try {
        return new URL(u).hostname.replace(/^www\./, "");
      } catch {
        return null;
      }
    };
    const credOf = (url: string | null, feedScope: string | null) => {
      const d = outletOf(url);
      let oc: number | null = null;
      if (d) for (const [dom, c] of outletCred) if (d === dom || d.endsWith("." + dom)) oc = c;
      return credibilityFor({ domain: d, outletCredibility: oc, feedScope });
    };

    // Phase 1 — classify all in parallel, collect results (no inserts yet).
    type ClassifyResult = {
      it: (typeof toClassify)[number];
      c: Awaited<ReturnType<typeof classifySignal>>;
      pScore: number;
      targets: string[];
    };
    const classified: ClassifyResult[] = [];
    await pMap(
      toClassify,
      async (it) => {
        try {
          const regional = it.country_code === REGIONAL_CODE;
          const sectorMenu = regional ? [] : await menu(it.country_code);
          const upgradedMd = upgraded.get(it.id);
          const rawForClassify = upgradedMd
            ? [it.title, upgradedMd].filter(Boolean).join("\n\n")
            : [it.title, it.raw_excerpt].filter(Boolean).join("\n\n");
          const c = await classifySignal({
            countryCode: regional ? "Caribbean-wide (identify each country)" : it.country_code,
            url: it.url,
            raw: rawForClassify,
            sectorMenu,
            knownCountries,
          });
          const targets = Array.from(
            new Set([...(regional ? [] : [it.country_code]), ...c.countries_mentioned]),
          );
          // Relevance gate: keep articles about a covered country AND
          // politics/economy; local feeds also keep anything not marked "ignore".
          const relevant = c.is_political || c.is_economic;
          const keep = regional
            ? targets.length > 0 && relevant
            : relevant || c.recommendation !== "ignore";
          if (!keep) {
            await supabaseAdmin
              .from("narrative_feed_items")
              .update({ state: "discarded" })
              .eq("id", it.id);
            return;
          }
          const sev = Math.max(1, Math.min(5, c.severity));
          const reach = Math.max(1, Math.min(5, c.reach));
          const leadish = c.recommendation === "lead" || c.recommendation === "counter";
          const amplify = c.recommendation === "amplify";
          const pScore =
            leadish && sev >= 4
              ? 1
              : leadish || (amplify && sev >= 4)
                ? 2
                : amplify || sev >= 4
                  ? 3
                  : sev >= 3 || reach >= 3
                    ? 4
                    : 5;
          classified.push({ it, c, pScore, targets });
        } catch (e) {
          errors.push({ scope: `classify:${it.id}`, msg: (e as Error).message });
          await supabaseAdmin
            .from("narrative_feed_items")
            .update({ state: "error", error: (e as Error).message.slice(0, 400) })
            .eq("id", it.id);
        }
      },
      4,
    );

    // Phase 1b — verify every article link opens (capped, time-limited).
    const links = new Map<string, LinkCheck>();
    await pMap(
      classified.filter((r) => r.it.url).slice(0, LINK_CHECK_CAP),
      async ({ it }) => {
        links.set(it.id, upgraded.has(it.id) ? { status: "verified", final_url: it.url } : await checkLink(it.url!));
      },
      6,
    );

    // Phase 2 — priority-ordered sequential insert with story clustering.
    classified.sort(
      (a, b) => a.pScore - b.pScore || b.c.severity + b.c.reach - (a.c.severity + a.c.reach),
    );

    for (const { it, c, targets } of classified) {
      const link = links.get(it.id) ?? { status: it.url ? "unchecked" : "missing", final_url: null };
      const tags = Array.from(
        new Set([
          ...c.tags,
          ...(c.is_political ? ["politics"] : []),
          ...(c.is_economic ? ["gdp"] : []),
          ...targets.map((t) => (knownCountries[t] ?? t).toLowerCase()),
        ]),
      );
      const credibility = credOf(it.url, it.tier_hint ?? c.scope);
      const baseScore = {
        severity: c.severity,
        reach: c.reach,
        is_political: c.is_political,
        is_economic: c.is_economic,
        credibility,
        mentions_government: c.mentions_government,
        age_hours: 0,
      };
      const common = {
        sector_code: c.sector_code || "cross",
        summary: c.summary,
        url: it.url,
        proposed_weight: Math.max(1, Math.min(5, Math.round((c.severity + c.reach) / 2))),
        scope: c.scope,
        severity: Math.max(1, Math.min(5, c.severity)),
        reach: Math.max(1, Math.min(5, c.reach)),
        sentiment: Math.max(-2, Math.min(2, c.sentiment)),
        recommendation: c.recommendation,
        tags,
        countries: targets,
        is_political: c.is_political,
        is_economic: c.is_economic,
        mentions_government: c.mentions_government,
        link_status: link.status,
        link_final_url: link.final_url,
        link_checked_at: links.has(it.id) ? new Date().toISOString() : null,
      };
      let firstSignal: string | null = null;
      let anyDup = false;
      try {
        for (const tc of targets) {
          countryList.add(tc);
          const topic = (c.topic || it.title || "").slice(0, 240);
          const match = await findCluster(tc, topic);
          if (match) {
            const { score, factors } = computePriorityScore({ ...baseScore, spread: 1 });
            await supabaseAdmin.from("intake_items").insert({
              ...common,
              scope_key: tc,
              topic,
              story_key: match.story_key,
              story_primary: false,
              duplicate_of: match.primary_id,
              state: "duplicate",
              priority_score: score,
              priority_factors: { ...factors, credibility_raw: credibility, spread_raw: 1 },
              metadata: {
                dossier_bullets: c.dossier_bullets,
                rationale: c.rationale,
                citations: c.citations ?? [],
                source: "press-tick",
                ingested_at: new Date().toISOString(),
                clustered_into: match.primary_id,
                cluster_similarity: match.similarity,
              },
            });
            await attachSibling(match.primary_id, { url: it.url, title: topic, outlet: outletOf(it.url) });
            await bumpSpread(match.primary_id);
            firstSignal ??= match.primary_id;
            anyDup = true;
            clustersMerged++;
            continue;
          }
          const { score, factors } = computePriorityScore({ ...baseScore, spread: 1 });
          const { data: sig, error: sigErr } = await supabaseAdmin
            .from("intake_items")
            .insert({
              ...common,
              scope_key: tc,
              topic,
              story_key: storyKeyFromTitle(topic),
              story_primary: true,
              priority_score: score,
              priority_factors: { ...factors, credibility_raw: credibility, spread_raw: 1 },
              metadata: {
                dossier_bullets: c.dossier_bullets,
                rationale: c.rationale,
                citations: c.citations ?? [],
                source: "press-tick",
                ingested_at: new Date().toISOString(),
                outlet: outletOf(it.url),
              },
            })
            .select("id")
            .single();
          if (sigErr) throw sigErr;
          firstSignal = sig.id;
          itemsPromoted++;
        }
        await supabaseAdmin
          .from("narrative_feed_items")
          .update({ state: anyDup && itemsPromoted === 0 ? "duplicate" : "promoted", signal_id: firstSignal })
          .eq("id", it.id);
        if (it.url) canonSet.add(canonicalUrl(it.url));
      } catch (e) {
        errors.push({ scope: `insert:${it.id}`, msg: (e as Error).message });
        await supabaseAdmin
          .from("narrative_feed_items")
          .update({ state: "error", error: (e as Error).message.slice(0, 400) })
          .eq("id", it.id);
      }
    }
  } catch (e) {
    errors.push({ scope: "tick", msg: (e as Error).message });
  }

  // Layer 4 coverage: per-country counts of promoted items in this run, split by scope.
  const coverage: Record<
    string,
    { local: number; regional: number; international: number; total: number }
  > = {};
  const sinceRun = new Date(Date.now() - 6 * 3600_000).toISOString();
  const { data: promotedRows } = await supabaseAdmin
    .from("intake_items")
    .select("scope_key,scope")
    .gte("created_at", sinceRun)
    .in("scope_key", Array.from(countryList));
  for (const r of promotedRows ?? []) {
    const cc = (r.scope_key as string) ?? "";
    if (!cc) continue;
    const bucket = coverage[cc] ?? { local: 0, regional: 0, international: 0, total: 0 };
    const sc = (r.scope as "local" | "regional" | "international" | null) ?? "local";
    bucket[sc] = (bucket[sc] ?? 0) + 1;
    bucket.total += 1;
    coverage[cc] = bucket;
  }
  for (const cc of countryList) {
    if (!coverage[cc]) coverage[cc] = { local: 0, regional: 0, international: 0, total: 0 };
  }

  // Coverage gap: any country in the intended universe that produced zero
  // promoted or duplicate items in this window. Surfaced as a `missing:*`
  // failure so the UI badge can call it out.
  const missing: string[] = [];
  for (const cc of universe) {
    if ((coverage[cc]?.total ?? 0) === 0) {
      missing.push(cc);
      errors.push({ scope: `missing:${cc}`, msg: "no items promoted this window" });
    }
  }

  // Gap-fill: sequentially re-tick up to 8 missing countries so a single
  // slow feed or classify miss doesn't leave a country empty until the next
  // hourly sweep. Skipped when this run is already a gap-fill or single-country tick.
  let gapFilled = 0;
  const gapFillErrors: Array<{ scope: string; msg: string }> = [];
  if (!filterCountry && windowKey !== "gap-fill" && missing.length > 0) {
    const targets = missing.slice(0, 8);
    for (const cc of targets) {
      try {
        const sub = await runPressTick({
          windowKey: "gap-fill",
          filterCountry: cc,
          triggeredBy: "auto",
        });
        if (sub.items_promoted > 0) gapFilled++;
      } catch (e) {
        gapFillErrors.push({ scope: `gap-fill:${cc}`, msg: (e as Error).message });
      }
    }
    if (gapFillErrors.length) errors.push(...gapFillErrors);
  }

  await supabaseAdmin
    .from("narrative_harvest_runs")
    .update({
      finished_at: new Date().toISOString(),
      countries_run: Array.from(countryList),
      feeds_polled: feedsPolled,
      items_fetched: itemsFetched,
      items_new: itemsNew,
      items_promoted: itemsPromoted,
      errors: errors.slice(0, 80),
      coverage: {
        ...coverage,
        _clusters_merged: clustersMerged,
        _universe: Array.from(universe),
        _missing: missing,
        _gap_filled: gapFilled,
      },
    })
    .eq("id", run.id);

  return {
    ok: true,
    run_id: run.id,
    window: windowKey,
    feeds_polled: feedsPolled,
    items_fetched: itemsFetched,
    items_new: itemsNew,
    items_promoted: itemsPromoted,
    errors: errors.length,
  };
}
