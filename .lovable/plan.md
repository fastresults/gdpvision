## Goal
Make Stage 12 produce a McKinsey-grade, evidence-backed GDP/capital-flow Sankey from the full country onboarding corpus, not from a thin one-shot prompt. The final output should reliably populate the Sankey with enough inputs, outputs, source citations, confidence notes, and reconciliation logic to be useful for a human GDP-development review.

## What is failing now
- Stage 12 currently runs its own 3-pass web search, but it does not meaningfully consume the data already captured in Stages 1–11.
- The latest ATG run has strong upstream coverage already: GDP, sectors, ministries, source registry, corpus chunks, KPIs, and memory objects exist; `country_capital_flows` has 0 committed rows.
- The latest capital-flow draft has only `1/6` inputs and `0/6` outputs; seven rows were dropped mostly because the model returned `N/A` source URLs for estimates.
- Stage 12 is too brittle: it treats “exact URL for every modeled estimate” as a hard gate, but it does not first build a research workbook from deterministic APIs, committed KPIs, source corpus, budget/fiscal data, and prior stage outputs.
- The Sankey currently reflects the failed data pipeline rather than a proper GDP-flow model.

## Product outcome
Stage 12 becomes a full “Capital Flow Research Workbench” that creates:

```text
Country context + prior stages
        ↓
Source/corpus retrieval + deterministic economic APIs
        ↓
Per-node evidence packs
        ↓
AI synthesis + formula-based derivations
        ↓
Validation, reconciliation, confidence grading
        ↓
Human-readable draft review
        ↓
Committed country_capital_flows
        ↓
Filled Sankey diagram with citations and assumptions
```

## Implementation plan

### 1. Build a Stage 12 evidence workbook before any AI synthesis
Create a server-side evidence-building layer that gathers all known country data before asking AI to synthesize flows:

- Country profile: currency, fiscal year, GDP value/year, population.
- Stage 3 sector composition: tourism, public administration, construction, agriculture, energy, etc.
- Stage 6 source registry: national statistics office, finance ministry, central bank, IMF, World Bank, ECCB/CDB/CARICOM/OECS, tourism authority, CIU/CBI sources.
- Stage 7 KPIs: revenue/GDP, FDI/GDP, exports/GDP, current account/GDP, debt/GDP, tourism arrivals, population, inflation.
- Stage 8/9 dossiers and ministry profiles: budget programmes, ministry responsibilities, investment/infrastructure signals.
- Stage 10 corpus chunks: search ingested documents for each node using targeted queries.
- Stage 11 memory objects: policy positions, risks, sector facts.

This produces a structured `capital_flow_workbook` object with evidence grouped by node, formulas, citations, and gaps.

### 2. Add deterministic data backfills for flow nodes
Do not leave Stage 12 dependent on web-search prose. Add deterministic backfills wherever possible:

- `FDI_NET`: World Bank WDI `% of GDP` × committed GDP; fallback to WDI current USD FDI if available.
- `REMITTANCES`: World Bank remittances indicator × GDP or current USD indicator.
- `TAX_REVENUE`: committed `govt_revenue_gdp` KPI × GDP, adjusted to tax-only when a finance/budget source provides tax revenue.
- `TOURISM_SPEND`: prioritize ECCB/CTO/IMF travel credits; normalize units carefully and check against exports/GDP and tourism sector share.
- `DEBT_SERVICE`: World Bank IDS total debt service, IMF Article IV debt service tables, or official debt bulletin.
- `ENERGY_IMPORT` and `IMPORT_LEAKAGE`: UN Comtrade/WITS merchandise import series, with HS27 carved out from total imports.
- `ODA_GRANTS`: OECD/WB grant indicators where available.
- `CBI_INFLOWS`: official CIU/MoF/IMF Article IV; omit only when country context says no CBI programme.

Each deterministic fill stores the exact formula used, e.g. `value = GDP_USD_M × KPI_PERCENT / 100`, with source URLs from the upstream KPI/source row.

### 3. Replace the current prompt-only Stage 12 with per-node research agents
Instead of asking a model to return six nodes at once, run one focused research job per node:

- Each node gets its evidence pack, known values, candidate source URLs, and acceptable derivation formulas.
- The model’s job becomes synthesis and source selection, not blind research.
- If deterministic data already fills a node, AI only explains/confirms it.
- If a node needs a modelled estimate, allow a real source URL for the underlying assumption, not `N/A`; the node can be `modelled` if its assumption source is valid.
- Use a repair pass with Lovable AI when Perplexity returns partial rows, invalid URLs, or unit ambiguity.

### 4. Make validation smarter, not just stricter
Keep bad data out, but do not drop useful modeled rows solely because the final value is derived.

Validation rules:
- Every row must have either:
  - a direct source URL for the exact figure, or
  - a valid assumption/evidence URL plus a formula.
- Store `source_kind`: `direct`, `derived`, or `assumption_based`.
- Store `formula`, `source_value`, `source_unit`, `fx_rate`, and `unit_normalization` in the draft payload.
- Apply GDP plausibility caps after unit normalization.
- Flag values above caps for review, but include them as “requires review” when evidence supports them rather than silently dropping all context.
- Treat tourism carefully: visitor expenditure can be high in tourism-heavy islands, but should still be reconciled against GDP, exports, and BOP travel credits.

### 5. Add a true reconciliation model for the Sankey
The current “inputs vs outputs” model expects all nodes to balance by accident. Replace it with an explicit reconciliation layer:

- Inputs: external/fiscal inflows and domestic revenue sources.
- Outputs: fiscal uses, imports/leakage, domestic retention, debt service, capital expenditure.
- Residual becomes a visible, explained accounting bridge only when needed.
- Residual is not commit-eligible unless the residual percentage is below the configured threshold or an admin override is provided.
- If outputs are missing but inputs are strong, Stage 12 should continue researching outputs instead of presenting an empty Sankey.

### 6. Update Stage 12 review UI for human analysts
The review UI should show an analyst-ready workbook, not a raw payload:

- Coverage by node: found, derived, modeled, omitted, needs review.
- For each node: value, period, method, formula, confidence, source, and assumptions.
- Dropped/rejected rows: reason, source URL, and suggested next action.
- Source quality badges: official, multilateral, modelled, stale, unit-risk.
- Commit button only enabled when the ledger meets coverage and reconciliation standards.
- JSON remains rendered through `PrettyJson` only where structured debug detail is necessary.

### 7. Improve the Sankey visualization semantics
Update the Sankey so it reflects a GDP-development map, not just a thin ledger:

- Show all populated nodes with readable labels and values.
- Preserve absolute values for labels; use a balanced visual scaling layer only for layout.
- Show source/confidence on hover or side rail.
- Make residual/bridge explicit and visually distinct.
- Keep the Farm-to-Hotel scenario as a separate scenario toggle, not as a mutation of the committed base ledger.
- Add an “Assumptions” panel for modelled nodes and scenario adjustments.

### 8. Add persistence for research attempts and evidence packs
Add a database-backed audit trail for capital-flow research attempts so repeated failures are diagnosable:

- Per-node attempt rows: provider, query, status, value, period, source URL, validation result, error/rejection reason.
- Evidence pack snapshot per draft/run.
- Coverage summary per run.
- This mirrors the existing KPI research attempt pattern and prevents opaque “running in circles” behavior.

### 9. Repair ATG after the pipeline change
After implementation:

- Clear the current failed ATG capital-flow draft/rows only as needed.
- Re-run Stage 12 for ATG.
- Verify at least 3 inputs and 4 outputs are populated.
- Verify all committed rows have valid citations or assumption-source URLs.
- Verify residual is within threshold or clearly blocked for review.
- Verify Chart C renders a filled Sankey instead of an empty or residual-only diagram.

### 10. Verification criteria
Before calling this complete, I will verify:

- Stage 12 consumes committed Stages 1–11 data.
- ATG produces a complete or reviewable ledger with node-level evidence.
- No node is dropped without a visible reason and source trail.
- Commit button state matches the actual coverage/reconciliation gate.
- `country_capital_flows` receives committed rows only when standards are met.
- Sankey renders the committed ledger with readable labels, citations, and assumptions.
- JSON UI remains human-readable via `PrettyJson`.