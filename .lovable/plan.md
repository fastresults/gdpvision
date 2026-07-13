## Audit findings

**Sovereign Pulse reference (source of the target chart):** `src/components/sede/sankey.tsx` is a *hand-rolled, hard-coded* Sankey. All numbers (Gross Tourism Spend $460M, CBI $160M, FDI $120M, Import Leakages, Debt Service, etc.) are literals inside the component and reshape only through UI sliders (`levers`, `farmToHotel`, `cbiSplit`). There is **no ingestion pipeline behind it**, no source citations, no time series — it is a scenario mockup.

**GDP Vision today:** Our new `SovereignSankey.tsx` is fed by live data but from the *wrong shape* — sectors → ministries proxied by `share_pct × weight`. That is not what an executive expects to see. The reference chart is a **balance-of-payments + fiscal capital flow diagram in absolute USD**, not a sector→ministry stewardship map.

**Gap:** Our corpus (`country_kpis`, `country_sectors`, `country_source_chunks`, `sector_dossiers`) has ratios and dossier text but **no explicit "capital-flow ledger" of USD flows into and out of the Consolidated Treasury**. That is what makes the reference visualization compelling — and what we need to research, ingest, store, and wire.

---

## Plan: end-to-end so GDP Vision's Sankey is fed by real, cited data

### 1. Define the canonical Capital-Flow taxonomy (~10 nodes)

One curated registry, used by ingest, viz, and dossiers so nothing drifts.

**Inputs → Treasury** (Balance of Payments / Fiscal receipts)
- `TOURISM_SPEND` — Gross tourism receipts (BOP travel credits)
- `CBI_INFLOWS` — Citizenship-by-Investment revenue (fiscal)
- `FDI_NET` — Foreign Direct Investment, net inflows
- `REMITTANCES` — Personal remittances received (BOP)
- `ODA_GRANTS` — Official development assistance, grants
- `TAX_REVENUE` — Domestic tax revenue (fiscal)

**Treasury → Outputs** (Fiscal expenditure + BOP debits)
- `WAGES_AGRI` — Public wage bill + agricultural value-add
- `INFRA_CAPEX` — Public works & infrastructure CapEx
- `DEBT_SERVICE` — External debt service (P+I)
- `DIGITAL_HEALTH_CAPEX` — Digital + health CapEx
- `ENERGY_IMPORT` — Fuel & utility imports
- `IMPORT_LEAKAGE` — Other imports (residual leakage)

Each node carries: canonical `label`, `side` (input/output), optional `sector_code` link, unit (`USD_M`), preferred sources.

### 2. Schema (single new migration)

- `capital_flow_nodes` — the registry above (seeded once, global).
- `country_capital_flows` — one row per `(country_code, node_key, period)` with `value_usd_m numeric`, `method` (reported / derived / modelled), `confidence_grade`, `provenance`, `updated_at`, `citations jsonb` (ordered `[N]` refs into `onboarding_citations`).
- Unique key `(country_code, node_key, period)` — dedup contract per second-brain rule.
- GRANTs + RLS following the standard pattern; admin write, authenticated read.
- Migration also adds a `sector_code` nullable FK on nodes for sector drill-downs later.

### 3. Research + ingest (new onboarding stage: "Capital Flows")

Fits between stage 7 (KPI seed) and viz. Uses the **existing** agents/corpus pipeline — no new architecture.

Per node, a Perplexity `sonar-reasoning` research call with a **source allow-list** tuned to authoritative BOP/fiscal publishers:
- IMF Article IV Staff Reports & WEO database
- World Bank International Debt Statistics + WDI
- ECCB (Eastern Caribbean Central Bank) BOP tables
- UNWTO / Caribbean Tourism Organization
- UNCTAD FDI/STAT
- Country's Ministry of Finance budget statements + Estimates of Revenue & Expenditure
- CIU annual reports (for CBI countries)

The agent must return: `value_usd_m`, `period` (latest fiscal year), `method`, `confidence_grade (A/B/C)`, `notes`, and at least one citation URL per value. All source docs go through `upsertCountrySource` + chunked into `country_source_chunks` (existing dedup). Citations land in `onboarding_citations` and are snapshotted into `country_capital_flows.citations`.

Idempotent re-run: upsert on `(country_code, node_key, period)`.

### 4. Reconciliation validator (McKinsey-grade rigor)

Before commit, a server-side validator:
- Σ inputs ≈ Σ outputs within ±10% tolerance.
- If not, insert a `RECONCILIATION_RESIDUAL` synthetic node on the smaller side so the Sankey balances visibly, and flag `diagnostics.reconciliation_residual_pct` for the UI.
- Emit a red diagnostic banner when any node is missing, C-grade, or older than 3 years.

### 5. Viz wiring (rewrite `SovereignSankey.tsx`)

- Replace the sector→ministry proxy with a direct read of `country_capital_flows` for the latest period.
- Labels: `"{node.label} · ${value}M"` — matches the reference exactly.
- Treasury center node = Σ inputs, labeled `CONSOLIDATED TREASURY · $XXXM`.
- Colors from existing `--sector-*` tokens; keep hover isolation.
- Period selector (top-right chip) driven by distinct `period` values in the table.
- Empty/degraded state names the specific missing node and links to the onboarding stage.

### 6. Server function

`getCapitalFlows({ countryCode, period? })` under `src/lib/country-viz/flows.functions.ts` — `requireSupabaseAuth`, admin-scoped read, returns `{ nodes, flows, totals, reconciliation, diagnostics, citations }`. GdpVizStudio prefetches via `ensureQueryData`.

### 7. Sector consistency (bonus, cheap once #1–#3 exist)

Each capital-flow node with a `sector_code` becomes a filter target. Selecting a sector tile in the treemap dims all Sankey ribbons that do not belong to that sector — same interaction model already in the studio.

### 8. Delivery order

1. Migration: `capital_flow_nodes` + `country_capital_flows` + seed registry.
2. Ingest stage "Capital Flows" in `agents.functions.ts` + commit path in `corpus.functions.ts` (reuse citation snapshotting).
3. Add stage card + "Rerun" button to `countries.$code.onboard.tsx`.
4. Reconciliation validator.
5. `getCapitalFlows` server fn.
6. Rewrite `SovereignSankey.tsx` against the new data.
7. Run for ATG end-to-end; verify $-values render, citations open the source modal, reconciliation banner behaves.

### Out of scope for this plan

- What-if sliders on the Sankey (the reference's `levers` — v2 once real baselines are trusted).
- Cross-country comparative Sankeys.
- Auto-generated cabinet narrative around the flows (v2, LLM-written from the same nodes).

### Deliverable at end

A Sankey where **every ribbon width, dollar figure, and label traces back to a cited source in the second brain**, refreshes idempotently on rerun, and fails loudly (not silently) when a node is missing.
