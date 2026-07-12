## Problem

The **Corpus** tab shows five bare tiles (`40 Sources · 40 Active · 0 Documents · 0 Chunks · — Last ingest`) with no way to see what's behind any number, no explanation of what the numbers mean, and no visible action to fix the fact that all 40 sources have been **registered but never fetched** (which is why Documents / Chunks / Last-ingest are all empty).

The Sources tab has the source rows, but from Corpus tab you can't get there, and Documents / Chunks / ingest-history have **no drill-down surface anywhere in the app**.

## Fix

Turn the Corpus tab from a scoreboard into a working operations page.

### 1. Explainer strip (top of tab)

One paragraph, plain English:

> The corpus is what the AI reads when it answers questions about this country. It flows: **Sources** (URLs we've registered) → **Fetch** (Firecrawl pulls the page) → **Documents** (one per fetched URL) → **Chunk + embed** (split into passages with vector embeddings) → **Chunks** (searchable). Right now 40 sources are registered but 0 have been fetched, so the AI has nothing to retrieve.

### 2. Prominent action bar

- Primary button **Run corpus ingest** (calls existing `runCorpusIngest`) — visible whenever `documents === 0` OR `last_ingest_at` is older than 30 days. Shows spinner + last-run status inline.
- Secondary link **Manage sources →** jumps to the Sources tab.

### 3. Make every stat tile clickable → expands a detail drawer below

| Tile | What the drawer shows |
| --- | --- |
| **Sources** | Full list: org · title · url · active · doc-count · chunk-count. Row click → Sources tab prefiltered. |
| **Active** | Same list, filtered to `active = true`; inactive sources shown greyed with reason. |
| **Documents** | Table of `country_source_documents`: source, fetched_at, HTTP status, char length, chunk count, error (if any). Empty state explains "no source has been fetched yet — click Run corpus ingest". |
| **Chunks** | Per-source rollup: source · chunks · avg length · last embedded. Row expand shows first 3 chunk previews. |
| **Last ingest** | Recent `onboarding_runs` where `stage = 'corpus_ingest'`: started_at, duration, status, sources processed, errors. Click row → full run detail (model_stack, log). |

Only one drawer open at a time; the active tile gets a highlighted border.

### 4. Keep the Retrieval sanity check where it is, but add a hint

Under the search box, one line: "Searches the embedded chunks. Returns nothing until at least one source has been ingested."

## Technical notes

- **New server fn** `corpusDetail({ countryCode })` in `src/lib/country-data/manage.functions.ts`, admin-only, returns:
  ```ts
  {
    sources: Array<{ id, org, title, url, active, doc_count, chunk_count, last_fetched_at, last_error }>,
    documents: Array<{ id, source_id, source_title, fetched_at, http_status, char_len, chunk_count, error }>,
    runs: Array<{ id, started_at, finished_at, status, model_stack, error, notes }>  // stage = 'corpus_ingest', last 10
  }
  ```
  One query per section, joined in JS by `source_id`. Reuses tables already queried by `corpusStats`.
- **UI** stays in `src/routes/_authenticated/admin/countries.$code.data.tsx` `CorpusTab`. New local component `StatTile` accepts `onClick`/`selected`; new `CorpusDetailDrawer` switches on the selected key.
- **Run ingest wiring**: `useServerFn(runCorpusIngest)` + `useMutation`, invalidate `["data", code, "stats"]` and the new `["data", code, "corpus-detail"]` on success.
- No schema changes. No changes to Sources/KPIs/Dossiers/Ministries/Memory tabs.

## Out of scope

- Redesigning the other tabs.
- Editing ingest logic itself (Firecrawl, chunking, embeddings).
- Per-document re-fetch buttons (can be a follow-up once the detail view exists).
