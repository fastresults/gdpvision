## Current state (verified)

- `narrative_feeds` has 12 active feeds × **22 countries** (AIA, ATG, BHS, BLZ, BMU, BRB, CYM, DMA, GLP, GRD, GUY, HTI, JAM, KNA, LCA, MSR, MTQ, SUR, TCA, TTO, VCT, VGB) — matches the full `countries` table.
- `runPressTick()` with no `filterCountry` iterates every active feed, so a cron POST with `{}` body naturally sweeps all 22 countries in one pass.
- `narrative_harvest_runs` history shows only 2 rows, both `triggered_by='manual'`. **No cron-triggered run has ever landed.** Either the pg_cron schedule was never installed, or it's firing but failing (auth/URL) before writing a run row.

So the coverage design is right; the schedule is the gap. Also worth hardening so a partial failure per-country doesn't silently drop countries from the sweep.

## Plan

### 1. Verify + (re)install the twice-daily cron
Run a diagnostic query against `cron.job` / `cron.job_run_details` (via `supabase--read_query`) to see whether a `press-tick-*` job exists and, if so, its last execution status. Based on that:
- If missing → install two schedules (AM + PM UTC) that POST to `/api/public/hooks/press-tick` with `apikey` = anon key and empty body `{}` (which fans out to all countries).
- If present but failing → capture the pg_net response, fix the URL/apikey, reinstall.

Schedules (staggered so PM ingest sees AM primaries for clustering):
- `press-tick-am`  → `0 6 * * *` (06:00 UTC)
- `press-tick-pm`  → `0 18 * * *` (18:00 UTC)

Use the stable production URL `https://project--28b673a0-5141-49a9-b7c6-8a7a9fb07172.lovable.app/api/public/hooks/press-tick`.

### 2. Make the sweep resilient per-country
In `src/lib/press-tick.server.ts`:
- Wrap the per-feed fetch + per-country promotion loop so one country's failure (Perplexity timeout, feed 5xx) cannot abort the sweep — record the error into `narrative_harvest_runs.failures[]` and continue.
- After the loop, assert `countries_run.length === activeCountryCount` and, for any missing country, emit a `failures[]` entry so the coverage gap is visible in the UI.

### 3. Coverage UI signal (small)
Extend the "Signals" header on `/admin/countries/$code/narrative` with a small badge showing the last cron run's `countries_run` count vs. total active countries (22/22 green, otherwise amber with a tooltip listing missing codes). Reads from `narrative_harvest_runs` — no schema change.

### 4. Weekly discovery pass
`press-discover.server.ts` already resolves per country. Add a `press-discover-weekly` cron (`0 4 * * 1`) that iterates all 22 countries so new local outlets get promoted into `narrative_feeds` without manual intervention.

## Answer to your question
Yes — architecturally the cron already fans out to all 22 countries in one call. But the scheduled job either isn't installed or isn't executing (zero cron rows in `narrative_harvest_runs`). Step 1 fixes that; steps 2–4 make sure a single country never quietly drops out of a run again.
