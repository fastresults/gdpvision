## What I found

- **Run all pending is not durable.** The onboarding page runs stages sequentially from the browser tab. Each stage is a long server call, then the UI commits the draft, then asks for the next stage.
- **Stage 8 is currently stuck in `planning` for BLZ.** It opened a run row, then never finished or updated heartbeat/progress. That lock blocks reruns until the stale-lock cleanup catches it.
- **Stages 10 and 11 have no committed rows.** They cannot complete the downstream pipeline yet.
- **Stage 12 already produced a needs-review capital-flow draft.** It failed coverage/reconciliation gates, then a later retry/self-heal attempted to create another live draft and hit the unique “one live draft per stage” constraint.
- **Stage 9 succeeds because it is comparatively more tolerant.** It researches ministries one by one, catches per-ministry failures, and can still commit partial successful results.
- **Stages 8, 10, and 12 are timeout-prone.** Stage 8 uses one large reasoning call for all sectors, stage 10 scrapes/embeds many sources sequentially, and stage 12 performs multi-pass per-node research. These should not run as one fragile browser-driven chain.

## Plan

### 1. Unblock the immediate BLZ state safely
- Add a repair path that marks stale `planning/searching/extracting/validating` onboarding runs as `stale` sooner when they have no heartbeat.
- Make the existing **Clear locks** action also surface exactly which stages were cleared.
- Ensure a needs-review draft is treated as a deliberate stop, not as something the runner keeps trying to overwrite.

### 2. Fix the run-all orchestration contract
- Replace the browser-only “keep this tab open” loop with a durable onboarding pipeline record.
- When admin clicks **Run all pending**, create a pipeline job and return immediately.
- The UI polls the pipeline job for current stage, progress, errors, and review blockers.
- Each stage becomes resumable: completed stages are skipped, ready drafts are committed, needs-review drafts pause the pipeline with a clear reason.

### 3. Break long stages into bounded units
- **Stage 8 sector dossiers:** run one sector or a small batch per unit, save progress after each batch, and commit successfully produced rows instead of requiring one giant all-sector response.
- **Stage 10 corpus ingest:** process a limited number of sources per unit, persist per-source status, and resume until all active sources are attempted.
- **Stage 11 second-brain seed:** run only after sector dossiers and corpus chunks exist; use committed public corpus plus any allowed private corpus scope later.
- **Stage 12 capital flows:** keep the current coverage gate, but if a draft is `needs_review`, pause and show “review/commit or supersede draft” rather than retrying into a duplicate-draft error.

### 4. Make draft lifecycle explicit
- Introduce one of two safe behaviors for re-runs:
  - **Supersede old uncommitted draft** before creating a new one, or
  - **Update the existing live draft** for the same country/stage.
- Do this consistently for sector dossiers, corpus ingest reports, second-brain seed, and capital flows.
- Keep committed drafts immutable as audit history.

### 5. Add progress and heartbeat updates everywhere
- Update `onboarding_runs.updated_at` and `plan` before and after every expensive external call.
- Add progress fields for stage 8 sector count, stage 10 source count/chunk count, stage 11 memory generation, and stage 12 node attempts/reconciliation.
- Auto-mark runs stale only when no heartbeat has been seen for the chosen timeout window.

### 6. Preserve the intended data logic
- Keep the decision order: check existing corpus first, run deep research when corpus is insufficient, then infer only after research attempts are exhausted.
- Log which data was directly sourced vs inferred in the draft payload and summary so admins can see how gaps were filled.
- Ensure public corpus outputs are stamped public; private admin uploads remain excluded unless the run is explicitly country-private scoped.

### 7. Add verification for this failure mode
- Add tests/assertions that:
  - A stuck `planning` run is recoverable.
  - A needs-review capital-flow draft does not trigger duplicate-draft errors.
  - Run-all resumes after stages 7/9 are already committed.
  - Stage 10 can process sources incrementally without blocking the whole pipeline.

## Expected result

Admins can click **Run all pending** once, leave the tab, and the system will either finish stages 8-12 or pause with a specific review blocker instead of getting stuck in `planning` or duplicate-draft failures.