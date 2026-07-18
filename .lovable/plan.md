# Chamber 05 · Automated Press Monitoring

A twice-daily (07:00 & 19:00 local) harvester that pulls open press + gov + multilateral streams for every onboarded country, dedupes & AI-classifies each item against the country's ministries and GDP sectors, and lands it in the Signal Radar you already built — ready to triage.

## 1 · What we listen to (all public, no paid keys)

Each country carries a **feed registry**. Sources are grouped by scope so the Radar can filter cleanly:

| Scope | Streams |
| --- | --- |
| Local | Country gov press pages (per-ministry), national newspapers/TV RSS, official gazettes, central-bank news, national statistical office news |
| Regional | CARICOM, OECS, ECCB, CDB, OAS press rooms; regional wires (Caribbean Media Corp, Loop, Jamaica Observer, Trinidad Guardian, Barbados Today) |
| International | IMF/World Bank/UN/UNDP/UNCTAD press RSS + country pages, Reuters/AP topic feeds, Google News RSS (`when:12h` per-country query), GDELT DOC 2.0 (per-country ISO), OFAC/FATF updates |

Feed formats we support at ingest: RSS/Atom, JSON feeds, Google News RSS, GDELT DOC API, and generic HTML (scraped through Firecrawl — the connector is already wired).

Two things make the source list scale:
- A **seeded catalogue** (below) covers every onboarded country on day one.
- Country admins can add/mute sources in a new **Signal Sources** tab inside Chamber 5 without touching code.

## 2 · Data model additions (small, reversible)

New tables (`public`, RLS + GRANTs per project standard, `has_country_access` reused):

- `narrative_feeds` — one row per source: `country_code`, `scope` (local|regional|international), `kind` (rss|json|gdelt|google_news|html), `endpoint`, `sector_hint`, `ministry_hint`, `language`, `active`, `weight`, `last_polled_at`, `etag`, `last_hash`.
- `narrative_feed_items` — raw hits: `feed_id`, `country_code`, `guid_hash` (unique with feed), `url`, `title`, `published_at`, `raw_excerpt`, `state` (`new|classified|promoted|discarded|duplicate`), `signal_id` (nullable → `intake_items.id`), `fetched_at`.
- `narrative_harvest_runs` — one row per cron tick: `started_at`, `finished_at`, `countries_run`, `feeds_polled`, `items_fetched`, `items_new`, `items_promoted`, `errors jsonb`.

Reuse existing `intake_items` (already extended with `scope`, `severity`, `reach`, `sentiment`, `recommendation`, `metadata`) as the classified-signal store — no duplication.

**Dedup key**: `sha256(canonical_url || normalized_title)`; matched globally then per-country to catch syndications.

## 3 · Pipeline (per 12h tick)

```text
                  ┌─ pg_cron (07:00 / 19:00)
                  ▼
         /api/public/hooks/press-tick   (TSS server route, apikey-verified)
                  │
    ┌─────────────┼─────────────┐
    ▼             ▼             ▼
 Local feeds  Regional      International    ← poll in parallel, honour ETag / If-Modified
    │             │             │
    └──────► narrative_feed_items (raw, deduped by guid_hash)
                     │
                     ▼
        AI classifier fan-out (Perplexity sonar-pro)
        · scope · sector_code · ministry_slug
        · severity 1-5 · reach 1-5 · sentiment -2..+2
        · recommendation lead|amplify|counter|monitor|ignore
        · 4-bullet dossier · citations
                     │
                     ▼
              intake_items  (state='new_signal')
                     │
                     ▼
      Sidebar Radar (already built) + Realtime channel push
```

Guardrails: per-feed 3-retry backoff, per-tick 10-minute wall-clock, per-country cap of 60 new signals/tick, provider errors written to `narrative_harvest_runs.errors` and surfaced in the UI.

## 4 · Automation (cron, no new infra)

- Enable `pg_cron` + `pg_net` (already in project).
- Schedule two ticks:

```sql
select cron.schedule('press-tick-am','0 11 * * *',$$
  select net.http_post(
    url:='https://project--28b673a0-5141-49a9-b7c6-8a7a9fb07172.lovable.app/api/public/hooks/press-tick',
    headers:='{"Content-Type":"application/json","apikey":"<anon>"}'::jsonb,
    body:='{"window":"am"}'::jsonb
  );$$);
-- and 23:00 UTC for the PM tick
```

The route iterates onboarded countries, dispatches feed pollers in parallel (max 8), writes `narrative_harvest_runs`, and pushes any newly promoted signals via Supabase Realtime.

Manual "Run now" button in the Radar calls the same route with a `?country=XXX` filter for on-demand refresh.

## 5 · Visual & UX layer inside Chamber 5

Add three surfaces to the existing narrative shell — no route explosion:

1. **Radar heat-strip** (top of `/narrative` index): 24 hourly cells × 3 scope rows (local/regional/intl). Cell intensity = new-signal count; hover reveals top 3 topics. Instantly answers "what changed since I last looked?"
2. **Ministry & sector rails** on the sidebar: chips filter signals to Ministry X / Sector Y. Counts update live via Realtime.
3. **Signal Sources tab** (new): table of `narrative_feeds` with Add / Test / Mute; a "Suggest sources" button uses Perplexity to propose 10 gov + 10 media feeds for the country and stages them for one-click approval.

Every raw item retains its "provenance chevron" (`Feed → Raw → Classified → Signal`) already scaffolded via `LineageChevron`.

## 6 · Seeding countries on day one

Ship a migration with the catalogue: for each onboarded ISO-3 (start with ATG, KNA, LCA, GRD, VCT, DMA, BRB, JAM, TTO, GUY, BLZ, BHS, HTI, SUR, DOM, CUB, VGB, AIA, MSR, TCA), insert ~12 seed feeds (5 local gov, 3 local media, 2 regional, 2 intl country-page). Ministries with public press URLs (already in `ministries` / `ministry_profiles`) get their gov page auto-added with `ministry_hint` set — so any downstream signal lands pre-tagged to the right minister.

## 7 · Cost, throttling, resilience

- Perplexity classifier only fires on **new** items → typical tick: 300 new items × sonar-pro ≈ well within existing budget.
- ETag / `If-Modified-Since` cuts >70% of feed traffic.
- Circuit-breaker per feed: 3 consecutive failures ⇒ `active=false` + alert in Radar.
- All writes idempotent (`ON CONFLICT (feed_id, guid_hash) DO NOTHING`).
- Every tick writes a `narrative_harvest_runs` row so the admin has a persistent "last run at HH:MM, N signals" banner.

## 8 · Delivery order (each step ships independently)

1. Migration: `narrative_feeds`, `narrative_feed_items`, `narrative_harvest_runs` (+ GRANTs, RLS, `visibility` follows public/private framework).
2. Server route `/api/public/hooks/press-tick` + feed pollers (RSS/JSON/GDELT/GoogleNews/Firecrawl-HTML) with parallel fan-out.
3. Classifier fan-out reusing existing `classifyWithPerplexity`, dedup guard, promote-to-`intake_items`.
4. Cron: two 12-hour schedules + a stable manual-trigger button in Radar.
5. Seed catalogue migration for every onboarded country.
6. UI: Radar heat-strip, Ministry/Sector rails, Signal Sources tab with AI "Suggest sources".
7. Realtime channel + last-run banner + circuit-breaker surfacing.

## Technical notes

- Data API grants + RLS follow project standard (`has_country_access`, `visibility` public/private).
- Google News RSS URL pattern: `https://news.google.com/rss/search?q=<country>+when:12h&hl=en&gl=<cc>&ceid=<cc>:en`.
- GDELT: `https://api.gdeltproject.org/api/v2/doc/doc?query=sourcecountry:<ISO2>&mode=ArtList&format=json&timespan=12h`.
- Firecrawl mode: use whichever is live (`uses_connector_gateway` on the linked connection determines gateway vs direct — already documented in the project).
- All new server logic is `createServerFn` or `/api/public/*` server routes — **no new Supabase Edge Functions**.
