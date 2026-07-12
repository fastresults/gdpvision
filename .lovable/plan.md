
# Robust Add Memory — plan

Bring the "Add memory" flow up to the same standard as **Add source** (tabs, drop zones, bulk paste, API/MCP ingestion), plus an AI extractor that turns raw text/docs/links into structured memory objects the admin reviews before commit.

## Where it lives

Replace the inline `AddMemoryForm` in `MemoryTab` (countries.$code.data.tsx) with a `<AddMemoryDialog>` opened from the existing "Add memory" button. Same dialog is reused on the super-admin `/admin/brain` route (country selector on the first step).

## Dialog structure

Modeled on `AddSourceDialog`:

```
Add memory to <COUNTRY>
[ Manual | Bulk paste | Documents | Link / URL | API / MCP | From source ]
```

### 1. Manual  (current form, upgraded)
- Sector (searchable combobox from `country_sectors` + "cross_cutting")
- Kind (chips: audience, position, statement, outlet, precedent, fact, risk)
- Scope (this country / national)
- Title, Body (markdown textarea, char count)
- Weight (1–5) · Verified toggle · Tags (freeform)
- Optional citation URL → creates a `citations` row linked to the memory

### 2. Bulk paste
- Textarea. One memory per line OR `sector | kind | title :: body` mini-format.
- Preview table before commit; per-row edit; duplicate detection on (scope, sector, kind, title).
- Commits via a new `bulkUpsertMemory` server fn.

### 3. Documents (drop zone, mirrors Sources)
- Drag-and-drop / click-to-browse (PDF, DOCX, TXT, MD; up to 10 files, 20 MB).
- File chips with remove.
- On upload → new `ingestMemoryFromDocument` server fn:
  1. Upload via existing `ingestDocumentSource` helper (creates a `country_source_document` + chunks so provenance is preserved).
  2. Call Lovable AI Gateway (`google/gemini-2.5-flash`) with the chunk text and the memory schema; ask for an array of `{ sector_code, kind, title, body, weight, citations: [chunkIdx] }`.
  3. Return draft rows to the client.
- **Review step** (in-dialog): draft rows shown in an editable table with accept / skip / edit / merge; only accepted rows call `bulkUpsertMemory`, each with a citation back to the source document chunk.

### 4. Link / URL
- Single URL or list of URLs.
- Server fn `ingestMemoryFromUrl`: fetches via existing source fetcher (`upsertSource` + doc pipeline reused, marked `hidden_source=false`), runs same AI extraction, returns drafts for review.

### 5. API / MCP
- Pick from **already-registered** connections for this country (`country_source_connections`) via combobox, or "Register new…" which opens the same form as Sources' ApiMcpTab.
- Optional query/prompt string (for MCP tools) or GET path suffix (for REST).
- Server fn `ingestMemoryFromConnection`: invokes the connection, feeds the JSON/text response through the AI extractor, returns drafts for review.

### 6. From source (existing corpus)
- Combobox of this country's existing `country_sources` (already ingested).
- "Extract memories" → runs AI extractor over the stored chunks, drafts to review.
- Lets admins mine memories from sources they already loaded, no re-upload.

## Shared "Review drafts" step

All AI paths (Documents / Link / API / From source) funnel into one review pane:

- Editable rows: sector, kind, title, body, weight, verified, citation ref.
- Toolbar: Accept all · Skip all · Filter (kind, sector) · Diff-check for near-duplicates of existing memory (server fn `findMemoryDuplicates` via embedding cosine on `memory_objects` if enabled, else title trigram).
- Commit → `bulkUpsertMemory`; on success invalidate `memoryQuery(code)` and close.

## Server functions (new, in `manage.functions.ts`)

- `bulkUpsertMemory({ countryCode, items[] })` — validates and upserts N rows; returns `{ inserted, updated, duplicates }`.
- `ingestMemoryFromDocument({ countryCode, filename, mime, content_b64, sector_hint? })`
- `ingestMemoryFromUrl({ countryCode, urls[], sector_hint? })`
- `ingestMemoryFromConnection({ countryCode, connectionId, query?, sector_hint? })`
- `extractMemoriesFromSource({ countryCode, sourceId, sector_hint? })`
- `findMemoryDuplicates({ countryCode, titles[] })`

All go through `requireSupabaseAuth` + `assertAdmin`; AI calls use the existing `ai-gateway.server.ts` helper with a strict JSON-schema prompt (return `{ items: MemoryDraft[] }`).

## Files

- **New**: `src/components/country-data/AddMemoryDialog.tsx` (tabs + review pane, mirrors `AddSourceDialog` structure).
- **New**: `src/components/country-data/MemoryDraftReview.tsx` (shared review table).
- **Edited**: `src/routes/_authenticated/admin/countries.$code.data.tsx` — swap inline form for dialog; remove `AddMemoryForm`.
- **Edited**: `src/lib/country-data/manage.functions.ts` — add server fns above; reuse `ingestDocumentSource`, `upsertSource`, and `country_source_connections` helpers.
- **Edited**: `src/routes/_authenticated/admin/brain.tsx` — add "Add memory" button that opens the same dialog with a required country picker.

## Out of scope

- No schema changes to `memory_objects`.
- No new connection kinds beyond what Sources already supports.
- Real-time streaming of AI extraction (batch response only for v1).
- Embedding-based dedupe only wired if the embeddings column already exists on `memory_objects`; otherwise title-trigram fallback.
