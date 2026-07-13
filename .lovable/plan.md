## Why the "app encountered an error" dialog keeps showing

Every failing path today throws a raw `Error` from a `createServerFn` handler. TanStack turns those into a 500 that bubbles to the route boundary → global "app encountered an error" modal. Two dialog triggers are firing on this project:

1. **Stage-dependency violation during "Run all pending"** (today's error).
   - `runAllPending` iterates STAGES in order, awaits each `runners[s.key]`, and moves on. It only skips a stage that's already committed or has an existing draft.
   - Stage 4 `runMinistriesAgent` writes a **draft** (`saveDraft` → status `ready`, needs admin commit). It does **not** insert into the `ministries` table.
   - Stage 5 `runMinistrySectorMapAgent` **reads** `ministries` (row 546 `if (!ministries?.length) throw`). Because Stage 4's draft is still pending commit, Stage 5 explodes → dialog.
   - Same shape applies to every other downstream stage that reads a committed table (sectors, KPIs, source registry, dossiers, ministry profiles, corpus_ingest which reads `country_sources`).

2. **Perplexity empty response** (previous error, patched with a retry on Ministries only). The same "throw on empty" pattern exists in 6+ other agents.

Result: whenever any single agent in the chain fails or an upstream stage isn't committed yet, the bulk run stops with a full-screen crash instead of surfacing an inline warning and skipping.

## Fix plan (efficiency + durability, no behavioral change to committed data)

### A. Stop treating dependency gaps as crashes

- Add a small `stageDependencies` map in `src/routes/_authenticated/admin/countries.$code.onboard.tsx` describing which committed-stage keys each downstream stage requires (e.g. `ministry_sector_map: ["ministries"]`, `ministry_profiles: ["ministries"]`, `dossiers: ["sectors"]`, `corpus_ingest: ["source_registry"]`, …).
- In `runAllPending`, before invoking a stage, check the dependency set against `committedStages`. If missing, **skip and record a "waiting on X" note** in a new `skippedStages` state; do not throw. Continue the loop.
- Show a single inline `Skipped: ministry_sector_map (waiting on ministries commit) · ...` banner alongside `bulkErr`, replacing the crash path.

### B. Make bulk run resilient to individual failures

- Wrap each `runners[s.key](...)` call in `runAllPending` (and `rerunAll`) in a `try/catch`. On failure, push `{ stage, message }` into a `runErrors` state and continue instead of aborting the loop.
- Render `bulkErr` as a collapsible list of per-stage errors, not one giant modal-triggering string.
- Keeps the queue moving so a single Perplexity hiccup doesn't burn the whole onboarding pass.

### C. Convert server-fn crashes into typed results

- Introduce a small helper `okResult<T>(...)` / `errResult(stage, reason, hint?)` return shape used by the top-level of every agent's `.handler`. The handler catches its own throw, calls `finishRun(..., "failed")`, and **returns** `{ ok: false, stage, reason, hint }` instead of rethrowing.
- Client-side, the bulk runner and `StageCard.doRun` treat `ok:false` as inline red text in the result banner (which already exists at line 397) — no route boundary trip, no full-screen dialog.
- This changes the class of "expected upstream failures" (empty Perplexity, dependency gap, invalid Firecrawl URL count, 429) from crashes to inline banners. Genuine unexpected exceptions (DB down, missing env var) still throw and still surface the modal — as they should.

### D. Reduce request volume in bulk runs

- `runAllPending` currently `await refresh()`s after every stage — 11 stages × full re-fetch of runs/drafts/citations/summaries. Change to a single `refresh()` after the loop plus an optimistic local `committedStages` update between stages (needed only to compute the next iteration's dependency check).
- Cuts network round-trips by ~10× per bulk run.

### E. Harden Perplexity call sites (extend the fix already shipped for Ministries)

Apply the same "retry once with `noDomainFilter: true` then include raw content in error" pattern to the six other `parseSonarJson` guards that currently throw on empty:
`sectors` agent, `kpis` agent, `source_registry`, `sector_dossiers`, `ministry_profiles`, and the `memory_objects` seed. Every one of these can starve on small-nation TLDs and produce the same dialog.

### F. Keep the modal for what it's actually for

- The global error boundary should only be reached by true framework / bundle / auth / DB-outage failures. All of the above changes route "expected agent failures" to inline UI. That is the durability goal.

## Verification

1. Fresh country with no committed stages → click **Run all pending**. Result:
   - No dialog fires.
   - Sticky banner ticks through 1→N stages.
   - Any stage that returns `ok:false` shows an inline red line (`Sectors: Perplexity returned no results, retry queued`).
   - Downstream stages needing an uncommitted table show `Skipped: ministry_sector_map · waiting on ministries commit`.
2. Commit ministries manually → click **Run all pending** again → skipped list is now empty, stage 5 runs, still no dialog.
3. Simulate a Perplexity 500 by temporarily unsetting the API key for one stage → inline red line, other stages proceed, no dialog.
4. Network tab: bulk run of 10 stages issues 1 `getOnboardingState` refresh (was ~10).

## Out of scope

- Any change to committed data schema, RLS, agent prompts beyond adding the domain-filter retry, or the corpus_ingest auto-commit behavior.
- Auto-committing ministries/sectors/etc. — those still require admin review; the plan only stops the crash when a downstream stage runs early.
