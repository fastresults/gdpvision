## Why KNA stopped at "ministry_deep_dive"

The 502 `sandbox proxy failed` is a **request timeout**, not a code bug. `runMinistryDeepDiveAgent` in `src/lib/country-onboarding/corpus.functions.ts` (lines 1297-1400) does everything inline in a single server function call:

```text
for each ministry (KNA has ~14):
  resolveMinister(...)
    pass 1  corpus search   (embed + gemini extract)
    pass 2  Perplexity sonar-reasoning-pro (targeted)
    pass 3  Perplexity sonar-reasoning-pro (wide, if empty)
    pass 4  Perplexity sonar-pro (cross-check)
```

That is ~3-4 Perplexity calls × 14 ministries executed **serially**. Each `sonar-reasoning-pro` call is 10-40s. Total wall time easily exceeds the sandbox/edge request cap, so the proxy kills the connection and the orchestrator marks the run stopped. Every other stage (profile, gdp, ministries, kpi_seed, capital_flows) fits in one call; this one doesn't and never will as ministry counts grow.

The `minister-backfill` module already solved the same problem for the admin backfill tool: it persists a job in `minister_backfill_runs` + `minister_backfill_country_runs` and the client drives it one ministry at a time. We reuse that pattern for stage 9 so it works for every future country onboarding.

## Fix — turn stage 9 into a resumable per-ministry job

### 1. Split `runMinistryDeepDiveAgent` into three short server functions

In `src/lib/country-onboarding/corpus.functions.ts`:

- **`planMinistryDeepDive({ countryCode })`**
  - Opens the `onboarding_pipeline_runs` row (`stage: "ministry_deep_dive"`, `status: "planning"`).
  - Loads ministries, writes one work item per ministry into a new lightweight table `ministry_deep_dive_items(run_id, country_code, ministry_slug, ministry_name, status, minister, minister_profile jsonb, mandate, programmes jsonb, citations jsonb, confidence, source_tier, error, updated_at)` with `status='pending'`.
  - Returns `{ runId, total }`. Fast; no Perplexity work.

- **`resolveNextMinistryDeepDive({ runId, batchSize=1 })`**
  - Claims up to `batchSize` pending items (`UPDATE ... RETURNING` with `status='pending'` → `status='running'`).
  - Runs `resolveMinister` for each (still sequential inside one call, but `batchSize=1` keeps every call under ~60s).
  - Writes results back to the item row and flips it to `done` or `failed`. Refreshes `onboarding_pipeline_runs.updated_at`.
  - Returns `{ completed, remaining }`.

- **`finalizeMinistryDeepDive({ runId })`**
  - Assembles `parsed = { ministries, diagnostics }` and the merged citation set from the item rows.
  - Applies the existing acceptance gate (≥70% resolved + citations ≥ ministries → medium, else low).
  - Calls the existing `saveDraft` (already upsert-safe from the earlier fix) with `stage: "ministry_deep_dive"`, `target_table: "ministry_profiles"`.
  - Calls `finishRun(..., { status: "ready" })`.

### 2. Orchestrator wiring

In `src/lib/country-onboarding/orchestrator.functions.ts`, replace the single `runMinistryDeepDiveAgent` call for stage `ministry_deep_dive` with:

```text
plan → loop { resolveNext until remaining === 0 } → finalize
```

Each iteration is its own server function call, so the sandbox timeout no longer matters. Add a per-ministry timeout in `resolveMinister` (e.g. 45s cap on each Perplexity pass via `AbortController`) so a single hung upstream call fails that ministry instead of the whole run — matching how `minister-backfill` treats failures.

### 3. UI / polling

The onboarding page already polls `getRunProgress` every 3s. Extend the progress payload for `ministry_deep_dive` to include `{ completed, total, currentMinistry }` read from `ministry_deep_dive_items`, so the run card shows "9 / 14 ministries resolved…" instead of an opaque spinner. When `remaining===0`, the client calls `finalize`.

### 4. Recovery for KNA now

- Reset the current stuck run: mark the `onboarding_pipeline_runs` row for `ministry_deep_dive` as `failed` (or delete and re-plan).
- Re-run stage 9 from the admin UI. The new plan → resolve-loop → finalize path replays cleanly; the earlier stages remain unchanged.

### 5. Migration

One SQL migration adds `ministry_deep_dive_items` with `GRANT SELECT, INSERT, UPDATE ON ... TO authenticated`, `GRANT ALL TO service_role`, RLS enabled, and admin-only policies (mirrors `minister_backfill_country_runs`). No changes to `onboarding_drafts` / `onboarding_citations` shape.

## Verification

- `bunx tsgo --noEmit` clean.
- Re-run stage 9 on KNA end-to-end from the admin UI; expect progress to tick per ministry and the run to end `ready` with a `ministry_deep_dive` draft equivalent to the pre-timeout intent.
- Run stage 9 on a second country (e.g. any small OECS one) to confirm the pattern is generic; each per-ministry call finishes well under the sandbox timeout.
- Kill one Perplexity pass mid-run (network throttle) and confirm only that ministry is marked `failed`, the loop continues, and finalize still produces a draft with `confidence: "low"`.
