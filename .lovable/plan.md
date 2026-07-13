## Diagnosis — what's actually broken

The current ATG Stage 12 sankey shows only `Gross Tourism Spend $2.9B → Consolidated Treasury → Unattributed Residual $2.9B` (screenshot 1). Reference shape (screenshot 2) has 3 inputs + 6 outputs balanced (~$740M total, residual near 0). Investigating the pipeline:

1. **Single-shot ask, no coverage guarantee.** `runCapitalFlowsAgent` in `src/lib/country-onboarding/corpus.functions.ts:1885` sends one prompt asking the model to return "EVERY node_key that applies" across 12 nodes. Sonar returned 1 row and we accepted it. There is no retry-for-coverage, no per-node fan-out, no minimum-node contract.
2. **Bad `source_url` slipped through.** The committed draft has `"source_url": "ECCB Selected Tourism Statistics, Antigua and Barbuda"` — that's a citation title, not a URL. Schema declares `type: string` with no format check, and we do not reject non-`https://` values. That's why Stage 12 had to be data-repaired manually last turn.
3. **No magnitude sanity check.** ATG GDP is ~US$2B. The model returned $2.9B tourism receipts (EC$7.77B ÷ 2.70) — a value larger than GDP. It should have failed a "any single input ≤ ~1.5× GDP" guard and been rejected or resolved by asking the model to reconcile.
4. **Reconciliation gate is advisory, not enforcing.** With `residual_pct = 100%` the run is still marked `status: ready` and shown as commit-eligible (only `error` text differs). Draft is treated as valid.
5. **Only 1 flow row + no citations at commit time** — last turn's fix let the draft commit anyway. That papered over the coverage problem instead of surfacing it.
6. **Missing "Farm-to-Hotel" toggle.** Reference shows a linkage toggle recolouring/re-routing flows; not implemented.

The result: the "AI research" step produces one weak row, the reconciliation warning is ignored, the draft is committed, the sankey renders essentially empty.

## Goal

Stage 12 must produce a **balanced, multi-node capital-flow ledger** (3+ inputs, 4+ outputs, |residual| ≤ 10% of inputs) with **every value backed by a real https URL**, or refuse to commit and surface exactly which nodes are missing. Sankey visualization must match the reference: multi-input, multi-output, coloured, with the Farm-to-Hotel linkage toggle.

## Plan

### 1. Replace single-shot with a node-group fan-out (`corpus.functions.ts`)

Split the 12 nodes into 3 research passes, run in parallel, then merge:

- **Inputs pass** — TOURISM_SPEND, CBI_INFLOWS, FDI_NET, REMITTANCES, ODA_GRANTS, TAX_REVENUE.
- **Outputs (fiscal) pass** — WAGES_AGRI, INFRA_CAPEX, DEBT_SERVICE, DIGITAL_HEALTH_CAPEX.
- **Outputs (imports/leakage) pass** — ENERGY_IMPORT, IMPORT_LEAKAGE.

Each pass:
- Uses `sonar-reasoning-pro` with `search_mode: "web"` + a tightened prompt that lists the specific nodes for THIS pass, their exact definitions, and required primary sources per node (IMF Article IV, WB WDI, ECCB BOP tables, MoF Estimates of R&E, CIU annual report, UNCTAD FDI/STAT).
- Returns a small structured schema (`{ period, flows: [...] }`) scoped to that pass's node enum only — smaller enum = higher success rate.
- Records its own `onboarding_citations` rows so evidence is per-flow, not one giant blob.

Merge into a single draft after all three complete; keep the `runId`/draft shape unchanged so the UI stays compatible.

### 2. Enforce a real source URL per flow

- Tighten `CapitalFlowsSchema.items.properties.source_url` to require `pattern: "^https?://"` (JSON-schema pattern) AND validate in code: reject any flow whose `source_url` is not `new URL(...)`-parseable and https/http. Rejected flows go into a `dropped_flows` array on the draft payload with the raw model output so admins can see why.
- Deduplicate URLs into `onboarding_citations` (already keyed by URL) so `[N]` markers align.

### 3. Sanity checks vs GDP + per-node bounds

Pull `country_kpis.latest_value` for `GDP_USD` (already a KPI). For each flow, apply:

- `value_usd_m` must be > 0.
- Any single input ≤ 1.5 × GDP (USD m). If exceeded, drop the row and log to `dropped_flows` with reason `exceeds_gdp_bound`.
- Sum of inputs and sum of outputs each ≤ 3 × GDP.
- Per-node soft caps (e.g. TOURISM_SPEND ≤ 0.6 × GDP for non-tourism-dependent, ≤ 1.2 × GDP otherwise — driven by `capital_flow_nodes` config extended with an optional `gdp_cap` column).

Any dropped rows re-trigger the specific pass ONCE with an explicit "your previous $X value for NODE_KEY exceeded plausibility; re-answer with primary source and correct units" nudge.

### 4. Reconciliation gate becomes enforcing

- If final `residual_pct > 0.10` OR `inputs.length < 3` OR `outputs.length < 4`, the run finishes with `status: "needs_review"` (new value) rather than `ready`. UI shows "Coverage incomplete — X of 12 nodes populated" plus the missing node list; Commit button stays disabled.
- Add a per-node checklist under the draft: green ✓ (populated with valid URL), amber (populated but low confidence / soft-cap warning), red ✗ (missing) — human-readable, no raw JSON per the global PrettyJson rule.
- Admin can override once by clicking "Commit partial ledger anyway" which records `override_reason` in the audit log.

### 5. Repair the ATG data

- Migration adds `gdp_cap` column to `capital_flow_nodes` with sensible defaults (values above).
- Delete the current bad ATG committed flows (`country_capital_flows` where `country_code='ATG'` and `value_usd_m > 1500`); re-run Stage 12 with the new fan-out and verify inputs/outputs render like the reference.

### 6. Sankey visualization (matches reference)

`src/routes/_authenticated/admin/countries.$code.viz.tsx` (Chart C):

- Colour nodes and links by side + node (yellow inputs / treasury spine, teal wages, olive infra, blue debt, cyan digital-health, orange energy, maroon imports) with values rendered as `$Xm/$X B`.
- Add the **Farm-to-Hotel toggle** chip. When active, split TOURISM_SPEND flow: `farm_to_hotel_share` of tourism spend routes to WAGES_AGRI (local wages / agriculture) instead of IMPORT_LEAKAGE, visualizing the substitution. `farm_to_hotel_share` lives in `country_capital_flows_config` (new tiny table: `country_code`, `farm_to_hotel_share numeric default 0.15`), editable in the admin.
- Replace the "MISSING: …" banner with a coverage bar + list of unpopulated nodes so it's clear what still needs research.

### 7. Guardrails against regression

- Unit-esque server test (script we run once, not a suite): call `runCapitalFlowsAgent` for ATG and DMA, assert inputs.length ≥ 3, outputs.length ≥ 4, residual_pct ≤ 0.10, every flow has an https `source_url`.
- Extend the memory Core rule: *"Stage 12 (capital_flows) commits require ≥3 inputs, ≥4 outputs, residual ≤10%, every flow with an https source_url. Anything less requires an audited admin override."*

## Files touched

- `src/lib/country-onboarding/corpus.functions.ts` — fan-out, URL validation, GDP guard, reconciliation gate, `dropped_flows`.
- `src/routes/_authenticated/admin/countries.$code.onboard.tsx` — coverage checklist, "needs_review" state, override flow.
- `src/routes/_authenticated/admin/countries.$code.viz.tsx` — sankey colouring + Farm-to-Hotel toggle + missing-node bar.
- New migration: add `gdp_cap` to `capital_flow_nodes`, new `country_capital_flows_config` table, new `onboarding_runs.status` value `needs_review` (widen check constraint).
- Data repair: delete ATG's oversized flows, re-run Stage 12.
- `mem://index.md` — Core rule addition.

## Verification

- Re-run Stage 12 for ATG → draft shows ≥3 inputs, ≥4 outputs, residual ≤10%, every row has an https URL, coverage checklist all green.
- `/admin/countries/ATG/viz` Chart C matches the reference: multiple coloured input bands into treasury, multiple coloured output bands out.
- Toggle Farm-to-Hotel → tourism→wages band widens, tourism→leakage band narrows, totals stay conserved.
- Run against DMA (Dominica, no CBI in same shape) → CBI row omitted, ledger still balances.
