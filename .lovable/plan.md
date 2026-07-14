## What is actually broken

Do I know what the issue is? Yes.

This is not one single model failure. The pipeline is failing operationally because the UI-driven sequential loop and the stage runners disagree about what “done” means.

Evidence from the current backend state for AIA:
- KPI seed is committed: `18` KPI rows exist.
- Second-brain seed is committed: `20` memory rows exist.
- Corpus ingest is weak but present: only `5` chunks exist.
- Capital flows generated a valid ready draft with `coverageOk: true`, but `country_capital_flows` still has `0` committed rows.
- The latest capital-flow run is `ready`, not committed, and an uncommitted capital-flow draft still exists.

So the immediate failure mode is: data can be generated, then stranded as a ready draft. The orchestrator sees zero committed rows and keeps treating the stage as incomplete instead of committing/recovering the ready draft cleanly.

## Plan

### 1. Make generated-but-uncommitted drafts first-class
- Update the server-side next-stage decision so it returns one of:
  - `run_stage` — no usable draft exists, run the stage.
  - `commit_ready_draft` — a ready draft exists and should be committed before re-running.
  - `done` — target rows already exist.
- This prevents rerunning expensive AI work when a good draft is already waiting.
- For stages that are safe to auto-commit, the UI loop will commit the existing ready draft before starting another generation call.

### 2. Recover AIA’s current state
- Commit the existing capital-flow draft because it already passed the coverage gate.
- Confirm rows land in `country_capital_flows`.
- Leave genuinely incomplete or low-quality drafts in review rather than pretending the pipeline completed.

### 3. Add one durable server-side “advance once” operation
- Replace the fragile client loop logic with a single server function that advances exactly one unit:

```text
advanceCountryOnboarding(country)
  inspect committed rows + ready drafts
  if ready draft exists -> commit it
  else run the next missing stage
  if stage creates an auto-commit-eligible draft -> commit it
  return exact next state
```

- The UI can still call it repeatedly, but every call is atomic and resumable.
- If the tab closes or auth refreshes, the backend state is still consistent.

### 4. Stop long stage calls from looking like total failure
- Keep generation sequential, but make progress durable per stage:
  - write `phase`, `processed`, `total`, `current item`, and last error into `onboarding_runs.plan`.
  - commit item-level outputs as soon as they are valid where the stage supports it.
- On timeout or failed fetch, the next click resumes from the first missing committed target or ready draft.

### 5. Tighten data quality gates without blocking good data
- KPI seed: keep partial KPI rows committed, but show missing required KPIs explicitly as quality warnings, not as a hard blocker for all downstream stages when rows exist.
- Corpus ingest: raise the quality signal. Five chunks is technically enough for the old gate, but not enough for a high-quality corpus. Add a warning threshold and a retry-clean-sources path.
- Capital flows: if `coverageOk` is true, commit automatically; if false, leave the draft as `needs_review` and do not call the stage complete.

### 6. Make the admin page tell the truth
- Show separate states per stage:
  - committed rows
  - ready draft awaiting commit
  - running
  - failed with last error
  - quality warning
- Rename misleading copy like “bulk run continued past these” because the simplified loop stops at failures.
- Add a “Resume / advance one step” button that runs the single backend advance operation.

### 7. Verification
- Verify AIA end-to-end from backend state, not just UI labels:
  - committed targets for all completed stages
  - no uncommitted ready draft stranded for a completed stage
  - capital-flow rows exist after commit
  - onboarding status panel reports the same state as the database
- Check recent model/gateway logs only for actual provider failures; don’t treat every app fetch/auth interruption as a data-generation failure.

## Files to change

- `src/lib/country-onboarding/orchestrator.functions.ts`
  - Add draft-aware next-action logic and `advanceCountryOnboarding`.

- `src/routes/_authenticated/admin/countries.$code.onboard.tsx`
  - Replace the fragile local sequential loop with calls to `advanceCountryOnboarding`.
  - Display ready-draft vs committed vs warning states clearly.

- `src/lib/country-onboarding/corpus.functions.ts`
  - Ensure capital-flow drafts that pass `coverageOk` are auto-commit eligible.
  - Keep second-brain and KPI gates based on committed data, with explicit query errors.

- Optional small backend data action
  - Commit AIA’s existing capital-flow draft if it still passes validation.

## Acceptance criteria

- Clicking resume does not rerun a stage when a ready draft already exists.
- AIA’s capital-flow draft becomes committed rows.
- A failed network/auth refresh does not strand the pipeline in an ambiguous state.
- The admin UI shows exactly why a stage is pending: missing run, ready draft, failed run, or quality warning.
- The process stays sequential and does not fan out uncontrolled AI calls.