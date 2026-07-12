## Goal

Extend the country onboarding pipeline so that after the current 5 stages (profile / GDP / sectors / ministries / M×S), the same super-admin flow ingests the **full data corpus** a country needs to power GDPVision — patterned on Sovereign Pulse's data-store architecture — with toggleable data sources and an AI-first research loop.

## What's missing today

The current wizard establishes country skeleton only. Compared to Sovereign Pulse, GDPVision has none of the following, per country:

- **Canonical source registry** (typed catalog of every URL the country's dossiers rely on, grouped by kind: gov / regional / multilateral / advisory / ngo / media / summit)
- **Sector dossiers** — for each country×sector: policy stack (statutes, institutions, national plans, regulatory instruments), comms stack (channels, spokespeople, press releases, narratives, campaigns, reputation risks), OECS/regional benchmark
- **KPI seed set** — the canonical macro/social/fiscal series (GDP growth, CPI, debt/GDP, unemployment, HDI, tourism arrivals, remittances…) with initial data points from official sources
- **Ministry deep-dive** — mandate text, ministers, portfolio scope, key programmes
- **Second-brain corpus** — full-text of each source scraped, chunked, embedded into `memory_objects`, so Counsel/dossiers can retrieve
- **Data-source toggle UI** — per source, on/off, freshness, coverage, "re-run"

## Plan

### Stage 1 — Extend the wizard with 6 new AI research stages

Append to `STAGES` in `admin/countries.$code.onboard.tsx`:

```text
6. Source registry     → catalog of authoritative URLs (grouped by kind)
7. KPI seed set        → canonical series + latest data point + source
8. Sector dossiers     → policy + comms + regional benchmark per sector
9. Ministry deep-dive  → mandate, minister, programmes per ministry
10. Corpus ingest      → scrape + chunk + embed each committed source
11. Second-brain seed  → memory_objects (positions, audiences, outlets) tied to sources
```

Each stage gets: `runXxxAgent` (Perplexity Sonar, structured JSON, cited) + `commitXxx` (writes to real tables). Same pattern as existing stages.

### Stage 2 — Database (one migration)

New tables (all scoped by `country_code`, with `GRANT` + RLS):

- `country_sources` — id, country_code, kind, org, title, url, tld, active (toggle), last_fetched_at, quality_score, tags
- `country_source_documents` — country_source_id, raw_text, char_count, chunk_count, fetched_at
- `country_source_chunks` — source_id, chunk_index, content, embedding vector(1536)  *(HNSW index)*
- `country_kpis` — country_code, kpi_code, label, unit, direction, source_id, latest_value, latest_period, target
- `country_kpi_points` — country_kpi_id, period, value, source_id
- `sector_dossiers` — country_code, sector_code, kind ('policy'|'comms'|'oecs'), payload jsonb, source_ids[]
- `ministry_profiles` — country_code, ministry_slug, minister, mandate, programmes jsonb, source_ids[]

Reuse existing `memory_objects` for the second-brain seed (already country-scoped via `scope_key`).

### Stage 3 — Ingest pipeline

Port `src/lib/ingest/` from Sovereign Pulse:

- `pipeline-helpers.server.ts` — `fetchFirecrawl`, `chunkText`, `embedBatch` (Lovable AI Gateway `text-embedding-3-small`)
- `pipeline.functions.ts` — `previewIngest`, `commitIngest`, `listIngested`, `deleteIngested`, `toggleSource`, `refreshSource`

Firecrawl is required for reliable scraping. Add as a connector.

### Stage 4 — UI: per-country Data Stores dashboard

New route `/admin/countries/$code/data` (sub-tabs, mirrors Sovereign Pulse `admin.data-stores.*`):

- **Overview** — coverage matrix (rows = source kinds × cols = sectors), freshness heatmap, missing-source alerts
- **Sources** — table of `country_sources` with active toggle, "Refresh", "Ingest now", per-source citation count
- **Ingested** — list of `country_source_documents` with chunk counts, delete, re-embed
- **KPIs** — canonical KPI list with latest value, direction, staleness badge, "Refresh from source"
- **Sector dossiers** — one card per sector with policy / comms / OECS chips
- **Ingest** — free-form URL/text intake (bypass the guided flow for ad-hoc adds)

### Stage 5 — Wire into consumer surfaces

- Counsel / dossier retrieval switches from hardcoded `SEED_TEMPLATES` (in `onboarding.functions.ts`) to `memory_objects` populated by Stage 6 above
- KPI widgets on `/instrument` read `country_kpis` scoped to the user's `instance_binding` country
- Sector pages (`/instrument/sector/$code`) read `sector_dossiers` + `country_kpis`

### Stage 6 — Super-admin activity + cost

Extend `/admin/activity` with filters for the new stages; expand the "Run all pending" button on the onboard wizard to include stages 6–11 (with per-stage cost display already in place).

## Technical notes

- Perplexity `sonar-deep-research` for stages 6, 8 (broad multi-query synthesis); `sonar-pro` for stages 7, 9 (structured extraction); Lovable AI Gateway for embeddings and classification.
- Corpus ingest runs after Source registry is committed — it iterates `country_sources` where `active = true` and scrapes/chunks/embeds each.
- Every table is country-scoped so multi-country tenancy stays clean; RLS grants read to any user whose `instance_bindings.country_code` matches, write to super admin only.
- Firecrawl connector needed (already used by Sovereign Pulse); if user prefers not to add it, fall back to `fetch()` with a readability parser, at reduced quality.

## Deliverables order

1. Migration for the 7 new tables + RLS/GRANTs
2. Port `ingest/` pipeline (+ Firecrawl connector)
3. `runSourceRegistryAgent` + `commitSourceRegistry`
4. `runCorpusIngest` (drives Firecrawl + embeddings over committed sources)
5. `runKpiSeedAgent` + `commitKpis`
6. `runSectorDossierAgent` (×3 kinds) + `commitSectorDossier`
7. `runMinistryDeepDiveAgent` + `commitMinistryProfile`
8. `runSecondBrainSeed` (memory_objects from committed sources)
9. Wizard UI: 6 new StageCards
10. `/admin/countries/$code/data` dashboard (5 sub-tabs)
11. Rewire Counsel + `/instrument` KPI/sector reads

Roughly 2 migrations, ~10 new server-fn files, ~6 new route files. No breaking change to existing stages 1–5.

## Recommended next course

Approve this plan and I'll start with the migration + Firecrawl connector setup, then build the Source Registry + Corpus Ingest stages first — those unlock everything downstream (KPIs, sector dossiers, second-brain all consume the ingested corpus).