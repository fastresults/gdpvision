## Problem

Countries queue page (`/admin/countries`) shows Anguilla as **"9/5" with only 4 green dots**, even though 9 pipeline stages are committed in the database. The row's classification (in-progress vs complete) is also wrong.

Root cause: `src/routes/_authenticated/admin/countries.index.tsx` hardcodes a stale 5-stage `STAGES` array (profile, gdp, sector_composition, ministries, ministry_sector_map). The onboarding pipeline is actually 12 stages — the canonical list lives in `src/routes/_authenticated/admin/countries.$code.onboard.tsx`. The index page never got updated, so it under-counts the denominator and only renders dots for the legacy 5 stages while the "completed_stages" set (from `listOnboardingCountries`) already includes every committed stage.

Anguilla's committed stages in the DB: profile, gdp, sector_composition, ministries, source_registry, kpi_seed, sector_dossier, second_brain_seed, capital_flows (9). Missing: ministry_sector_map, ministry_deep_dive, corpus_ingest.

## Fix

1. **Sync the queue's stage list to the full 12-stage pipeline.** In `src/routes/_authenticated/admin/countries.index.tsx`, replace the 5-item `STAGES` constant with the same 12-stage list already used on the per-country onboarding page (keys: `profile, gdp, sector_composition, ministries, ministry_sector_map, source_registry, kpi_seed, sector_dossier, ministry_deep_dive, corpus_ingest, second_brain_seed, capital_flows`). Use short labels (e.g. numeric badges "1"–"12" with a tooltip) so the row still fits on one line.

2. **Extract the stage list to a shared module** so the two pages cannot drift again. New file `src/lib/country-onboarding/stages.ts` exporting `ONBOARDING_STAGES` (key, label, short). Import from both `countries.index.tsx` and `countries.$code.onboard.tsx`.

3. **Fix progress classification.** Counter logic already uses `STAGES.length`, so it self-corrects once the array is right. Verify Anguilla now reads **9/12** and is classified as *in-progress* (correct — 3 stages still missing).

4. **Verify.** After edit, load `/admin/countries`, confirm Anguilla shows 12 dots with 9 green / 3 grey, and denominator reads 9/12.

## Out of scope

No backend, no schema, no server-fn changes. Purely a UI sync between the aggregated `completed_stages` payload the server already returns and the row rendering.