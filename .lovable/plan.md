# AI Inference Engine for Missing KPIs

After the 5-pass research loop (Perplexity sweep → WB → IMF → targeted Perplexity → Gemini web search) any KPI still `NULL` is treated as **unresolvable from primary sources**. We add a final **Pass F: Inference** that uses a reasoning model to *estimate* the value from adjacent evidence, clearly flags it as inferred, records rationale, and lets Super Admin review / override.

## What Super Admin sees

On `/admin/countries/$code/data` → **KPIs** tab:

- New status pill **`Inferred`** (amber) alongside existing `Fresh` / `Stale` / `Missing`.
- Coverage banner splits into: `Verified 8 · Inferred 3 · Missing 2 · 13 total`.
- Every inferred row shows an **ⓘ Inferred** chip. Clicking opens a side drawer with:
  - Estimated value + confidence (`low` / `medium` / `high`)
  - Model + timestamp
  - **Rationale** (2–5 sentence explanation the model produced)
  - **Evidence used** (list of chunks / KPIs / peer-country values it leaned on, each with source URL where available)
  - **Assumptions & caveats**
  - Actions: **Accept as verified**, **Override value**, **Reject (mark missing)**, **Re-infer**
- Bulk header actions: **Infer all missing**, **Re-infer all inferred**, **Accept all high-confidence**.
- Instrument scorecard tiles render inferred KPIs with the same amber `Inferred` chip so downstream users know it's an estimate, not a measurement.

## Pipeline changes

1. `runKpiSeedAgent` (existing) runs Passes A–E as today.
2. New **Pass F — `inferMissingKpis`** runs only for KPIs still `latest_value IS NULL` after E:
   - Gathers context per KPI: registry entry (bounds, unit, direction), any partial hits from earlier passes, related KPIs already resolved for this country, top RAG chunks from `country_source_chunks` (semantic search on `kpi_code + label`), and — when useful — peer-country values from `country_kpis` for structurally similar countries (same region / income tier from `countries`).
   - Calls `google/gemini-2.5-pro` (fallback `openai/gpt-5.5`) via Lovable AI Gateway with structured `Output.object` schema: `{ estimated_value, unit, period, confidence, rationale, assumptions, evidence: [{kind, ref, note}] }`.
   - Applies registry sanity bounds; out-of-bounds → rejected, logged, KPI stays missing.
   - Writes result with `provenance='inferred'`, `confidence`, `inference_rationale`, `inference_evidence`, `inference_model`, `inferred_at`.
3. Every attempt appends to `kpi_research_attempts` with `pass='F_infer'`.

## Admin override semantics

- **Accept as verified** → `provenance='admin_verified'`, keeps value, clears inferred badge, records `verified_by` / `verified_at`.
- **Override value** → `provenance='admin_override'`, stores admin value + optional note; original inference kept in `inference_history` JSONB.
- **Reject** → clears `latest_value`, sets `freshness_status='missing'`, prevents re-inference for N days unless "Re-infer" is clicked.
- **Re-infer** → re-runs Pass F for that single KPI.

## Data sources audit (parallel workstream)

Before Pass F fires, we tighten what earlier passes have to work with:

- Add `source_health` view: for each `country_sources` row, count chunks, last successful fetch, last KPI resolved from it. Surface in Sources tab so admin sees dead / low-yield sources.
- Registry gains `additional_sources[]` (per-KPI hint URLs, e.g. central bank stats page, national statistics office) that Pass C targeted Perplexity is instructed to consult first.
- Auto-suggest new sources: when Pass F cites an evidence URL not in `country_sources`, queue it in a new `source_candidates` table for admin one-click approval → becomes an active source and is re-ingested.

## Out of scope

- Auto-accepting inferences without admin review.
- Time-series inference (only `latest_value`).
- Cross-country automatic imputation models beyond LLM reasoning with peer context.

---

## Technical details

**Migration**
- `country_kpis`: add `provenance TEXT` (`verified` | `inferred` | `admin_verified` | `admin_override`), `confidence TEXT`, `inference_rationale TEXT`, `inference_evidence JSONB`, `inference_model TEXT`, `inferred_at TIMESTAMPTZ`, `verified_by UUID`, `verified_at TIMESTAMPTZ`, `admin_note TEXT`, `inference_history JSONB DEFAULT '[]'`.
- New table `source_candidates` (country_code, url, suggested_by_model, first_seen_at, status, approved_by) with GRANTs + RLS (admin-only).
- View `source_health` (read-only, admin-only).

**Code**
- `src/lib/country-onboarding/kpi-inference.server.ts` — `inferMissingKpis(countryCode)`; peer-country + RAG context builder; `Output.object` schema (no bounds — enforced in code post-parse per ai-sdk-agent-patterns).
- `src/lib/country-onboarding/kpi-research.server.ts` — add Pass F hook after Pass E.
- `src/lib/country-data/manage.functions.ts` — new server fns: `acceptKpiInference`, `overrideKpi`, `rejectKpi`, `reinferKpi`, `inferAllMissing`, `acceptAllHighConfidence`, `listSourceCandidates`, `approveSourceCandidate`.
- `src/lib/country-data/consume.functions.ts` — extend `ConsumerKpi` with provenance/confidence so scorecard tiles can render the `Inferred` chip.
- `src/routes/_authenticated/admin/countries.$code.data.tsx` — split coverage banner, add `Inferred` pill, inference drawer, bulk actions, Sources tab addition for `source_candidates` + `source_health`.
- `src/routes/_authenticated/instrument/mandate.scorecard.tsx` — render `Inferred` chip on tiles.

**Model choice** — `google/gemini-2.5-pro` primary (strong reasoning + big context for RAG chunks), `openai/gpt-5.5` fallback on error. No user API key required (Lovable AI Gateway).

**Coverage gate** — `commitKpis` still refuses to publish rows with NULL value; inferred rows have a non-null value and pass the gate but are flagged. Missing rows remain missing and eligible for later inference.
