
## Audit finding

Yes — the screenshot shows duplicates. "IMF — KPI source · IMF · www.imf.org" appears at least twice, and the KPI-source rows (World Bank, IMF) are being inserted alongside the same organizations that also appear as `gov` sources. Root cause: `commitKpis` auto-creates a `country_sources` row per researched URL without a uniqueness check, and the KPI research pipeline registers World Bank / IMF as sources on every run. There is no unique constraint on `(country_code, url)` or `(country_code, org)` today, so every re-run stacks another row.

## Plan

### 1. Global de-duplication rule (no duplicates, ever)

- **DB migration**: add a case-insensitive unique index on `country_sources (country_code, lower(normalized_url))` and a partial unique index on `(country_code, lower(org), kind)` for rows where `url` is null. Add a `normalized_url` generated column (strip protocol, trailing slash, `www.`, query/hash) so `https://www.imf.org/` and `http://imf.org` collapse to one row.
- **Backfill**: one-time SQL to merge existing duplicates — keep the oldest row, repoint `country_source_documents.country_source_id` FKs to the survivor, delete the losers.
- **Write path**: change every insert site (`commitKpis`, `kpi-research.server.ts`, onboarding corpus, manual Add Source) to `INSERT … ON CONFLICT (country_code, normalized_url) DO UPDATE SET last_seen_at = now(), quality = GREATEST(...)`. Wrap in a single `upsertCountrySource()` helper in `src/lib/country-data/sources.server.ts` so no call site bypasses it.
- **Registry**: add a small `KPI_PROVIDER_SOURCES` map (World Bank, IMF, UN, etc.) so KPI research references a canonical source row per country instead of creating a new one per KPI attempt.

### 2. Clickable source → readable summary drawer

- Row becomes a button that opens a right-side `SourceDetailDrawer` (shadcn `Sheet`).
- Contents:
  - Header: title, org, kind pill, quality stars, on/off toggle, last fetched.
  - **AI-written summary** (2–4 sentences) of what the source is and what data types it contributes — generated on first open via a new `summarizeSource` server fn (Gemini 2.5 Pro via Lovable AI Gateway, grounded in the top RAG chunks + source metadata), cached to a new `country_sources.summary` + `summary_generated_at` column. "Regenerate" button.
  - **Data coverage chips**: derived from `country_source_documents` + `country_kpis.source_id` — e.g. "12 documents · 143 chunks · powers 6 KPIs (GDP, Inflation, …) · referenced by 3 dossiers".
  - **Recent documents** list (title, fetched_at, chunk count) with link out.
  - Actions: Re-ingest, Toggle active, Delete, Edit metadata.

### 3. Robust Add Source

Replace the current single-URL modal with a tabbed `AddSourceDialog`:

1. **Link** — paste one or many URLs (newline / comma separated), auto-detects kind (gov / news / kpi_source / dataset) via domain + heuristics, org auto-filled via metadata fetch, validated + deduped against existing rows before insert.
2. **Documents** — dropzone (react-dropzone) accepting PDF, DOCX, PPTX, XLSX, CSV, TXT, MD (≤20MB each, up to 10). Uploads to a new `country-sources` storage bucket, then a server fn parses via `document--parse_document` equivalent server-side pipeline (pdf-parse / mammoth already in stack), chunks + embeds into `country_source_chunks`, and creates one `country_sources` row per file with kind=`document`.
3. **API / MCP** — form for REST endpoints (base URL, auth header name, secret reference via `add_secret`, sample request) and MCP servers (server URL, tool allowlist). Stored in a new `country_source_connections` table linked 1:1 to `country_sources` with kind=`api` or `kind=mcp`. Scheduled poll via existing harvest_runs.
4. **Bulk dropzone** — top-level dropzone across the dialog: drop a mixed set of files or a `.txt` / `.csv` of URLs and it fans them to the right tab automatically.

Every path routes through `upsertCountrySource()` so the dedupe rule applies uniformly. A summary is queued for generation immediately after ingest so the detail drawer is useful on first open.

### 4. UI polish on the Sources tab

- Coverage banner at top: "54 sources · 54 active · 0 duplicates · 12 with AI summary".
- Column for "Powers" (KPI/dossier count) so users see which sources are actually being used.
- Bulk actions: select rows → Re-ingest / Toggle / Delete / Regenerate summary.

### Technical section

- **New files**: `src/lib/country-data/sources.server.ts` (upsert + summarize), `src/components/country-data/SourceDetailDrawer.tsx`, `src/components/country-data/AddSourceDialog.tsx` (tabs + dropzone), `src/lib/country-data/source-normalize.ts` (URL normalization shared client+server).
- **Edits**: `src/lib/country-data/manage.functions.ts` (new `summarizeSource`, `ingestDocumentSource`, `registerApiSource`, `registerMcpSource`, `bulkAddSources`), `src/lib/country-onboarding/kpi-research.server.ts` + `corpus.functions.ts` (route through upsert helper, use `KPI_PROVIDER_SOURCES`), `src/routes/_authenticated/admin/countries.$code.data.tsx` (row click, new dialog, banner, bulk actions).
- **Migrations**:
  1. Add `normalized_url` generated column, `summary`, `summary_generated_at`, `document_storage_path` to `country_sources`.
  2. Backfill + merge duplicates (with FK repoint).
  3. Unique indexes (steps above).
  4. New `country_source_connections` table (api/mcp config) + GRANT + RLS (admins only).
  5. New storage bucket `country-sources` (private) with policies.
- **AI**: `summarizeSource` uses `google/gemini-2.5-pro` via Lovable AI Gateway with `Output.object({ summary, data_types: string[], coverage_notes })`.
- **Dropzone**: `react-dropzone` (add via `bun add`).
- **Concurrency**: `upsertCountrySource` uses `ON CONFLICT` inside a single statement — safe under parallel KPI research passes.

### Out of scope

- Changing existing KPI inference logic.
- Rewriting harvest scheduling (only wires new api/mcp source kinds into existing runner).
