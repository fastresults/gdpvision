# Why Stage 12 is stuck (evidence)

From gateway logs + DB inspection of ATG (and cross-checked against LCA):

1. **Capital_flows runs blind.** `runCapitalFlowsAgent` (`corpus.functions.ts:1965`) calls `callSonar` with no `context`, no `countryTld`, no `extraDomains` — unlike stages 1–9 which route through `runWithFallbacks` + `buildCountryContext`. It forfeits the domain allow-list and promoted domains learned across stages 1–9.
2. **It never reads what earlier stages already committed.** No query against `country_kpis` (ATG already has `fdi_net_inflows_gdp`, `govt_revenue_gdp`, `current_account_gdp`, `exports_of_goods_and_services` — these map 1:1 to `FDI_NET`, `TAX_REVENUE`, etc.), `country_sectors` (agriculture/construction/energy shares that seed WAGES_AGRI / INFRA_CAPEX / ENERGY_IMPORT), `country_sources` (curated registry with `quality_score`), `sector_dossiers`, `ministry_profiles` (Finance/Economic Dev), or `country_source_chunks` (335 chunks ingested for ATG).
3. **Corpus is unusable anyway.** For ATG all 20 `country_source_documents` have `fetch_status != 'success'` (`fetched_ok=0`). Stage 10 "commits" but downstream RAG has no fetched body — capital_flows has nothing to retrieve even if it tried.
4. **Write-path defect.** ATG has 3 stage-12 attempts including one `status='committed'` with `error: "reconciliation off by 100%"`, yet `country_capital_flows` has **0 rows for ATG and 0 rows for every country in the DB**. The commit function isn't persisting rows.
5. **Pipeline ordering.** `capital_flows` sits in level 2, before `second_brain_seed` (level 3) in `orchestrator.functions.ts:69-70`, so second-brain memory is never available even in principle.
6. **Cosmetic reconciliation.** `commitCapitalFlows` auto-inserts `RECONCILIATION_RESIDUAL` to force balance rather than cross-checking against sector composition (stage 3) or committed fiscal KPIs (stage 6).

Latest ATG draft: 1 flow (`TOURISM_SPEND`), 5/6 inputs missing, 6/6 outputs missing, 1 dropped flow (ECCB EC$8,891M rejected as unit/FX error). Coverage gate correctly refuses to commit → `needs_review`. That's the visible "stuck" state.

# Fix plan

## P0 — Unblock the immediate gate

1. **Wire country context + domain allow-list into capital_flows.**
   Refactor `runCapitalFlowPass` to accept `ctx: CountryContext` and pass `context`, `countryTld`, `extraDomains` into `callSonar`. `runCapitalFlowsAgent` builds `ctx` via `buildCountryContext(country_code)` once and threads it into all 3 fan-out passes.

2. **Seed nodes deterministically from committed upstream data BEFORE calling Perplexity.**
   Add `loadCapitalFlowsGrounding(country_code)` in `capital-flows.server.ts` that reads:
   - `countries` (GDP, currency)
   - `country_kpis` — map: `fdi_net_inflows_gdp` → `FDI_NET`, `govt_revenue_gdp` → `TAX_REVENUE`, `personal_remittances_gdp` → `REMITTANCES`, `net_oda_gni` → `ODA_GRANTS`, `total_debt_service_gni`/`interest_payments_gdp` → `DEBT_SERVICE`, `gross_fixed_capital_formation_gdp` → `INFRA_CAPEX`, `imports_of_goods_and_services_gdp` → `ENERGY_IMPORT`+`IMPORT_LEAKAGE` (split by sector share).
   - `country_sectors` — derive `WAGES_AGRI`, `DIGITAL_HEALTH_CAPEX`, etc. as GDP × share × standard-conversion.
   - `country_sources` — filter by `kind ∈ ('gov','statistics','central_bank','multilateral')` ordered by `quality_score desc`, feed into `extraDomains`.

   Each seeded flow lands in the draft as `method='derived_from_kpi'` (or `'derived_from_sector_share'`) with citation copied from the source KPI/sector row. Perplexity is only used to fill the remaining gaps and to reconcile.

3. **Fix the commit write-path.**
   Audit `commitCapitalFlows` (`corpus.functions.ts:2146`) — 0 rows in `country_capital_flows` despite a `status='committed'` run means the insert is either being rolled back, filtered by RLS on the admin path, or silently swallowed by an upsert conflict. Add a post-insert row-count assert; log the exact error; ensure `supabaseAdmin` is used inside the handler (per import-graph rule) rather than the request-scoped client.

## P1 — Data integrity

4. **Reorder pipeline.** Move `capital_flows` out of level 2 into its own level 4, after `second_brain_seed`, so it can consume `memory_objects` + fully-ingested corpus.

5. **Fix corpus fetch failures.** `country_source_documents.fetch_status` is not `success` for any ATG doc → the RAG chunks are keyed but empty. Investigate `ingest.server.ts` fetch/parse path (likely a Firecrawl / fetch step failing silently and still writing chunk stubs). Backfill: add a `retryFailedFetches(country_code)` action, and gate `corpus_ingest` "committed" status on `fetched_ok > 0`.

6. **RAG-ground the Perplexity fan-out.** For each remaining missing node, retrieve top-k `country_source_chunks` (e.g. MoF budget, IMF Article IV, central bank BOP) and inject the excerpts + source URLs into that node's prompt as `priorNote`. Prefer `sonar-deep-research` for the fan-out or at minimum the retry pass.

## P2 — Real reconciliation

7. **Replace `RECONCILIATION_RESIDUAL` auto-plug** with a genuine cross-check: `sumIn` must be within ±10% of GDP-implied macro totals derived from stages 3+6, else the flow is flagged (not silently plugged) and the run stays `needs_review` with a concrete "what's off" report per node.

8. **Feed capital_flows outputs back.** After commit, mirror `FDI_NET`, `REMITTANCES`, `TAX_REVENUE` into `country_kpis` (or a `memory_objects` "position") so future onboarding reruns converge instead of re-discovering.

## Technical touch-points

- `src/lib/country-onboarding/capital-flows.server.ts` — add `loadCapitalFlowsGrounding`, `seedFlowsFromUpstream`, KPI→node mapping table.
- `src/lib/country-onboarding/corpus.functions.ts` — refactor `runCapitalFlowPass`/`runCapitalFlowsAgent` to accept `ctx` + seeded flows; harden `commitCapitalFlows` with row-count assertion and admin-client import inside handler.
- `src/lib/country-onboarding/orchestrator.functions.ts` — move `capital_flows` to a new level after `second_brain_seed`.
- `src/lib/country-onboarding/ingest.server.ts` — diagnose + fix `fetch_status` never reaching `'success'`; gate stage 10 commit on `fetched_ok > 0`.
- `src/lib/country-onboarding/perplexity.server.ts` — allow `sonar-deep-research` model choice from capital_flows.
- `supabase/migrations/…` — add `gdp_cap_multiplier` sanity defaults per node if missing; add optional `kpi_key_map` column on `capital_flow_nodes` to make the KPI→node mapping data-driven instead of hardcoded.

## Verification

- Rerun stage 12 for ATG. Expected: ≥3 inputs, ≥4 outputs seeded from committed KPIs/sectors before Perplexity even runs; residual ≤10%; `country_capital_flows` row count for ATG > 0 after commit; Sankey renders a full ledger.
- Repeat for LCA (which has 31 prior runs) and confirm no country regresses.
