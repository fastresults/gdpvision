# Persistent Minister Backfill Jobs

Today `backfillMinisters` runs inline in a single HTTP request. If the tab closes, the request is aborted mid-run and there is no way to see status, partial progress, or resume. This plan converts it into a **persistent job** with a durable status row, per-country progress, live polling in the UI, and a resume path.

## Data model (new tables)

Two tables, both admin-only, `service_role` for writes, `authenticated` read gated by `has_role(auth.uid(),'admin')`.

```text
minister_backfill_runs
  id uuid pk
  status text  ('queued'|'running'|'succeeded'|'failed'|'cancelled')
  requested_by uuid (auth.users.id)
  params jsonb   -- { country_code?, ministry_slugs?, force, dry_run, concurrency }
  totals jsonb   -- { attempted, resolved, updated, skipped, failed }
  started_at, finished_at, heartbeat_at, created_at timestamptz
  error text

minister_backfill_country_runs
  id uuid pk
  run_id uuid fk -> minister_backfill_runs(id) on delete cascade
  country_code text
  status text  ('queued'|'running'|'succeeded'|'failed'|'skipped')
  attempted, resolved, updated, skipped, failed int
  ministries jsonb  -- per-ministry action rows (same shape as today's CountrySummary.ministries)
  started_at, finished_at timestamptz
  unique(run_id, country_code)
```

`heartbeat_at` lets the UI show "stalled" if no update for >90s.

## Server functions

New file `src/lib/country-onboarding/minister-backfill-jobs.functions.ts`:

- `startMinisterBackfill(params)` — admin-only. Inserts a `queued` run row + one `queued` country row per target. Kicks off processing in the same request via `context.waitUntil(...)` when available, otherwise `void processRun(runId)` (fire-and-forget). Returns `{ run_id }` immediately.
- `getMinisterBackfillRun({ run_id })` — returns the run + all country rows for polling.
- `listMinisterBackfillRuns({ limit })` — recent runs for the history panel.
- `cancelMinisterBackfillRun({ run_id })` — sets `status='cancelled'`; processor checks this between countries and exits cleanly.

Refactor `minister-backfill.functions.ts`:

- Extract the current per-country logic into an internal `processCountry(runId, countryRow, ctx, params)` helper that updates the country row (`running` → totals → `succeeded`/`failed`) as it goes, and bumps `heartbeat_at` on the parent after each ministry.
- Keep the existing `backfillMinisters` export as a thin wrapper that calls `startMinisterBackfill` + polls to completion — preserves existing UI/API behavior for callers that want sync.

## UI changes

`src/routes/_authenticated/admin/countries.index.tsx`:

- "Run backfill" now calls `startMinisterBackfill` and stores `run_id` in component state + `localStorage` so a refresh reattaches.
- Add a `useQuery` polling `getMinisterBackfillRun` every 3s while `status ∈ {queued, running}`; stop when terminal.
- Show a progress list: per country → `attempted / resolved / updated / failed`, spinner while `running`, checkmark on `succeeded`.
- "Cancel" button while running.
- Small history dropdown (last 10 runs) via `listMinisterBackfillRuns`.

## Resume & safety

- `dry_run` still fully supported; UI toggle unchanged.
- On process start, any run stuck in `running` with `heartbeat_at < now() - 5 min` is auto-marked `failed` with `error='stalled'` at the top of `startMinisterBackfill` (cheap sweep). Reruns are safe because the backfill is idempotent (only touches gaps unless `force`).
- Because the loop is idempotent, "resume" is just: start a new non-force run — it will skip anything already filled.

## Verification

1. TS check clean (`bunx tsgo --noEmit`).
2. Start a dry-run against a single country (e.g. KNA) → run row goes queued → running → succeeded within a few seconds; UI shows per-ministry planned rows.
3. Start a live run against KNA → refresh the browser mid-run → UI reattaches to the same `run_id` and continues showing progress.
4. Confirm `ministry_profiles` rows for KNA are populated afterward.
5. Cancel a run mid-flight → status flips to `cancelled`, processor stops before the next country.

## Files touched

- New migration: `minister_backfill_runs` + `minister_backfill_country_runs` (with GRANTs + RLS as above).
- New: `src/lib/country-onboarding/minister-backfill-jobs.functions.ts`.
- Edited: `src/lib/country-onboarding/minister-backfill.functions.ts` (extract `processCountry`, keep sync wrapper).
- Edited: `src/routes/_authenticated/admin/countries.index.tsx` (polling UI, cancel, history).

No changes to `minister-research.server.ts`, Stage 5, or Stage 9.
