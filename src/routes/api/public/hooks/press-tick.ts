// Chamber 05 · press-monitoring tick.
// Called by pg_cron twice a day (and by the "Run now" button) with an apikey header.
// Bypasses auth per /api/public/* convention — we validate the apikey ourselves.
import { createFileRoute } from "@tanstack/react-router";

type PressTickRequest = { window?: string; country?: string };

export const Route = createFileRoute("/api/public/hooks/press-tick")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Auth check — accept the project publishable/anon key in `apikey` header.
        const apiKey = request.headers.get("apikey") ?? request.headers.get("x-apikey");
        const expected = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY;
        if (!apiKey || !expected || apiKey !== expected) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401, headers: { "Content-Type": "application/json" },
          });
        }

        const body = (await request.json().catch(() => ({}))) as PressTickRequest;
        const windowKey = body.window ?? "adhoc";
        const filterCountry = body.country ?? null;

        const [{ supabaseAdmin }, mod] = await Promise.all([
          import("@/integrations/supabase/client.server"),
          import("@/lib/press-monitor.server"),
        ]);
        const { fetchFeed, classifySignal, pMap, canonicalUrl } = mod;

        const { data: run, error: runErr } = await supabaseAdmin
          .from("narrative_harvest_runs")
          .insert({ window_key: windowKey, triggered_by: filterCountry ? "manual" : "cron" })
          .select("id")
          .single();
        if (runErr || !run) return new Response(runErr?.message ?? "run insert failed", { status: 500 });

        const errors: Array<{ scope: string; msg: string }> = [];
        const countryList = new Set<string>();
        let feedsPolled = 0, itemsFetched = 0, itemsNew = 0, itemsPromoted = 0;

        try {
          // 1. Load active feeds
          let feedsQ = supabaseAdmin
            .from("narrative_feeds")
            .select("id,country_code,scope,kind,endpoint,etag,active,consecutive_failures")
            .eq("active", true);
          if (filterCountry) feedsQ = feedsQ.eq("country_code", filterCountry);
          const { data: feeds, error: fErr } = await feedsQ;
          if (fErr) throw fErr;

          // 2. Poll feeds in parallel
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
            const patch: Record<string, unknown> = {
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

          // 3. Insert raw items (idempotent per feed+guid_hash)
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

          // 4. Classify new items (per-country cap of 60/tick, budget-safe)
          const perCountryCap = 60;
          const seenPerCountry = new Map<string, number>();

          const { data: newItems } = await supabaseAdmin
            .from("narrative_feed_items")
            .select("id,country_code,url,title,raw_excerpt")
            .eq("state", "new")
            .order("fetched_at", { ascending: false })
            .limit(500);

          // Cross-country dedup against already-promoted signals in the last 3 days
          const canonSet = new Set<string>();
          const since = new Date(Date.now() - 3 * 86400_000).toISOString();
          const { data: recent } = await supabaseAdmin
            .from("intake_items")
            .select("url")
            .gte("created_at", since)
            .limit(2000);
          for (const r of recent ?? []) if (r.url) canonSet.add(canonicalUrl(r.url));

          const toClassify = (newItems ?? []).filter((it) => {
            const c = seenPerCountry.get(it.country_code) ?? 0;
            if (c >= perCountryCap) return false;
            if (it.url && canonSet.has(canonicalUrl(it.url))) return false;
            seenPerCountry.set(it.country_code, c + 1);
            return true;
          });

          // Sector menu cache per country
          const sectorMenuCache = new Map<string, string[]>();
          async function menu(cc: string) {
            const cached = sectorMenuCache.get(cc);
            if (cached) return cached;
            const { data } = await supabaseAdmin.from("country_sectors").select("sector_code").eq("country_code", cc);
            const m = (data ?? []).map((r) => r.sector_code as string);
            sectorMenuCache.set(cc, m);
            return m;
          }

          await pMap(toClassify, async (it) => {
            try {
              const sectorMenu = await menu(it.country_code);
              const c = await classifySignal({
                countryCode: it.country_code,
                url: it.url,
                raw: [it.title, it.raw_excerpt].filter(Boolean).join("\n\n"),
                sectorMenu,
              });
              const { data: sig, error: sigErr } = await supabaseAdmin
                .from("intake_items")
                .insert({
                  scope_key: it.country_code,
                  sector_code: c.sector_code || "cross",
                  topic: (c.topic || it.title || "").slice(0, 240),
                  summary: c.summary,
                  url: it.url,
                  proposed_weight: Math.max(1, Math.min(5, Math.round((c.severity + c.reach) / 2))),
                  scope: c.scope,
                  severity: Math.max(1, Math.min(5, c.severity)),
                  reach: Math.max(1, Math.min(5, c.reach)),
                  sentiment: Math.max(-2, Math.min(2, c.sentiment)),
                  recommendation: c.recommendation,
                  metadata: {
                    dossier_bullets: c.dossier_bullets,
                    rationale: c.rationale,
                    citations: c.citations ?? [],
                    source: "press-tick",
                    ingested_at: new Date().toISOString(),
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
              errors.push({ scope: `classify:${it.id}`, msg: (e as Error).message });
              await supabaseAdmin
                .from("narrative_feed_items")
                .update({ state: "error", error: (e as Error).message.slice(0, 400) })
                .eq("id", it.id);
            }
          }, 4);
        } catch (e) {
          errors.push({ scope: "tick", msg: (e as Error).message });
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
            errors: errors.slice(0, 50),
          })
          .eq("id", run.id);

        return Response.json({
          ok: true,
          run_id: run.id,
          window: windowKey,
          feeds_polled: feedsPolled,
          items_fetched: itemsFetched,
          items_new: itemsNew,
          items_promoted: itemsPromoted,
          errors: errors.length,
        });
      },
    },
  },
});
