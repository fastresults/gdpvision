
## Why the Alex Saab story was missed

I pulled ATG's active feeds. Three concrete gaps explain the miss:

1. **The outlet publishing it isn't in the feed list.** `realnewsantiguabarbuda.com` was never discovered. Half of ATG's local/regional feeds are dead (Antigua Observer, OECS, CARICOM, ECCB, Loop, IMF, World Bank, GDELT country query — all deactivated after 5 consecutive failures). Nothing re-runs discovery to replace them.
2. **Query filters are too narrow.** The Google News queries only match `economy OR IMF OR debt OR investment OR tourism` (macro) and `CARICOM OR OECS OR ECCB OR CDB` (regional). A story framed around a **court judgment / former economic envoy / sanctions** falls outside those buckets. Reputational, legal, and governance risk stories are not covered.
3. **No entity awareness.** We never query by names that matter — the PM, ministers, the CBI program, named envoys, SOEs, ambassadors, court cases. A story like "Judgment against Antigua's former economic envoy Alex Saab" only reliably surfaces if we search by *person* and *institution*, not by macro nouns.

## Plan — 4 targeted upgrades

### 1. Auto-revive & re-discover dead feeds (feed hygiene)
- Add `revivePressFeeds(countryCode?)` in `press-discover.server.ts`:
  - For every `active=false, consecutive_failures>=5` feed, re-probe the endpoint once; on success flip `active=true, consecutive_failures=0`.
  - For every country with fewer than 4 active local feeds, call the existing `discoverForCountry` to top up.
- Wire into the hourly cron (`/api/public/press-tick`) as a pre-step, gated to once per 24h per country via `narrative_feeds.last_revive_at` (new column).
- Add a "Rediscover outlets" button in Signal Radar admin that calls the same function for the current country.

### 2. Broaden query feeds with a **reputational lane**
Add a new feed family per country (Google News + GDELT), separate from macro/regional:
- **Reputational / integrity lane:** `<CountryName> (lawsuit OR judgment OR sanction OR OFAC OR indictment OR corruption OR bribery OR "money laundering" OR envoy OR ambassador OR passport OR "citizenship by investment")`
- **Governance lane:** `<CountryName> (cabinet OR "prime minister" OR parliament OR budget OR "auditor general" OR procurement OR contract)`
- **International wires lane (GDELT themes):** `sourcecountry:<ISO> OR "<CountryName>"` filtered on GDELT themes `CORRUPTION, LEGISLATION, TRIAL, SANCTIONS, TAX_HAVEN`.
Seeded via a migration that upserts these three per active country. This is where the Alex Saab story lives.

### 3. Entity-driven query expansion (the biggest lift)
Introduce `narrative_entity_watchlist` per country — names to always query:
- Auto-populate from what's already in the corpus: `ministry_profiles.minister_profile.name`, `country_profiles` head-of-government, known ambassadors/envoys, CBI program name, top SOEs, central bank governor.
- A helper `buildEntityQueryFeeds(countryCode)` generates one Google News RSS feed per entity (`"<Name>" <CountryName>`) capped at ~10 entities per country to control volume.
- Refresh weekly via cron; admins can add/remove entities from a small "Watchlist" panel in Signal Radar.
This is what would have caught "Alex Saab" — he's an ex-envoy already in ATG's ministry/foreign-affairs history.

### 4. Widen the classifier funnel + surface misses
- Raise per-country Firecrawl upgrade cap from 8 → 15 for reputational-lane items (identified by feed `tier_hint='reputational'`), so full text — not just RSS snippet — reaches the classifier.
- Lower the classify-severity floor for reputational-lane items so a "medium" governance/legal signal still promotes instead of being dropped.
- Add a "Report missing story" input on Signal Radar: paste a URL, it runs `firecrawlUpgrade` + `classifySignal` + inserts as a signal AND creates/reactivates a feed for that outlet's domain — closes the loop the next time.

## Technical notes

- **Files touched:** `src/lib/press-discover.server.ts` (revive + entity expansion), `src/lib/press-tick.server.ts` (pre-revive hook, reputational upgrade cap), `src/lib/press-monitor.server.ts` (tier_hint plumbed through classify), new `src/lib/narrative-watchlist.server.ts`.
- **New DB objects (single migration):**
  - `narrative_feeds`: add `last_revive_at timestamptz`, `tier_hint` values extended to include `reputational|governance|entity`.
  - `narrative_entity_watchlist (country_code, entity_name, entity_role, active, created_at)` with GRANTs + RLS (admin write, authenticated read for country members).
  - Seed reputational + governance query feeds for all 22 active countries.
- **Cron:** existing hourly `/api/public/press-tick` gains a `?revive=1` weekly variant (Sunday 03:00 UTC) that runs revive + rediscovery + watchlist refresh before the normal sweep.
- **UI:** small additions to `SignalRadar` — "Rediscover outlets" button, "Report missing story" input, "Watchlist" drawer. No new routes.

## Expected outcome for ATG

After this ships and the first revive cycle runs:
- Antigua Observer, OECS, ECCB, Loop, CARICOM come back where endpoints are still valid.
- Real News Antigua & Barbuda (and similar outlets) get discovered via Perplexity + Firecrawl map.
- The reputational lane's Google News query `Antigua and Barbuda (judgment OR sanction OR envoy OR ...)` matches the Saab headline directly.
- Even without any of the above, the entity watchlist query `"Alex Saab" Antigua` catches it on the first tick.
