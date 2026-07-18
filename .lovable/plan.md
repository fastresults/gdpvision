
# Chamber 05 — Real Web Press Harvesting Plan

Today Chamber 05 has plumbing (`narrative_feeds`, `press-tick`, radar) but no
actual **harvest strategy**. It only polls whatever feeds happen to be in the
table — which for most countries is empty or stale. We need a deliberate,
layered approach that guarantees local + regional + international coverage
for every onboarded country and keeps discovering new sources over time.

## The four layers of coverage

```text
Layer 1  Seeded catalog        curated per country + regional + global
Layer 2  Query-based streams   Google News RSS + GDELT DOC + Bing News
Layer 3  Deep scrape           Firecrawl for JS-heavy / paywalled outlets
Layer 4  Source discovery      AI + Firecrawl map to expand the catalog
```

Each layer feeds the same `narrative_feed_items` table, dedupes by canonical
URL + title hash (already implemented), and hands new items to the existing
Perplexity classifier.

### Layer 1 — Seeded catalog (deterministic backbone)

A migration seeds ~15-25 feeds per country across three tiers:

- **Local**: national newspaper of record, gov press office, central bank,
  finance ministry, statistics office, top 2 private outlets.
- **Regional**: CARICOM Today, ECCB, Caribbean Media Corporation, Loop News
  Caribbean, Jamaica Observer regional desk, Guardian TT business, OECS.
- **International**: IMF country page RSS, World Bank news, Reuters Caribbean
  tag, Bloomberg LatAm, FT Caribbean, AP Caribbean, Al Jazeera Americas.

Stored as rows in `narrative_feeds` with `is_seed=true` so a nightly job
re-asserts them if an admin accidentally deletes one.

### Layer 2 — Query-based streams (breadth guarantee)

For every country we register three synthetic "query feeds" that always
return recent hits even when curated outlets go quiet:

1. **Google News RSS** — `https://news.google.com/rss/search?q="{Country}"+(economy OR investment OR IMF OR tourism OR debt)&hl=en&gl=US`
2. **GDELT DOC 2.0** — `https://api.gdeltproject.org/api/v2/doc/doc?query=sourcecountry:{ISO}+(economy OR sovereign OR FDI)&mode=ArtList&format=json&timespan=1d`
3. **Bing News RSS** — country + ministry synonyms.

Each ministry (from `ministry_profiles`) also gets a targeted query feed
(`"{Country} Ministry of Finance"`, etc.) so sector-specific chatter surfaces
even when the source outlet isn't in the seeded catalog.

### Layer 3 — Deep scrape (quality lift)

Google News excerpts are 30-40 words. Before classification we upgrade the
top N items per tick via **Firecrawl `/v2/scrape`** (markdown, `onlyMainContent`)
so the classifier and dossier bullets are grounded in the full article, not
the RSS teaser. Budget: 60 scrapes per tick, prioritized by severity hints
(keywords: downgrade, default, IMF, hurricane, coup, indictment, election).

### Layer 4 — Source discovery loop (self-healing catalog)

Once a week a job runs per country:

1. Ask Perplexity `sonar-pro`: "List 20 news outlets covering {Country}
   economy, politics, business — return domain, name, tier (local/regional/
   international), RSS if known."
2. For domains without a known RSS, run **Firecrawl `/v2/map`** on the
   domain to find `/feed`, `/rss`, `/atom.xml`, or `/news` pages.
3. Test each candidate with a HEAD + parse; if valid, insert into
   `narrative_feeds` with `is_seed=false, discovered_at=now()`.
4. Auto-mute feeds with `consecutive_failures >= 5` (already implemented)
   and surface them in the Sources tab for admin review.

## Cron & orchestration

- **07:00 UTC** and **19:00 UTC** — full press-tick across all countries
  (Layers 1-3). Already wired via `runPressTick`.
- **02:00 UTC Sundays** — discovery run (Layer 4) per country, staggered
  6 countries at a time.
- **On-demand** — the existing "Run now" button in `RadarHeatStrip`.

All three schedules call the same `/api/public/hooks/press-tick` route with
different `mode` payloads so we keep one code path.

## Coverage guarantees (per country, per 24h)

The tick writes a per-country coverage row to `narrative_harvest_runs.coverage`:

```json
{ "local": 8, "regional": 4, "international": 6, "ministries_covered": 12 }
```

If any tier is `0` for two consecutive ticks, the harvester automatically
triggers a discovery run for that country and emits a UI warning in
`RadarHeatStrip` ("Local coverage gap — running discovery").

## What changes in code

- **DB migration** — add `is_seed`, `discovered_at`, `query_template`, `tier_hint`
  to `narrative_feeds`; add `coverage jsonb` to `narrative_harvest_runs`;
  seed Layer 1 feeds for all onboarded countries.
- **`press-monitor.server.ts`** — add `buildQueryFeeds(countryCode)` for Layer 2,
  `firecrawlUpgrade(items)` for Layer 3, `discoverFeeds(countryCode)` for Layer 4.
- **`press-tick.server.ts`** — pipeline becomes: fetch seeded → append query
  feeds → dedupe → Firecrawl-upgrade top-N → classify → coverage check.
- **`RadarHeatStrip.tsx`** — show a coverage badge per tier and a "Discover
  sources" button when a gap is detected.
- **`SignalSourcesPanel.tsx`** — split view into "Curated / Query / Discovered"
  groups; discovered feeds show a "Promote to curated" action.
- **New route** `/api/public/hooks/press-discover` — weekly discovery cron.
- **New migration** — pg_cron entries for 07:00, 19:00, and Sunday 02:00.

## Cost & rate-limit notes (technical)

- Google News RSS + GDELT are free and unauthenticated. Bing News RSS is free.
- Firecrawl: capped at 60 scrapes/tick × 12 countries × 2 ticks = ~1,440/day.
  Well inside the standard connector allotment.
- Perplexity: dedup already cuts classifier calls >70%; discovery adds
  ~12 sonar-pro calls per week per country.

## Success criteria

- Every onboarded country shows ≥ 5 local, ≥ 3 regional, ≥ 3 international
  signals in the Radar within 24h of a fresh install.
- Zero-signal countries drop to 0 within one week of enabling discovery.
- Article body (not RSS teaser) is present in ≥ 80% of classified signals.
