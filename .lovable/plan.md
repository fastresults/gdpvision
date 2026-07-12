## Problem (audit)

Saint Lucia KPI tab shows the failure clearly: **13 KPIs seeded, only 3 have `latest_value`, 0 have a linked source**. Root causes in the current pipeline (`src/lib/country-onboarding/corpus.functions.ts` — Stage 7 `runKpiSeedAgent` + `commitKpis`):

1. **One-shot Perplexity call** with `latest_value` marked nullable in the JSON schema. The model is allowed to return `null` and does so for most rows — no retry, no per-KPI targeted follow-up.
2. **No coverage gate.** Commit happens even when only 23% of KPIs have values. There is no "quality score" preventing publication.
3. **KPI set is model-decided**, not authoritative. Nothing enforces a canonical registry, so we cannot even measure "what's missing".
4. **`source_url` never resolves** — the Perplexity draft rarely emits an exact URL that matches a row already in `country_sources`, and there is no auto-insert path, so every KPI ends up with `source_id = NULL`.
5. **Single provider.** No deterministic fallback (World Bank / IMF SDMX APIs) for the numbers those datasets already publish.
6. **No visible quality signal** in `/admin/countries/$code/data` — Super Admin cannot see which KPIs are stale/missing or trigger targeted backfill.

## Goal

Make the KPI research loop **AI-agentic and self-healing**: it keeps working until every KPI in a canonical registry has a value, a period, and a citation — or it flags what it cannot find with the reason, so Super Admin knows exactly what to fix.

## Plan

### 1. Canonical KPI Registry (`src/lib/country-onboarding/kpi-registry.ts`)

A typed, code-owned list — the source of truth for "what must be filled" per country tier (SIDS / CBI-state / general). Each entry:

```text
kpi_code, label, unit, direction, category,
expected_period_shape ("2024" | "2024/25" | "Q2 2025"),
authoritative_orgs (["IMF WEO","World Bank WDI","ECCB","Govt CSO"]),
wb_indicator?  (e.g. "NY.GDP.MKTP.KD.ZG"),
imf_indicator?,
value_bounds  (min/max sanity, e.g. debt_gdp 0–300),
required (true/false)
```

This gives the loop a target list to score against — coverage is now a computed number, not a guess.

### 2. Multi-pass agentic KPI research (rewrite `runKpiSeedAgent`)

Replace the one-shot with a loop that runs up to N passes (default 4) until `coverage == 100%` or budget hit.

Pass sequence, per country:

```text
Pass A — Broad Perplexity sweep (sonar-pro, JSON schema)
   -> parse -> compute coverage vs registry.

Pass B — Deterministic API backfill (no LLM)
   For every registry KPI still missing a value that has a wb_indicator:
     hit https://api.worldbank.org/v2/country/{iso3}/indicator/{ind}?format=json
     take latest non-null observation; attach source_url =
     "https://data.worldbank.org/indicator/{ind}?locations={iso3}"
   Same pattern for IMF WEO where an imf_indicator exists.

Pass C — Per-KPI targeted Perplexity (sonar-pro)
   For each STILL-missing KPI, run one focused call:
     system: "Return ONLY the latest value + period + source URL for
             {kpi.label} in {country}. Prefer {kpi.authoritative_orgs}.
             If unknown, return {value:null, reason:'...'}."
     schema locked to a single object; recency=year.

Pass D — Escalation (gemini-2.5-pro via Lovable AI with web search)
   For anything still null, one deep pass with a different provider so we
   are not stuck in one model's blind spot. Same single-object schema.

Sanity gate: reject values outside value_bounds; treat as missing.
```

Every pass writes a `kpi_research_attempts` row (kpi_code, pass, provider, model, ok, value, source_url, error) so we can see exactly why a KPI is empty.

### 3. Source auto-attach + auto-create

In `commitKpis`:

- For each KPI's `source_url`, first look up `country_sources` by URL.
- If none: **auto-insert** a `country_sources` row (`kind='kpi_source'`, `active=true`, quality derived from org tier) and use its id. This is what wires the "Source" column on the Data tab and lets the toggle actually govern the KPI.
- Also record `citations` from the pass into `onboarding_citations` linked to the draft, so the Studio review UI can show provenance per row.

### 4. Coverage gate + freshness

- `commitKpis` refuses to publish rows where `latest_value IS NULL` unless the operator explicitly forces it; missing KPIs stay in the draft as `needs_backfill=true`.
- Add `country_kpis.freshness_status` (`fresh` / `stale` / `missing`) and `last_verified_at`. A nightly (or on-demand) job re-runs Passes B–D for anything `stale` (>90 days) or `missing`.

### 5. Super Admin surface (`/admin/countries/$code/data` → KPIs tab)

- Header shows `Coverage: 10/13 (77%)` + `Last verified: …` for the country.
- Each row shows a status pill (`fresh` / `stale` / `missing`) and, for missing rows, the last attempt's reason ("WB indicator returned no data 2020-2025", "Perplexity: unknown", etc.).
- **"Backfill missing"** button runs Passes B → C → D just for the missing subset and refreshes the tab.
- **"Re-verify all"** re-runs the full loop.

### 6. Consumer wiring already in place

Instrument scorecard already reads `country_kpis` via `listCountryKpis` and hides KPIs whose source is toggled off. Once #3–#5 land, the scorecard populates automatically for St. Lucia and shows real citations.

### Technical notes

- New file `src/lib/country-onboarding/kpi-registry.ts` (data only).
- New file `src/lib/country-onboarding/kpi-research.server.ts` — pure server helpers: `sweepPerplexity`, `backfillWorldBank`, `backfillImf`, `targetedPerplexity`, `escalateGemini`, `scoreCoverage`, `applySanity`.
- Rewrite `runKpiSeedAgent` in `corpus.functions.ts` to orchestrate the four passes; keep the draft/commit flow but persist attempts + coverage.
- New migration:
  - `country_kpis` add `freshness_status text default 'missing'`, `last_verified_at timestamptz`, `research_notes text`.
  - New `kpi_research_attempts` table (run_id, country_code, kpi_code, pass, provider, model, ok, value, period, source_url, error, created_at) with admin-only RLS + GRANT.
- Add `backfillMissingKpis` + `reverifyAllKpis` server fns (admin) called from the Data tab.
- Uses only providers already configured (Perplexity + Lovable AI). No new secrets. World Bank / IMF APIs are open, no key.

### Out of scope (for this plan)

- Time-series ingestion into `country_kpi_points` (separate follow-up: once single-point coverage is 100%, walk the same WB/IMF indicators for historical points).
- Cross-country comparison view.
- Auto-derived targets (would need a separate policy-anchoring pass).

### Recommended next step after this ships

Wire the same pattern into **Sector Dossiers** and **Ministry Deep-Dive** stages (they have the same "single Perplexity call, no coverage gate" weakness).
