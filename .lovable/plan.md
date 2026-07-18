# Why KNA (and most non-ATG countries) show 0 signals

I ran the forensics against the live database and cron schedule. Every one of the 22 countries in the second brain is correctly seeded — each has 12 active feeds in `narrative_feeds`. So the *coverage universe* is right. The failure is downstream, in **how the harvester is scheduled and how it distributes work**.

Three root causes, in order of blast radius:

## 1. The hourly cron is a stub — it does not harvest anything

`pg_cron` has four narrative jobs. Only one runs hourly:

```text
narrative-harvest-hourly     15 * * * *   → /api/public/hooks/narrative-harvest
narrative-press-tick-morning  0 7 * * *   → /api/public/hooks/press-tick
narrative-press-tick-evening  0 19 * * *  → /api/public/hooks/press-tick
narrative-press-discover-weekly 0 2 * * 0 → /api/public/hooks/press-discover
```

The hourly one calls `narrative-harvest.ts`, which is a leftover **skeleton** — it inserts an empty `harvest_runs` row and returns. It never fetches a feed, never classifies, never writes to `intake_items`. The real harvester (`runPressTick`) only runs **twice a day**. If any country's feeds error or produce nothing in a given 12-hour window, that country stays at zero for up to 12 hours — which is exactly what KNA is showing.

## 2. When the real tick does run, it is unfair across countries

Inside `runPressTick` (`src/lib/press-tick.server.ts`):

```ts
const { data: newItems } = await supabaseAdmin
  .from("narrative_feed_items")
  .select(...)
  .eq("state", "new")
  .order("fetched_at", { ascending: false })
  .limit(500);           // ← global cap, not per-country
```

With 22 countries × 12 feeds, a single tick easily yields >500 new items. The global `LIMIT 500` ordered by `fetched_at DESC` means whichever country's feeds happened to respond fastest fills the classification queue and starves the rest. The database confirms this: in the last 48h, `intake_items` has **149 rows for ATG and 0 for every other country** — because recent runs were manual, ATG-scoped, and the classifier only ever saw ATG items.

## 3. Manual "Run now" filters to one country and no gap-fill exists

The UI's Run Now button passes `filterCountry: <code>`, and the hourly stub does nothing. There is no mechanism that says "any country that produced zero signals this window, sweep it again." The `_missing` list is computed and stored on the run row, but nothing acts on it.

# The fix

Four changes, all backend + one small UI safety net. No new tables.

## A. Make the hourly cron actually harvest — for all countries

- **Rewrite** `src/routes/api/public/hooks/narrative-harvest.ts` to call `runPressTick({ windowKey: "hourly", filterCountry: null, triggeredBy: "cron" })`. Same auth pattern as `press-tick.ts` (validate `apikey` header against `SUPABASE_PUBLISHABLE_KEY`).
- **Reschedule** via `supabase--insert`: unschedule `narrative-harvest-hourly` and replace with a job that hits `/api/public/hooks/press-tick` every hour with `body='{}'`. Keep the 7am/7pm jobs as `window:"morning"` / `"evening"` for the durable run log. Remove the stub route file once no cron references it.
- Net effect: every country gets a full sweep every 60 minutes instead of every 12 hours.

## B. Fair per-country classification queue

In `runPressTick`, replace the global `LIMIT 500` with a **per-country round-robin** so every country gets a guaranteed slice each tick:

1. Query `narrative_feed_items` where `state='new'`, then in-code group by `country_code` and take up to N (e.g. 25) newest per country before flattening. Guarantees KNA is never starved by a burst from ATG.
2. Interleave the flattened list by country (round-robin) so classification progress is visible across the map, not sequential.
3. Keep the existing `perCountryCap = 60` promotion cap as an upper bound.

## C. Automatic gap-fill for coverage misses

At the end of `runPressTick`, after `_missing` is computed:

- For every country in `_missing` (cap 8 per tick to protect the Perplexity budget), enqueue a follow-up single-country tick inline via `runPressTick({ filterCountry: cc, windowKey: "gap-fill", triggeredBy: "auto" })`. Run sequentially with a small delay and swallow errors into the parent run's `errors` array so one bad country never blocks the rest.
- The coverage badge already surfaces `_missing`; gap-fill will usually close it before the next hourly tick.

## D. UI safety net — never show a bare "0 signals" when data exists

In `src/routes/_authenticated/admin/countries.$code.narrative.tsx` and the Signal Radar card:

- If the last-24h count is 0 for the current country, automatically widen the query to the last 7 days and add a small "Showing last 7 days — no fresh signals in 24h" note plus a one-click **Run now** for that country. This turns the current dead-end screen into an actionable state while the hourly cron catches up.

## E. Operational visibility

- Extend the `CoverageBadge` hover to also show "Last successful sweep per country" (derived from the most recent `narrative_harvest_runs.coverage` row where `coverage[cc].total > 0`). Makes it obvious whether KNA is "cron never touched it" vs "cron ran but produced 0."

# Files touched

```text
src/routes/api/public/hooks/narrative-harvest.ts   rewrite → calls runPressTick, or delete after cron migration
src/lib/press-tick.server.ts                       per-country fair queue + inline gap-fill
src/components/narrative/CoverageBadge.tsx         add per-country last-good sweep
src/routes/_authenticated/admin/countries.$code.narrative.tsx  7-day fallback + inline Run Now
supabase (cron)                                    unschedule stub, add hourly press-tick job
```

# Verification after build

1. Trigger `/api/public/hooks/press-tick` once with empty body, confirm `narrative_harvest_runs.countries_run` contains all 22 codes and `items_promoted > 0` for the majority.
2. Query `intake_items` in the last 2h grouped by `scope_key` — expect rows for most countries, not just ATG.
3. Reload `/admin/countries/KNA/narrative` — expect Signal Radar populated (or the 7-day fallback with a Run Now CTA if truly zero).
4. Confirm hourly `cron.job_run_details` shows successful `press-tick` runs going forward.
