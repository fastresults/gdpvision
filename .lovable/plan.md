## Goal
Make the onboarding Commit button reliable for stages 1–12 by replacing the fragile “must have top-level citations” UI rule with a stage-aware draft eligibility rule that matches what each backend commit handler actually accepts.

## Root cause
The UI currently enables Commit only when a draft has `draft.citations.length > 0`, with a couple of one-off exceptions for source registry and capital flows. Many valid stages produce reviewable payloads where evidence is stored inside the payload or where the commit handler does not require top-level citations. That makes the frontend block commits even though the collected data is valid.

## Plan
1. **Add one shared stage eligibility helper in the onboarding page**
   - Replace the hardcoded `citations.length > 0 || hasFlowSourceUrls || hasRegistrySources` gate with a `getDraftCommitEligibility(stage, payload, citations)` helper.
   - Return `{ ok, reason }` so the disabled button explains the actual reason.

2. **Cover every stage explicitly**
   - `profile`: allow when payload has core profile fields.
   - `gdp`: allow when payload contains a GDP value/year.
   - `sector_composition`: allow when `payload.sectors` has rows.
   - `ministries`: allow when `payload.ministries` has rows.
   - `ministry_sector_map`: allow when `payload.mappings` has rows.
   - `source_registry`: allow when `payload.sources` has at least one valid `http(s)` URL.
   - `kpi_seed`: allow when `payload.kpis` has rows.
   - `sector_dossier`: allow when `payload.dossiers` has rows.
   - `ministry_deep_dive`: allow when `payload.profiles` or equivalent ministry profile rows exist.
   - `corpus_ingest`: keep as no manual commit because it auto-commits.
   - `second_brain_seed`: allow when `payload.memories` has rows.
   - `capital_flows`: keep the stricter coverage/reconciliation requirements already defined for this stage.

3. **Improve the disabled-state message**
   - Replace “Draft has no citations — cannot commit” with the eligibility helper’s reason, e.g. “Draft has no dossier rows to commit” or “Capital-flow draft needs coverage review.”
   - Keep the backend as the final validator; UI should only prevent obviously empty/ineligible drafts.

4. **Align bulk/orchestrator auto-commit readiness**
   - Update the server-side orchestrator’s `isDraftCommitEligible` to use the same stage-aware payload checks, so “Run all pending” does not get stuck for the same reason.
   - Preserve special handling for `corpus_ingest` and `capital_flows`.

5. **Verification**
   - Check the sector dossier draft now shows Commit enabled when `payload.dossiers` exists.
   - Confirm source registry/KPI seed remain enabled when their payload rows exist.
   - Confirm empty drafts and capital-flow drafts that fail coverage remain blocked with clear reasons.

## Files to change
- `src/routes/_authenticated/admin/countries.$code.onboard.tsx`
- `src/lib/country-onboarding/orchestrator.functions.ts`