
You're right. I over-engineered this. 8,400 lines across 20 files, a durable-job worker table, cron pings, fan-out substeps, timeouts, resume logic — for a workflow that fundamentally just needs to run **one stage at a time, well**, for one country at a time.

Here's the simpler plan.

## Principle

One country onboarding = one sequential run. Each stage finishes (or fails clearly) before the next starts. No fan-out, no worker pool, no cron, no "resume from step 47 of 122". Quality over throughput.

## What gets deleted

- `durable-worker.server.ts` (971 lines)
- `kpi-seed.server.ts` per-KPI fan-out substep expansion (522 lines → collapse into a single sequential pass)
- `onboarding_jobs`, `onboarding_job_steps`, `onboarding_job_events` tables
- `/api/public/hooks/onboarding-worker` route
- The pg_cron trigger
- The `DurableJobPanel` UI and its Resume/Recover controls
- All "child step" / "lease" / "heartbeat every N seconds" bookkeeping

## What replaces it

**One table: `onboarding_runs`** (already exists) with fields we already have:
`status`, `current_stage`, `stage_started_at`, `last_error`, `plan`.

**One server function: `runNextStage(runId)`**. It:
1. Reads the run, picks the next stage in the fixed order.
2. Sets `current_stage`, `stage_started_at`.
3. Executes that stage inline, sequentially, to completion.
4. Writes results to the real domain tables (kpis, ministries, sources, etc.) as it goes — each provider call commits immediately, same as today.
5. On success → advances `current_stage`. On error → sets `status='failed'`, `last_error=<message>`, stops.

**Fixed stage order** (sequential, no parallelism):
```text
plan → kpi_seed → source_registry → ministry_deep_dive
  → sector_dossiers → corpus_ingest → capital_flows → summarize → done
```

**Inside each stage** we also go sequential:
- `kpi_seed`: iterate the KPI registry one KPI at a time. World Bank → IMF → AI fallback. Commit each KPI row before moving to the next. If one KPI fails, log it on the row and continue — never abort the stage.
- `ministry_deep_dive`: one ministry at a time.
- `corpus_ingest`: one source at a time.
- Same pattern for the rest.

**Triggering:** the admin page has a single "Run next stage" button and an "Auto-advance" toggle that just polls `runNextStage` from the browser every few seconds while the tab is open. No background worker. If you close the tab, it pauses. Reopen, click Run, it continues from `current_stage`. That's the whole recovery story.

**Timeouts:** each provider call gets a hard 60s timeout. If it trips, that item is marked failed on its own row and the stage moves on. No stage-wide hang possible.

## Admin UI

Replace the current job panel with:
- Current stage + spinner
- Per-stage checklist with counts (e.g. "KPIs: 14/18 committed, 2 failed, 2 pending")
- Last error (if any) with a Retry-stage button
- Run-next-stage / Auto-advance toggle / Stop buttons

No "steps", no "leases", no "heartbeat 1:40:30 AM" — just the stages and what's inside them.

## Migration path

1. New migration: drop `onboarding_jobs`, `onboarding_job_steps`, `onboarding_job_events`, drop the cron job, drop the worker route.
2. Rewrite `orchestrator.functions.ts` around `runNextStage` (~200 lines).
3. Rewrite each stage's server function to be a plain sequential loop that commits per item (KPI seed, ministries, sources, capital flows already mostly work this way — just remove the substep wrapping).
4. Rewrite the admin panel around the new shape.
5. Reset AIA's `onboarding_runs` row to `current_stage='kpi_seed'` and run it through end-to-end as the acceptance test.

## Result

~1,500 lines instead of 8,400. One button. One stage at a time. Failures are visible and per-item, not "the whole job is blocked". Quality checks (GDP clamp, ≥3 inputs, citations, etc.) stay exactly as they are — those are the point.
