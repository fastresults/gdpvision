## Forensic finding

The current workflow is not reliably durable yet. The live AIA run is stuck because the parent pipeline is waiting on `kpi_seed`, while the child `onboarding_runs` row is still `planning` with `plan = null` and no heartbeat since it opened. No `kpi_research_attempts` were written, so the process died before incremental progress became visible. Recent AI gateway logs show Gemini calls around the same time, including one cancelled request, but the database run was never advanced past `planning`.

The root problem is architectural: a long, multi-stage research workflow is still running inside a single request chain. If the request, preview, browser, model call, or runtime is interrupted, the database is left with an open run lock and no safe resume point.

## Plan

### 1. Stop the immediate stuck-state safely
- Add a server-side recovery action that marks only stale open AIA workflow rows as `stale`/`failed` based on heartbeat age.
- Preserve all committed data and drafts.
- Make the admin UI show a clear “Recover stale run” action instead of forcing repeated “Run all pending” clicks into a lock.

### 2. Replace request-bound orchestration with durable jobs
- Add a durable job/step table for onboarding work:
  - one row per pipeline job
  - one row per stage/substep/KPI/source fetch
  - status, attempt count, heartbeat, lease expiry, checkpoint payload, output, and error
- Enforce idempotency with unique keys such as `country + stage + step_key`, so reruns resume or replace safely instead of duplicating work.
- Keep existing committed target tables as the source of truth for completion.

### 3. Split long stages into resumable substeps
- Refactor `kpi_seed` into small independent units:
  - deterministic World Bank/IMF pass
  - source-registry-backed fetch pass
  - targeted AI pass per missing KPI
  - inference pass only for remaining gaps
  - draft assembly/commit eligibility
- Persist every KPI attempt immediately after each provider call.
- Never wait until the full KPI loop finishes to write progress.

### 4. Add timeouts, retries, and leases per provider call
- Wrap Perplexity, Gemini, Firecrawl, embeddings, and raw fetch calls in explicit timeout helpers.
- Store provider failure reasons per step.
- Retry transient failures with capped attempts.
- Mark non-transient failures as `needs_review` instead of poisoning the whole pipeline.

### 5. Make the parent workflow a coordinator, not the worker
- Change `runCountryOnboardingPipeline` so it creates/resumes a durable job and returns immediately with a job id.
- Process stages from server-side worker functions that can be re-entered safely.
- Parent status is derived from child steps, not from a single in-memory `results` array.

### 6. Add a real operator command center
- Show live step counts: queued, running, complete, failed, needs review.
- Show current KPI/source being processed, last heartbeat, attempt count, and latest error.
- Add controls:
  - Resume job
  - Retry failed steps
  - Cancel job
  - Recover stale locks
  - Continue from checkpoint

### 7. Harden stage gates and data quality
- Before each stage, run deterministic preflight checks against committed tables.
- For capital flows, require committed GDP, sectors, KPIs, source registry, and corpus coverage before starting.
- If prerequisites are missing, the stage becomes `blocked` with an explicit reason, not `stuck`.

### 8. Make ingestion and research idempotent
- Ensure source ingest uses normalized URLs/document hashes/chunk hashes.
- Ensure KPI and capital-flow outputs upsert by country + semantic key.
- Ensure retries do not duplicate sources, chunks, attempts, memories, or flow rows.

### 9. Validation before declaring done
- Reproduce the current stuck state locally/live.
- Apply migration and code changes.
- Run AIA from a recovered state.
- Verify:
  - job returns immediately
  - progress rows update during execution
  - partial attempts are visible after every KPI/provider call
  - interrupted jobs can resume
  - stale locks no longer block the workflow
  - capital flows only starts after prerequisites are satisfied

## Technical implementation notes

- Add schema for durable pipeline jobs/steps/events with admin-only access policies and service-role grants.
- Introduce shared helpers for:
  - heartbeat updates
  - step lease acquisition
  - timeout-wrapped provider calls
  - retry classification
  - idempotent step completion
- Move long KPI logic out of one monolithic `runAgenticKpiLoop` and into checkpointable step executors.
- Keep the UI calling server functions through TanStack Start; do not use browser polling as the worker.
- If a durable workflow connector is available in this workspace, wire the job runner through it; otherwise implement a database-backed worker endpoint with signed internal dispatch and resumable leases.