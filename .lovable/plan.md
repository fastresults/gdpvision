## What I found — audit report

The pipeline is 11 stages, each a pair of `runXAgent` + `commitX` server functions. There is **no server-side orchestrator** — "Run all" is a browser loop in `onboard.tsx` that dies with the tab. Below are the concrete breaks that explain the reliability issues you're seeing. Ranked by real-world impact.

### Critical (breaks the user right now)

1. **`kpi_seed` can never be committed via the UI.** `saveDraft` is called with `citations: []` (`corpus.functions.ts:567`) and the Commit button is gated by `citations.length === 0`. Every KPI run produces a permanently un-commitable draft — this is why ATG shows "review" + a green Commit button but nothing writes to `country_kpis`.
2. **The stuck-run auto-reconcile is a silent no-op.** `getOnboardingStatus` writes `status: 'stale'`, but `'stale'` is not in the `onboarding_runs.status` CHECK constraint. The update fails, the error is unchecked, and stuck `planning`/`ready` runs stay stuck forever. This is why the previous "auto-reconcile" fix didn't actually clear anything.
3. **`profile`/`gdp` "committed" ground truth is a false positive.** `committedTargets` treats `profile` as committed when `countries.currency` is non-null and `gdp` when `gdp_current_usd` is non-null — both can be pre-seeded before the pipeline ever runs, so those stages show ✓ Committed against nothing.

### High (why stages fail unpredictably)

4. **Four stages have no fallback tier.** `source_registry`, `sector_dossier`, `ministry_deep_dive`, `second_brain_seed` call `callSonar` once, no Gemini repair, no inferred pass. One 429 or one malformed JSON = the whole run goes `failed` with no draft to review.
5. **`corpus_ingest` auto-commits empty results.** `markDraftCommitted` runs unconditionally, even when 0/25 fetches succeeded and 0 chunks landed. The stage looks "committed" but the second brain is empty.
6. **Delete-then-insert commits.** `commitSectorComposition` and `commitMinistrySectorMap` do `delete()` then `insert()` outside a transaction. Any crash between them wipes the country's rows and the stage silently flips back to uncommitted.
7. **No concurrency guard.** Two tabs, or "Run all" + a manual "Re-run", can open two `planning` runs on the same `(country, stage)` and race the delete+insert commits above.

### Medium (dependency and quality drift)

8. **Dependencies are enforced inconsistently.** Hard-throws exist for `ministries`→`ministry_sector_map`/`ministry_deep_dive` and `country_sectors`→`sector_dossier`, but `ministry_sector_map` only *soft*-uses `sector_composition` (prompt hint, not a gate); `second_brain_seed` doesn't check `source_registry` at all. The client's `STAGE_DEPENDENCIES` map is a hand-maintained duplicate that isn't derived from server truth.
9. **Rate-limit vs "no data" is not classified.** All provider exceptions are string-appended to `notes` and immediately downgrade the tier, so a transient Perplexity 429 makes an entire profile "inferred low confidence" instead of retrying.
10. **`onboarding_drafts` has no unique `(country, stage)` live-draft constraint.** Superseded drafts pile up forever; JS-side `superseded: true` flagging is the only cleanup.
11. **Partial-failure diagnostics are dropped.** `ministry_deep_dive` throws when 0/N ministries return usable JSON — losing the per-ministry error array that would have told you which minister page 404'd.

## How I'll fix it — phased plan

### Phase 1 — Unblock the pipeline (ship first, single migration + focused edits)

Goal: every stage that has produced a draft can actually be committed, and stuck runs actually clear.

- **Migration `20260713_onboarding_reliability.sql`**:
  - Add `'stale'` to `onboarding_runs.status` CHECK.
  - Add unique partial index `onboarding_runs_one_open_per_stage` on `(country_code, stage) WHERE status IN ('queued','planning','searching','extracting','validating')` — prevents concurrent runs of the same stage.
  - Add unique partial index `onboarding_drafts_one_live_per_stage` on `(country_code, stage) WHERE committed_at IS NULL` — one live draft per stage.
  - Add columns `countries.profile_committed_at timestamptz`, `countries.gdp_committed_at timestamptz` and backfill from `onboarding_runs` where a `committed` run for those stages exists (else NULL). These become the new ground truth for stages 1 and 2.
- **`kpi_seed` citations**: rebuild `citations` from `enriched[].source_url`/`source_org` (dedup, 1-indexed) before `saveDraft` at `corpus.functions.ts:567`; commit gate then works unchanged.
- **`getOnboardingStatus`** (`agents.functions.ts:190,285-286`):
  - Use `profile_committed_at`/`gdp_committed_at` for those stages' `committed` truth.
  - Check the reconcile-update's error and log it.
- **`commitSectorComposition` / `commitMinistrySectorMap`**: replace the delete+insert with a single Postgres RPC (`replace_country_sectors`, `replace_ministry_sectors`) that does both inside a `BEGIN`/`COMMIT`. Migration adds the two functions with `SECURITY DEFINER` + `SET search_path=public` and grants EXECUTE to `authenticated` / `service_role`.
- **`saveDraft`**: change to upsert on the new unique index so re-runs update the live draft in place instead of accumulating rows; superseded drafts are auto-collapsed.

### Phase 2 — Server-side orchestrator with correct DAG

Goal: one "Run onboarding" button that runs the whole country reliably, resumable, and respects real dependencies.

- New `runOnboardingPipeline` server fn in `src/lib/country-onboarding/orchestrator.functions.ts`:
  - Input `{ countryCode, mode: 'missing' | 'all', stages? }`.
  - Reads `getOnboardingStatus` to decide what's pending.
  - Executes in topological order of the real DAG (below), with `Promise.all` for independent branches:
    ```
    [profile, gdp, sector_composition, ministries, source_registry, kpi_seed]  (parallel, no deps)
        │              │                   │                │
        │              │                   ├── ministry_sector_map (needs ministries + sector_composition)
        │              │                   ├── sector_dossier      (needs sector_composition)
        │              │                   └── ministry_deep_dive  (needs ministries)
        │                                                       source_registry
        │                                                              │
        │                                                       corpus_ingest (needs source_registry rows)
        │                                                              │
        │                                                       second_brain_seed (needs corpus_ingest + sector_composition)
    ```
  - Per-stage: run agent → if draft is non-empty and either auto-committable or above a confidence/coverage threshold, call the committer; otherwise leave the draft for human review and continue.
  - Per-stage retry: on 429/5xx classify as *retryable* and back off (1s, 4s, 15s) before falling to the next tier; on genuine "no data" fall through immediately.
  - Records `plan` JSON on the run with `{tier_used, attempts, retryable_errors, duration_ms, coverage, citation_count}` so a future dashboard can surface where things break.
- Client-side "Run all" in `onboard.tsx:269-322` is replaced by a single call to this server fn plus polling via existing `getOnboardingStatus` invalidation.
- `STAGE_DEPENDENCIES` in the UI is deleted; the server owns the DAG.

### Phase 3 — Fallback parity + empty-payload guards

Goal: no stage can silently produce nothing.

- Route `source_registry`, `sector_dossier`, `ministry_deep_dive`, `second_brain_seed` through the same tiered pattern used by `fallback.server.ts` (Perplexity → Gemini repair → inferred stub with `confidence:'low'`). Where a stage is per-item (per ministry, per sector), keep per-item try/catch so partial success is preserved, and always `saveDraft` with whatever succeeded + an `errors[]` array in the payload.
- Add `assertNonEmptyDraft(payload, stage)` before every `saveDraft` — profile has a name, sectors has ≥3 rows, ministries has ≥1, kpi_seed has coverage≥50%, etc. Failing this marks the run `ready` with `error: 'empty payload'` instead of writing a useless "committed" draft.
- `corpus_ingest`: only auto-commit when `okCount >= 1` AND `totalChunks > 0`; otherwise leave in `ready` with the fetch errors surfaced.

### Phase 4 — Observability (small but pays off)

- Extend `onboarding_runs.plan` with the structured fields above (already partially used by `corpus_ingest`).
- Add a compact "Pipeline health" panel at the top of `onboard.tsx` showing per-stage: last tier used, coverage/citation count, retryable-error count, last stuck-run reconciliation. No new tables — pure read view over `onboarding_runs` + `committedTargets`.

## Not in scope for this plan

- Migrating providers (still Perplexity + Lovable AI Gateway).
- Any changes to the KPI research passes themselves (World Bank/IMF/Perplexity/Gemini/inference) — they already work, we're only fixing what's downstream of the drafts they produce.
- Cross-country batch (this plan is per-country; a future "onboard N countries overnight" job can reuse `runOnboardingPipeline` unchanged).

## Files that will change

- `supabase/migrations/20260713_onboarding_reliability.sql` (new)
- `src/lib/country-onboarding/agents.functions.ts` (getOnboardingStatus, commitSectorComposition, commitMinistrySectorMap)
- `src/lib/country-onboarding/corpus.functions.ts` (kpi_seed citations, empty-payload guards, fallback wiring for 4 stages, corpus_ingest auto-commit guard, saveDraft upsert)
- `src/lib/country-onboarding/fallback.server.ts` (429/5xx classification + backoff, exportable single-item variant)
- `src/lib/country-onboarding/orchestrator.functions.ts` (new)
- `src/routes/_authenticated/admin/countries.$code.onboard.tsx` (replace client loop with server orchestrator call; drop STAGE_DEPENDENCIES; add health panel)

## Success criteria

- Re-running the whole pipeline on ATG (currently the sick country) leaves every one of the 11 stages either ✓ Committed with real rows, or ⚠ needs-review with a specific, actionable error message. No stage is "stuck" without an explanation.
- Two admin tabs racing the same stage produce one open run + one clear "already running" toast — never two concurrent commits.
- `kpi_seed` commits on the first press.
- The `stale` reconciliation actually flips stuck runs to `stale` (verifiable via a `SELECT status FROM onboarding_runs WHERE status='stale'` returning rows).
