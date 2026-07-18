// Chamber 05 · shared press-tick harvester (invoked inline by server fn + public route).
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { fetchFeed, classifySignal, pMap, canonicalUrl, firecrawlUpgrade } from "@/lib/press-monitor.server";
import { findCluster, storyKeyFromTitle, attachSibling } from "@/lib/story-cluster.server";

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
    let uniQ = supabaseAdmin
      .from("narrative_feeds")
      .select("country_code")
      .eq("active", true);
    if (filterCountry) uniQ = uniQ.eq("country_code", filterCountry);
    const { data: uni } = await uniQ;
    for (const r of uni ?? []) universe.add(r.country_code as string);
    for (const cc of universe) countryList.add(cc);
  }
  let feedsPolled = 0, itemsFetched = 0, itemsNew = 0, itemsPromoted = 0, clustersMerged = 0;

  try {
    let feedsQ = supabaseAdmin
      .from("narrative_feeds")
      .select("id,country_code,scope,kind,endpoint,etag,active,consecutive_failures")
      .eq("active", true);
    if (filterCountry) feedsQ = feedsQ.eq("country_code", filterCountry);
    const { data: feeds, error: fErr } = await feedsQ;
    if (fErr) throw fErr;


    const fetched = await pMap(feeds ?? [], async (f) => {
      feedsPolled++;
      countryList.add(f.country_code);
      const r = await fetchFeed({
        id: f.id, country_code: f.country_code,
        scope: f.scope as "local" | "regional" | "international",
        kind: f.kind as "rss" | "json" | "gdelt" | "google_news" | "html",
        endpoint: f.endpoint, etag: f.etag,
        active: f.active, consecutive_failures: f.consecutive_failures ?? 0,
      });
      const patch: {
        last_polled_at: string; last_status: string; last_error: string | null;
        consecutive_failures?: number; etag?: string; active?: boolean;
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
    }, 6);

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
      if (iErr) { errors.push({ scope: `insert:${feed.id}`, msg: iErr.message }); continue; }
      itemsNew += inserted?.length ?? 0;
    }

    const perCountryCap = 60;

    // Fair per-country slice: pull the newest N per country from state=new
    // so a burst from one country cannot starve the classification queue.
    const perCountryFetch = 40;
    const perCountryPool = new Map<string, Array<{ id: string; country_code: string; url: string | null; title: string; raw_excerpt: string | null }>>();
    const targetCountries = filterCountry ? [filterCountry] : Array.from(universe);
    await pMap(targetCountries, async (cc) => {
      const { data } = await supabaseAdmin
        .from("narrative_feed_items")
        .select("id,country_code,url,title,raw_excerpt")
        .eq("state", "new")
        .eq("country_code", cc)
        .order("fetched_at", { ascending: false })
        .limit(perCountryFetch);
      if (data && data.length) perCountryPool.set(cc, data);
    }, 8);

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
    const toClassify: Array<{ id: string; country_code: string; url: string | null; title: string; raw_excerpt: string | null }> = [];
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
        if (it.url && canonSet.has(canonicalUrl(it.url))) continue;
        seenPerCountry.set(it.country_code, c + 1);
        toClassify.push(it);
      }
    }

    // Layer 3 · Firecrawl upgrade: fetch full-text markdown for the top-8 items
    // per country in this batch, keyed by first-seen order. Failures fall back to the snippet.
    const upgradeCapPerCountry = 8;
    const upgradeSeen = new Map<string, number>();
    const upgradeTargets = toClassify.filter((it) => {
      if (!it.url) return false;
      const n = upgradeSeen.get(it.country_code) ?? 0;
      if (n >= upgradeCapPerCountry) return false;
      upgradeSeen.set(it.country_code, n + 1);
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
      const { data } = await supabaseAdmin.from("country_sectors").select("sector_code").eq("country_code", cc);
      const m = (data ?? []).map((r) => r.sector_code as string);
      sectorMenuCache.set(cc, m);
      return m;
    }

    // Phase 1 — classify all in parallel, collect results (no inserts yet).
    type ClassifyResult = {
      it: typeof toClassify[number];
      c: Awaited<ReturnType<typeof classifySignal>>;
      pScore: number;
    };
    const classified: ClassifyResult[] = [];
    await pMap(toClassify, async (it) => {
      try {
        const sectorMenu = await menu(it.country_code);
        const upgradedMd = upgraded.get(it.id);
        const rawForClassify = upgradedMd
          ? [it.title, upgradedMd].filter(Boolean).join("\n\n")
          : [it.title, it.raw_excerpt].filter(Boolean).join("\n\n");
        const c = await classifySignal({
          countryCode: it.country_code,
          url: it.url,
          raw: rawForClassify,
          sectorMenu,
        });
        // Derive same P1..P5 score used by the triage rail so the highest-urgency
        // items are inserted (and cluster-headed) first.
        const sev = Math.max(1, Math.min(5, c.severity));
        const reach = Math.max(1, Math.min(5, c.reach));
        const leadish = c.recommendation === "lead" || c.recommendation === "counter";
        const amplify = c.recommendation === "amplify";
        const pScore =
          leadish && sev >= 4 ? 1 :
          leadish || (amplify && sev >= 4) ? 2 :
          amplify || sev >= 4 ? 3 :
          sev >= 3 || reach >= 3 ? 4 : 5;
        classified.push({ it, c, pScore });
      } catch (e) {
        errors.push({ scope: `classify:${it.id}`, msg: (e as Error).message });
        await supabaseAdmin
          .from("narrative_feed_items")
          .update({ state: "error", error: (e as Error).message.slice(0, 400) })
          .eq("id", it.id);
      }
    }, 4);

    // Phase 2 — priority-ordered sequential insert with story clustering.
    // Sequential (per country) so newly-inserted primaries are visible to the
    // next findCluster() call in the same tick.
    classified.sort((a, b) =>
      a.pScore - b.pScore ||
      (b.c.severity + b.c.reach) - (a.c.severity + a.c.reach),
    );

    const outletOf = (u: string | null) => {
      if (!u) return null;
      try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return null; }
    };

    for (const { it, c } of classified) {
      try {
        const topic = (c.topic || it.title || "").slice(0, 240);
        const match = await findCluster(it.country_code, topic);
        if (match) {
          // Sibling — attach to the existing primary, don't create a new card.
          await supabaseAdmin
            .from("intake_items")
            .insert({
              scope_key: it.country_code,
              sector_code: c.sector_code || "cross",
              topic,
              summary: c.summary,
              url: it.url,
              proposed_weight: Math.max(1, Math.min(5, Math.round((c.severity + c.reach) / 2))),
              scope: c.scope,
              severity: Math.max(1, Math.min(5, c.severity)),
              reach: Math.max(1, Math.min(5, c.reach)),
              sentiment: Math.max(-2, Math.min(2, c.sentiment)),
              recommendation: c.recommendation,
              story_key: match.story_key,
              story_primary: false,
              duplicate_of: match.primary_id,
              state: "duplicate",
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
          await supabaseAdmin
            .from("narrative_feed_items")
            .update({ state: "duplicate", signal_id: match.primary_id })
            .eq("id", it.id);
          clustersMerged++;
          if (it.url) canonSet.add(canonicalUrl(it.url));
          continue;
        }
        // New primary.
        const storyKey = storyKeyFromTitle(topic);
        const { data: sig, error: sigErr } = await supabaseAdmin
          .from("intake_items")
          .insert({
            scope_key: it.country_code,
            sector_code: c.sector_code || "cross",
            topic,
            summary: c.summary,
            url: it.url,
            proposed_weight: Math.max(1, Math.min(5, Math.round((c.severity + c.reach) / 2))),
            scope: c.scope,
            severity: Math.max(1, Math.min(5, c.severity)),
            reach: Math.max(1, Math.min(5, c.reach)),
            sentiment: Math.max(-2, Math.min(2, c.sentiment)),
            recommendation: c.recommendation,
            story_key: storyKey,
            story_primary: true,
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
        await supabaseAdmin
          .from("narrative_feed_items")
          .update({ state: "promoted", signal_id: sig.id })
          .eq("id", it.id);
        itemsPromoted++;
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
  const coverage: Record<string, { local: number; regional: number; international: number; total: number }> = {};
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
