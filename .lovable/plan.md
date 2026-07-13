## Audit finding

The backend is healthy, but the workflow is brittle because long research stages run as one opaque request with weak progress tracking and stale-lock recovery. The current AIA workflow is sitting at **Stage 7: KPI seed** with:

- a parent workflow marked `running` at `kpi_seed`
- a child KPI run still `planning`
- no KPI draft yet
- no KPI attempt rows yet
- a prior KPI run already auto-marked stale after 15 minutes

So the process feels broken because the system cannot clearly distinguish **working**, **slow**, **stalled**, **partially completed**, and **recoverable**.

## Recommendations

### 1. Make the workflow resumable, not one long fragile chain

Replace the current “run all pending in one long server call” pattern with a resumable job model:

- each stage writes a durable checkpoint before and after every substep
- the workflow can resume from the last completed checkpoint
- a failed stage does not poison the entire country onboarding run
- retry only the failed unit, not the whole country
- the UI reads progress from the database instead of waiting on one long request

For example:

```text
workflow_run
  stage: kpi_seed
  step: worldbank_backfill
  processed: 9 / 24
  status: running
  last_heartbeat_at: 21:12:04
  retry_count: 1
```

### 2. Add real heartbeats to every long stage

Right now corpus ingest has some progress updates, but KPI seed and several AI research stages do not. Add heartbeat/progress updates to:

- KPI seed: pass name, KPI code, processed/total, success/fail counts
- ministry deep dive: current ministry, processed/total
- sector dossiers: current sector, processed/total
- second-brain seed: grounding loaded, model call running, commit pending
- capital flows: deterministic seed count, node currently researched, validation result

A run should be considered stale based on `last_heartbeat_at`, not `started_at` alone.

### 3. Split KPI seed into observable subjobs

KPI seed is the immediate pain point. It currently runs multiple passes internally, then records attempts only at the end. That means if it stalls or times out, the UI shows no useful evidence.

Change it so each KPI/pass writes an attempt immediately:

- broad Perplexity sweep attempt
- World Bank backfill per KPI
- IMF backfill per KPI
- targeted Perplexity per KPI
- Lovable AI inference/escalation per KPI

This gives operators a live trail and allows retries for only missing KPIs.

### 4. Stop relying on AI as the first source for canonical macro data

For reliable GDP/Sankey readiness, canonical numeric data should come from deterministic sources first:

- World Bank indicators
- IMF DataMapper/WEO where available
- committed country profile/GDP rows
- committed sector composition
- committed source registry
- already-ingested corpus chunks

AI should then be used for:

- filling gaps
- resolving source URLs
- summarizing rationale
- checking plausibility
- explaining missing values

This makes the process AI-first in judgment and synthesis, but data-first in execution.

### 5. Add stage-level quality gates with explicit outcomes

Every stage should finish with one of these statuses:

```text
committed        usable and written to target tables
ready           draft ready for review
needs_review    partial but explainable; blocked from auto-commit
failed          unrecoverable implementation/provider error
stale           heartbeat expired
skipped         upstream data already committed or dependency not ready
```

For each status, store a compact reason and next action. Example:

```text
KPI seed: needs_review
Filled 18/24 required KPIs.
Missing: unemployment_rate, fiscal_balance_gdp.
Next action: retry missing KPIs using targeted source search.
```

### 6. Fix workflow ordering for final Sankey reliability

Capital flows should run after the corpus and second-brain memory are available. Current ordering still places capital flows before second-brain seed in the parent workflow.

Recommended order:

```text
Level 1: profile, GDP, sectors, ministries, source registry
Level 2: KPI seed, ministry-sector map
Level 3: sector dossiers, ministry deep dive, corpus ingest
Level 4: second-brain seed
Level 5: capital flows / Sankey workbook
```

Stage 12 should not run until:

- GDP exists
- sector rows exist
- KPI seed has committed at least the required macro/fiscal KPIs
- source registry has active sources
- corpus ingest has at least one successful fetched document or a deterministic fallback is available

### 7. Add provider guardrails and bounded retries

Recent runs show provider/search-domain failures such as domain filter limits and empty payloads. Add a shared provider wrapper that enforces:

- max 20 search domains before calling Perplexity
- timeout per provider call
- retry with relaxed domain filters
- retry with deterministic public APIs before another AI call
- normalized error categories: `provider_400`, `timeout`, `empty_payload`, `validation_failed`, `no_source_url`

### 8. Make corpus ingest self-healing

Current AIA has active sources but no fetched corpus yet. The workflow needs source-level repair:

- show active / fetched / failed / unknown source counts before Stage 10
- retry only failed or unknown sources
- mark duplicate content as `deduped`, not silently “ok with 0 chunks”
- require at least one useful corpus document before dependent RAG stages treat the corpus as available
- keep per-source failure messages visible in the UI

### 9. Improve the operator UI from “spinner” to command center

Add a reliable workflow panel that shows:

- active stage and active substep
- elapsed time since last heartbeat
- progress counts
- latest error/blocked reason
- retry buttons for stale/failed/needs-review stages
- “resume workflow” instead of only “run all pending”
- evidence preview for KPI and capital-flow attempts

This directly addresses the user experience problem: no more guessing whether the process is actually working.

## Implementation plan

### Phase 1 — Stabilize the current stuck point

- Add heartbeat/progress writes to KPI seed.
- Record KPI attempts incrementally instead of only at the end.
- Add a `resume/retry missing KPIs` path.
- Update stale detection to use heartbeat age.
- Surface live KPI progress in the onboarding UI.

### Phase 2 — Make orchestration resumable

- Introduce a durable checkpoint model in existing workflow/run tables or a small new workflow-step table.
- Convert `run all pending` into a stage-by-stage resumable loop.
- Add per-stage retry counts and final status reasons.
- Make the parent workflow continue cleanly after recoverable `needs_review` stages.

### Phase 3 — Harden data acquisition

- Centralize provider calls behind a reliability wrapper.
- Enforce domain-filter limits and timeout handling.
- Prefer deterministic World Bank/IMF/committed-data sources before model calls.
- Add source/corpus repair actions for failed or unknown fetches.

### Phase 4 — Reorder and gate Sankey generation

- Move capital flows after second-brain seed.
- Add explicit preflight checks before Stage 12.
- Keep deterministic capital-flow seeding from committed KPIs/sectors.
- Run AI only for missing flow nodes and validation explanations.
- Commit Stage 12 only when coverage and reconciliation gates pass; otherwise produce a clear review packet.

### Phase 5 — Observability and operator trust

- Add a workflow health dashboard with live heartbeat, current substep, run age, source/corpus coverage, KPI coverage, and Sankey readiness.
- Add one-click retry/resume actions.
- Add compact audit logs per stage so every committed number has a traceable source and every missing number has a reason.

## Technical touchpoints

- `src/lib/country-onboarding/orchestrator.functions.ts`
- `src/lib/country-onboarding/corpus.functions.ts`
- `src/lib/country-onboarding/kpi-research.server.ts`
- `src/lib/country-onboarding/capital-flows.server.ts`
- `src/lib/country-onboarding/ingest.server.ts`
- `src/lib/country-onboarding/fallback.server.ts`
- `src/routes/_authenticated/admin/countries.$code.onboard.tsx`
- backend tables for onboarding runs, drafts, KPI attempts, capital-flow attempts, source documents, and workflow progress

## Expected result

After this hardening, country onboarding should behave like a reliable data pipeline:

- it runs independently
- it shows exactly what it is doing
- it can recover from slow/failing providers
- it does not lose partial work
- it does not require rerunning everything after one bad stage
- Stage 12 receives enough validated upstream data to produce a credible GDP Sankey workbook instead of guessing