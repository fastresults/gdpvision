# Audit — Stage 12 "Capital flows" (Run AI research)

## What actually happened

Admin clicked **Run AI research** on stage 12. The server function `runCapitalFlowsAgent` threw immediately at its very first DB write and returned an error to the UI — no draft was ever created, so there was nothing to commit.

Trace of the failing call:

```
countries.$code.onboard.tsx → runCapitalFlowsAgent (corpus.functions.ts:1885)
  → assertAdmin ✓
  → loadCountry ✓
  → openRun({ stage: "capital_flows", ... })         ← THREW HERE
      → INSERT INTO onboarding_runs (stage='capital_flows')
      → ERROR: new row for relation "onboarding_runs" violates
               check constraint "onboarding_runs_stage_check"
```

Confirmation from the DB — every earlier stage has rows for ATG, but `capital_flows` has none because every attempt was rejected by the check:

```
stage                | count
---------------------+------
profile              | 1
gdp                  | 1
sector_composition   | 1
ministries           | 3
ministry_sector_map  | 1
source_registry      | 1
kpi_seed             | 4
sector_dossier       | 2
ministry_deep_dive   | 2
corpus_ingest        | 1
second_brain_seed    | 2
capital_flows        | 0        ← never accepted by the constraint
```

## Root cause

`public.onboarding_runs.onboarding_runs_stage_check` was an explicit whitelist of the original 11 stages. Stage 12 was added to the app code (registry, orchestrator, UI card, runner/committer maps, Sonar agent, `country_capital_flows` table, FK to `capital_flow_nodes`) but the whitelist in the CHECK constraint was never widened, so `openRun()` failed for every capital-flows attempt.

## Status of the fix

**Already applied** in the previous turn: the constraint now allows `'capital_flows'`. Verified live:

```
CHECK ((stage = ANY (ARRAY[..., 'second_brain_seed', 'capital_flows'])))
```

Everything downstream of `openRun` is stage-agnostic and does not need code changes:

- `saveDraft`, `finishRun`, `markDraftCommitted` — generic; write to `onboarding_drafts` / `onboarding_runs` by primary key
- `country_capital_flows` has the correct unique index `(country_code, node_key, period)` for the commit's `onConflict`
- `capital_flow_nodes` registry seeded with all 12 input/output nodes plus `RECONCILIATION_RESIDUAL`
- `country_capital_flows_method_check` accepts `'reported' | 'derived' | 'modelled' | 'residual'` (matches both agent output and the auto-balancer)
- `commitCapitalFlows` correctly snapshots citations, upserts flows, auto-attaches sources via `upsertCountrySource`, and inserts/clears the residual bucket

## Small remaining polish (recommended, not blocking)

In `CapitalFlowsSchema` (corpus.functions.ts:~1849), `notes` is listed in `required`. Sonar must therefore emit a `notes` string for every flow, even when there is nothing to say — encouraging filler text and occasionally causing `AI_NoObjectGeneratedError` on strict-schema providers. Move `notes` out of `required` (keep it in `properties`) so it is optional. This is the only schema-shape issue; enums are fine and the summary fragment is standard.

No other code, RLS, trigger, or grant changes are needed for stage 12.

## Verification steps (run in order)

1. Reload `/admin/countries/ATG/onboard`.
2. Open **12. Capital flows** → click **Run AI research**.
3. Expect: sticky progress banner → new row appears in `onboarding_runs` with `stage='capital_flows'`, `status='ready'`; a draft appears with `target_table='country_capital_flows'`; the card flips to **review** with a `flows[]` payload preview and citations.
4. Click **Commit**. Expect: rows inserted into `country_capital_flows` for ATG, `country_sources` gains flow-source entries, draft flips to committed, run status → `committed`.
5. Navigate to `/admin/countries/ATG/viz` → the **Sovereign Capital Flow (Sankey)** panel now renders with the freshly committed ledger; the empty-state message disappears.

If step 3 still fails, the error banner text will name the exact failure (Perplexity API, reconciliation, schema parse) — none of those are latent problems in the current pipeline, so a retry is the correct response.

## Out of scope

- No changes to the Sankey component, viz layout, or KPI panels
- No re-run of earlier stages
- No changes to `capital_flow_nodes` seed or `country_capital_flows` schema