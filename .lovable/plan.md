## Goal
Give Super Admin a control surface to manage each country's ingested data corpus after onboarding, and start feeding that corpus into the app's consumer surfaces (Counsel, Instrument KPIs, Ministry pages). Pattern is Sovereign Pulse's "Second Brain" — toggle sources on/off, re-ingest, inspect what the AI actually sees.

## Scope

### 1. Per-country Data Stores dashboard
New route: `/admin/countries/$code/data`

Tabs / sections:
- **Sources** — table of `country_sources` (domain, kind, quality, last_fetched, chunk_count). Row actions: toggle active, edit quality, re-ingest (single), delete. "Add source" form (URL + kind). Bulk "Re-ingest active".
- **KPIs** — table of `country_kpis` (name, category, latest value, unit, target, source). Inline edit latest_value/target. Link to history (`country_kpi_points`).
- **Sector dossiers** — list `sector_dossiers` grouped by sector, expandable to see policy/comms/benchmark payload; "Regenerate" button per row.
- **Ministries** — list `ministry_profiles` with minister, mandate, programme count; "Regenerate" per row.
- **Corpus** — stats (docs, chunks, chars, last ingest); "Semantic search" test box (embeds query, returns top-K chunks with source link) so admin can sanity-check retrieval.
- **Second Brain** — list `memory_objects` for the country, add/edit/verify/delete, weight slider (mirrors Sovereign Pulse).

Add "Data" link to each country row on `/admin/countries` and a tab on the onboard wizard header.

### 2. Server functions (new file `src/lib/country-data/manage.functions.ts`)
All `requireSupabaseAuth` + admin check:
- `listSources`, `upsertSource`, `toggleSource`, `deleteSource`, `reingestSource` (calls existing ingest helpers for one URL).
- `listKpis`, `updateKpi`, `listKpiHistory`.
- `listDossiers`, `regenerateDossier` (re-runs the stage 8 agent for one sector).
- `listMinistryProfiles`, `regenerateMinistryProfile`.
- `corpusStats`, `semanticSearch` (embed query → pgvector `<=>` against `country_source_chunks`).
- `listMemory`, `upsertMemory`, `deleteMemory`, `setMemoryVerified`.

### 3. Rewire consumers (first cut)
- **Counsel retrieval**: extend the answer path to include top-K `country_source_chunks` for the active country alongside existing memory results; cite by `country_sources.url`.
- **Instrument KPI widgets**: read `country_kpis` for the active country in `/instrument/index` sector tiles, falling back to existing series where a KPI is missing.
- **Ministry pages** (`/instrument/portfolio.$ministry`): pull `ministry_profiles` minister/mandate/programmes into the header.

Kept minimal — one query per surface, no visual redesign. Broader rewiring lands in a follow-up.

### 4. Not in this plan
- Scheduled re-ingest / cron (add later via `/api/public/hooks/`).
- Diff/versioning of scraped docs.
- Multi-country cross-analysis.
- Any change to onboarding stages themselves.

## Technical notes
- No schema changes. All tables from migration `20260712180835` are already in place.
- `semanticSearch` uses the same `text-embedding-3-small` path as ingest, then `select ... order by embedding <=> $1 limit K` scoped by `country_code`. HNSW index already exists.
- `reingestSource` and `regenerate*` reuse `fetchFirecrawl` / `chunkText` / `embedBatch` from `ingest.server.ts` and the Perplexity agents from `agents.functions.ts` — no new external calls.
- Route is admin-gated by existing `/_authenticated/admin` `beforeLoad`.

## Deliverables
- `src/routes/_authenticated/admin/countries.$code.data.tsx` (+ subcomponents in `src/components/admin/data/`)
- `src/lib/country-data/manage.functions.ts`
- Small edits to `countries.index.tsx` (add "Data" link), Counsel answer fn, `/instrument/index`, `/instrument/portfolio.$ministry`.

## Recommended next step after this
Scheduled nightly re-ingest + freshness alerts (surface stale sources in the Data dashboard).
