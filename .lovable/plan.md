## Problem

The dot grid on `/admin/countries` is driven **only** by `onboarding_runs.status = 'committed'`. That misses stages where the underlying data was actually written but the run row never flipped to `committed` (e.g. Anguilla has 7 ministry↔sector weights, 15 ministry profiles with `minister_profile`, and corpus chunks, yet stages 5 / 9 / 10 render grey).

Verified against the DB for AIA:

```text
ministry_sectors                    7   (stage 5 has data, dot grey)
ministry_profiles w/ minister       15  (stage 9 has data, dot grey)
country_source_chunks (via sources) 5   (stage 10 has data, dot grey)
onboarding_runs 'committed' for those three stages: none
```

So the chart is out of sync with reality. Two rows can drift the same way (BLZ capital_flows had a `committed` row later followed by `stale`/`failed`, but that's fine — once committed, the ledger is real).

## Fix

Change how `completed_stages` is computed in `src/lib/country-onboarding/agents.functions.ts` so a stage counts as complete when **either** a committed run exists **or** the canonical data table for that stage has content. Purely a read/aggregation change — no schema, no orchestrator changes, no backfill migration.

Add one helper `computeDataDerivedStages(countryCodes)` that runs a batched read per stage and returns `Map<countryCode, Set<OnboardingStage>>`. Rules (per stage key in `ONBOARDING_STAGES`):

| # | Stage | "Has data" test |
|---|---|---|
| 1 | profile | `countries.currency_code` or `head_of_government` non-null |
| 2 | gdp | `countries.gdp_current_usd` non-null |
| 3 | sector_composition | any `country_sectors` row |
| 4 | ministries | any `ministries` row |
| 5 | ministry_sector_map | any `ministry_sectors` row (join through `ministries.country_code`) |
| 6 | source_registry | any `country_sources` row |
| 7 | kpi_seed | any `country_kpis` row with a value |
| 8 | sector_dossier | any `sector_dossiers` row |
| 9 | ministry_deep_dive | any `ministry_profiles` row with `minister_profile is not null` |
| 10 | corpus_ingest | any `country_source_chunks` row |
| 11 | second_brain_seed | any `memory_objects` row scoped to the country's sectors (existing seed key) |
| 12 | capital_flows | any committed capital-flow ledger row (`capital_flow_edges` or equivalent — pick whichever the ledger writer uses) |

Union that set with the existing committed-runs set. Return the union in `completed_stages`. Apply the same union inside `getOnboardingStatus` so the per-country onboard page's stage summary agrees with the queue.

Nothing to change in `countries.index.tsx` — it already reads `completed_stages` and counts against `ONBOARDING_STAGES.length`.

## Verification

- After change, refresh `/admin/countries`. Anguilla should show all 12 dots green (or at minimum 5, 9, 10 flip green).
- Belize dots unchanged.
- `bunx tsgo --noEmit` clean.

## Out of scope

- No orchestrator/commit-path repairs (separate work — those runs stayed `stale`/`ready` because acceptance gates failed, but the data landed anyway).
- No migration or DB writes.