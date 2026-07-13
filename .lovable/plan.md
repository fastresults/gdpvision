## What I found

### Immediate second-brain bug
- The second-brain data exists and has been committed, but the onboarding status check is counting it incorrectly.
- `memory_objects` does not have a `country_code` column; it stores country scope in `scope_key`.
- The status query currently counts second-brain rows with `.eq("country_code", cc)` in `countCommittedTargets` (`src/lib/country-onboarding/agents.functions.ts:303`). That query errors, the helper swallows the error and returns `{ rows: 0 }` (`lines 272-275`), so the UI thinks second brain is not committed.
- Because committed drafts are filtered out of the live draft list (`lines 228-233`), the UI then has neither a “committed” status nor a live draft, which produces the exact symptom in the screenshot: **“Commit (no draft)”**.

### The workflow is not fully server-side yet
- The “Run all” orchestration still lives in the browser component (`src/routes/_authenticated/admin/countries.$code.onboard.tsx:292-350`).
- Individual stages run on the server, but the pipeline controller is still a client loop. If the tab closes, refreshes, times out, or two admins run it, the stage state can drift.
- The UI itself says “Do not close this tab” (`lines 466-486`), which confirms this is not yet a durable server-owned workflow.

### Second-brain seed is too shallow for stage 11
- `runSecondBrainSeedAgent` calls Perplexity directly from a prompt with only country name + sector codes (`src/lib/country-onboarding/corpus.functions.ts:1610-1659`).
- It does not yet consume the already-built second brain inputs: committed KPIs, source registry, ingested corpus chunks, sector dossiers, ministry profiles, and citations.
- That means stage 11 is not really synthesizing the 10 prior stages; it is another standalone web-search pass.

### Commit semantics are inconsistent
- `commitSecondBrainSeed` insert-skips duplicates by normalized title (`corpus.functions.ts:1679-1716`). This preserves no-duplicate rules, but re-runs cannot reliably improve existing generated memories because matching rows are skipped instead of updated.
- The commit gate is citation-based in the UI (`countries.$code.onboard.tsx:830-836`). That is good for research quality, but the stage card payload counter does not include `memories` (`lines 713-720`), so second-brain draft readiness can be under-described.

### Silent failure pattern exists elsewhere
- The committed-target helper currently converts target-count errors into zero rows. That hid the `memory_objects.country_code` mistake. This same pattern can make future countries look uncommitted even when data exists.
- Several corpus stages still use direct Perplexity calls rather than the stronger fallback framework used by profile/GDP/sectors/ministries/ministry-sector map.

## Recommended dependable solution

### Phase 1 — Immediate correctness fix
1. Fix second-brain committed detection:
   - Count `memory_objects` with `.eq("scope_key", cc)` instead of `.eq("country_code", cc)`.
2. Stop hiding target-count errors:
   - Replace the current “error means zero rows” behavior with explicit status diagnostics.
   - If a target-count query fails, surface it in the admin UI as a pipeline health warning instead of silently showing “not committed.”
3. Fix second-brain draft display details:
   - Include `memories` in draft item counting.
   - Change the button state copy so “Commit (no draft)” is never shown for a stage that has committed target rows or a status-count failure.

### Phase 2 — Make orchestration server-owned and resumable
1. Add a durable pipeline-run record, e.g. `onboarding_pipeline_runs`, to track:
   - country
   - mode: pending / rerun / single-stage
   - current stage
   - checkpoint
   - status
   - per-stage result/error summary
2. Add a server function such as `runCountryOnboardingPipeline` that owns the DAG:

```text
Level 1: profile, gdp, sector_composition, ministries, source_registry, kpi_seed
Level 2: ministry_sector_map, sector_dossier, ministry_deep_dive, corpus_ingest
Level 3: second_brain_seed
```

3. Make the browser only start/resume/poll the pipeline. The browser should not decide which stages run or commit.
4. Make the pipeline idempotent:
   - If a stage is already committed and no rerun is requested, skip.
   - If a draft exists and is eligible, commit it.
   - If a run failed, preserve the error and continue only when downstream dependencies are still satisfied.

### Phase 3 — Strengthen stage contracts
For every stage, define one shared server-side stage registry:
- dependencies
- target table/count method
- draft payload shape
- commit eligibility rule
- minimum coverage rule
- citation/evidence requirement
- fallback strategy

Examples:
- `second_brain_seed`: requires committed source registry, corpus chunks, KPIs, ministries, sector dossiers or ministry deep dives where available.
- `kpi_seed`: requires minimum required-KPI coverage, not just any payload.
- `corpus_ingest`: committed only when useful chunks or known deduped existing chunks are present.

### Phase 4 — Rebuild second-brain seed as true synthesis
1. Change stage 11 to read from committed project data first:
   - country profile and GDP
   - KPI rows and provenance
   - sector dossiers
   - ministry profiles
   - source registry
   - corpus chunks/documents
2. Generate memory objects from those inputs, not from generic search alone.
3. Attach evidence to each memory:
   - `source_id` when tied to a country source
   - `citation_url` where available
   - citation rows in `onboarding_citations`
4. Commit with update-or-insert behavior:
   - No duplicates.
   - Existing generated memory rows can be improved on rerun.
   - Verified/manual rows are protected unless explicitly overwritten.

### Phase 5 — Fallback parity and quality gates
1. Route `source_registry`, `sector_dossier`, `ministry_deep_dive`, and `second_brain_seed` through the same tiered strategy used in stronger stages:
   - grounded search
   - AI repair from source material
   - low-confidence inferred/stub fallback only when safe
2. Add hard non-empty checks before saving drafts:
   - sources ≥ useful threshold
   - KPIs ≥ required coverage threshold
   - dossiers cover committed sectors
   - ministry deep dive covers committed ministries
   - second brain contains a balanced set of positions/audiences/outlets/facts/risks
3. Classify transient failures separately from “no data”:
   - rate limit / timeout / provider outage should be retryable
   - invalid payload should be reviewable
   - missing upstream dependency should block clearly

### Phase 6 — Admin observability
Add a compact pipeline health panel at the top of the country onboarding page:
- committed target row counts
- latest draft status
- latest run status
- citation count
- eligibility reason
- dependency blockers
- retryable errors

This makes the system explain itself instead of requiring database inspection.

## Implementation order
1. Fix the `memory_objects.scope_key` status bug and UI wording first.
2. Add status diagnostics so hidden query failures cannot masquerade as uncommitted stages.
3. Move orchestration decisions into a server-owned resumable pipeline function.
4. Rework second-brain seed to synthesize from committed corpus/data rather than standalone search.
5. Add fallback parity and quality gates across all 11 stages.
6. Add the pipeline health panel.

## Expected result
- Second brain will correctly show as committed when memory rows exist.
- Rerunning stage 11 will produce a reviewable draft or a clear failure reason, not “Commit (no draft).”
- “Run all” will become resumable and dependable across countries.
- Each country’s 11-stage onboarding will have consistent dependencies, evidence, draft rules, commit rules, and health reporting.