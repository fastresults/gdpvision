## What I found

- The hosted backend and database are healthy, so this is not an infrastructure outage.
- The failing TCA `kpi_seed` run actually continued after the browser saw `Internal server error, sandbox proxy failed` and produced a KPI draft at `20:49:46`.
- The run took about 10 minutes and was still inside the long server call when the browser/proxy connection dropped.
- The current Stage 7 flow is still one long synchronous request that performs sweep + World Bank + IMF + targeted search + AI inference before returning. That is the same failure pattern we already fixed for Stage 9 and partially fixed for source registry.
- A recovery path exists in the UI, but for Stage 7 it is not enough because the browser can fail before the server function returns, leaving the admin with a red error even if the backend later wrote a draft.

## Goal

Make Stage 7 `kpi_seed` behave like a durable workflow, not a long fragile request: visible progress, resumable work, short request units, idempotent commits, and automatic recovery for future countries.

## Plan

1. **Split KPI seed into short, durable steps**
   - Add a KPI seed flow similar to the Stage 9 ministry deep-dive flow.
   - Keep each browser-to-server request small:
     - plan/open KPI seed run
     - broad sweep
     - deterministic World Bank pass
     - deterministic IMF pass
     - targeted per-KPI research
     - inference for remaining gaps
     - finalize draft
   - Persist progress after each unit so a dropped connection does not lose completed research.

2. **Persist per-KPI work state**
   - Add a `kpi_seed_items` tracking table keyed by run + KPI code.
   - Store status, pass, value, period, source URL, source org, notes, inference payload, attempt count, and last error.
   - Use explicit grants and RLS policies consistent with the existing admin-only onboarding workflow.

3. **Make `runKpiSeedAgent` resume-first**
   - If a `kpi_seed` run is already open for the country, adopt it instead of failing with `RUN_LOCKED`.
   - Reset only items that were mid-flight and stale.
   - Do not redo completed KPI items unless the admin explicitly reruns.

4. **Replace the Stage 7 UI call with a client-driven KPI loop**
   - Wire the onboarding page so `kpi_seed` uses the new durable flow instead of one long server call.
   - Reuse the sticky status banner to show:
     - current pass
     - KPI being processed
     - processed / total
     - filled / missing
     - elapsed time
   - Keep the admin informed at all times until the draft is ready or review is required.

5. **Improve proxy-failure recovery**
   - Treat `sandbox proxy failed`, `Internal server error`, `Failed to fetch`, 502/503/504, and abort errors as transient network/proxy failures.
   - After a transient failure, poll the run state and draft state before declaring failure.
   - If the backend finished and wrote a draft, auto-commit it when eligible and continue onboarding.
   - If no draft exists, resume from the persisted item state instead of restarting the whole stage.

6. **Preserve data-quality gates**
   - Keep the canonical KPI registry and plausibility bounds.
   - Keep verified/inferred provenance.
   - Continue producing draft coverage, citations, and `kpi_research_attempts` audit history.
   - Partial KPI coverage should produce a reviewable draft, not a hard workflow stop, unless zero KPI rows are produced.

7. **Add forensic visibility for future failures**
   - Store a structured plan/status object on the run for each pass and KPI.
   - Surface latest per-KPI errors in the UI so admins can see whether the issue is unavailable data, provider timeout, inference failure, or validation rejection.
   - Keep the red failure banner only for unrecoverable failures; transient proxy drops should become “recovering / resuming”.

8. **Validate on TCA**
   - Verify the existing TCA draft can be picked up and committed or reviewed.
   - Run Stage 7 again through the new durable path to confirm it resumes rather than timing out.
   - Confirm `Run all pending` continues past KPI seed into stages 8–12 when Stage 7 has a usable draft.

## Technical implementation notes

- New migration: `public.kpi_seed_items` with RLS and grants.
- New/updated server functions in `src/lib/country-onboarding/corpus.functions.ts` for planning, processing, and finalizing KPI seed runs.
- Reuse `finalizeKpiSeedOutputs` from `src/lib/country-onboarding/kpi-seed.server.ts` instead of duplicating final draft logic.
- New client helper modeled after `src/lib/country-onboarding/ministry-deep-dive-flow.ts`.
- Update `src/routes/_authenticated/admin/countries.$code.onboard.tsx` so Stage 7 uses the durable helper and transient recovery logic recognizes `sandbox proxy failed`.