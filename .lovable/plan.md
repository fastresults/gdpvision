## What's missing today

The pieces exist in the database but there is no library surface:

- `comms_artifacts` stores `body`, `channel`, `kind`, `audience`, `draft_state` (draft/review/approved/released), `approvals` (jsonb tier trail), `released_at`, `published_url`, `published_at`, `strategy_id`, `signal_id`.
- Server fns `listComms`, `getComms`, `saveComms`, `approveComms` already exist in `src/lib/narrative.functions.ts`.
- `DraftStudio.tsx` reads/writes them but only in the context of one signal. Once the user leaves the signal, drafts are effectively invisible — no cross-signal list, no search, no filters, no history, no export, no reuse.

A diplomat using this daily would ask: "Where is every press release I've drafted this month? Which are awaiting my approval? What did we publish about tourism last quarter? Can I duplicate that PM statement as a template?"

## Plan — Chamber 5 Document Management ("Comms Library")

### 1. New route: `countries.$code.narrative.library.tsx`

A dedicated Library tab alongside Signals, reachable from the Narrative Chamber shell. Two-pane layout:

- **Left rail — filters + list** (persistent, URL-synced via `validateSearch`):
  - Search box (full-text over `body`, signal topic, audience) — debounced 250ms.
  - Status chips: Draft · In review · Approved · Released (color-coded, matches DraftStudio dots).
  - Channel multiselect (Press release, PM statement, LinkedIn, X, Op-ed, Talking points, Internal memo…).
  - Audience multiselect (Domestic, Regional, International, Diaspora, Internal).
  - Date range (Last 7d / 30d / 90d / Custom).
  - Priority filter inherited from parent signal (P1–P5).
  - Sort: Updated (default) · Released · Priority · Channel · Signal.
- **Right pane — detail viewer**:
  - Renders the selected artifact body via `CitedMarkdown` (respects global citation rule).
  - Metadata strip: signal title (clickable → returns to signal), channel, audience, draft_state, released_at, published_url, last editor, updated_at.
  - Actions: Edit (opens DraftStudio in-place drawer), Duplicate as template, Copy body, Download `.md` / `.docx`, Copy public URL, Approve (if in review), Mark released.
  - Approval trail: renders `approvals` jsonb as a vertical timeline (tier, actor, decision, timestamp, note).
  - Version history panel: shows past `updated_at` snapshots via a new `comms_artifact_revisions` table (see §3).

### 2. Server functions (add to `src/lib/narrative.functions.ts`)

All under `requireSupabaseAuth`, scoped by `scope_key = country_code`:

- `searchComms({ country, q?, states?, channels?, audiences?, from?, to?, sort?, limit?, offset? })` — returns rows joined with signal `topic` and priority. Uses `ilike` on body + topic; add trigram index if not present.
- `getCommsDetail({ id })` — full row + parent signal + strategy summary + revision list.
- `duplicateComms({ id, target_signal_id? })` — clones body/channel/audience as a new draft (defaults to same signal; user can retarget).
- `deleteComms({ id })` — soft-delete via new `deleted_at` column; only when `draft_state ∈ {draft, review}`.
- `exportComms({ id, format: 'md' | 'docx' })` — returns a signed download; docx built server-side.
- `listPendingApprovals({ country })` — feeds a badge count on the Library tab and a filter preset.

### 3. Schema additions (single migration)

- `comms_artifacts.deleted_at timestamptz` — soft delete.
- `comms_artifacts.title text` — human-readable label (auto-derived from signal topic + channel on save if null).
- `comms_artifacts.tags text[]` — user-applied topical tags (e.g. tourism, energy, CBI).
- GIN trigram index on `body` and `title` for search.
- New table `comms_artifact_revisions (id, artifact_id, body, editor_id, edited_at, note)` populated by a trigger on UPDATE of `body`. RLS mirrors parent; GRANTs per platform rules.
- RLS: extend existing SELECT policy to hide `deleted_at IS NOT NULL` from non-owners; keep admin visibility.

### 4. DraftStudio wiring

- After every save, insert a revision row (handled by trigger — no client change).
- Add a header row: title (editable inline), tags (chip input), and a "View in Library" link.
- Existing multi-channel batch flow untouched.

### 5. Chamber 5 shell

- Add "Library" tab next to "Signals" in `countries.$code.narrative.tsx`. Badge shows count of `draft_state='review'` items.
- Global keyboard shortcut `g l` jumps to Library; `/` focuses search.
- Sticky status banner reuses the existing pattern.

### 6. Diplomat-grade utilities

- **Templates**: any released artifact can be pinned as a Template (new boolean `is_template`). Templates surface in DraftStudio's channel picker as "Start from template".
- **Batch export**: on Library, multi-select rows → Download as ZIP of `.docx` files (server fn streams).
- **Print view**: one-click printable brief combining selected artifacts with government letterhead header (uses country name from CARICOM_OECS_REGISTRY).
- **Audit-ready trail**: every state transition already lands in `audit_log` via `traceability.functions.ts`; expose it in the detail pane's History tab.

### Technical notes

- All list reads via `ensureQueryData` + `useSuspenseQuery`; filters via `validateSearch` + `loaderDeps` so URLs are shareable.
- Search performance: trigram GIN on `body` + `title`; cap 200 rows per page with cursor pagination.
- Docx export uses the bundled `docx` npm package inside the server fn handler.
- Citations in body render with `CitedMarkdown` using strategy `sources` for the parent signal (already wired).
- Soft-delete + revision trigger keep the "never lose a diplomatic draft" guarantee.

### Out of scope for this pass

- External CMS publishing integrations (WordPress, X, LinkedIn API) — the `published_url` field remains manual until requested.
- Multi-language translation of drafts.