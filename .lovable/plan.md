## Goal
Make the Media Hub a proper batch-upload experience: a large, obvious drop zone that accepts many files at once via drag-and-drop or click, with per-file progress and per-file error handling so one bad file doesn't kill the batch.

## Scope
Frontend-only changes in `src/routes/admin.tsx` (the `MediaHub` component). No server / schema / storage changes — the existing `/api/upload-media` route already accepts one file per request and is fine.

## Changes

### 1. Replace the button-only upload bar with a real drop zone
Lines ~896–930 of `src/routes/admin.tsx`. The new zone:
- Full-width dashed border card, ~140px tall, with `Upload` icon + headline "Drag & drop files here" + sub-text listing accepted types + a secondary "or click to browse" affordance.
- Handlers: `onDragEnter`, `onDragOver` (preventDefault), `onDragLeave`, `onDrop`. Track `isDragging` so the border/background highlight in the accent color while a drag is over it (same pattern already used in the idle-image dropzone).
- Click anywhere in the zone opens the existing hidden `<input multiple>`.
- Accepts the same MIME list already declared on the input.
- Filters dropped items to `DataTransferItemList` files only (ignores folders/text drags) and shows a toast/inline message if a file was rejected because of unsupported type or size.

### 2. Parallel uploads with per-file state
Replace the current `uploadMut` (sequential `for await`) with a queue model:
- Local state `queue: Array<{ id: string; file: File; status: 'pending'|'uploading'|'done'|'error'; error?: string }>`.
- On drop / picker change, append all selected files to the queue.
- A small worker effect uploads up to **3 files in parallel** (Promise pool) by calling the existing `uploadOne(file)` helper. On each completion, mark the item `done` (and `invalidate()` the `["media"]` query so the grid grows live) or `error` with the message.
- Items remain visible in a compact list under the dropzone until the user clicks "Clear completed".

### 3. Per-file progress UI
Under the dropzone, render a small list (only when `queue.length > 0`):
- Each row: filename, size, status badge (`Pending`, `Uploading…`, `Done`, `Failed: <msg>`), and a tiny remove/retry button for failed rows (retry just re-enqueues that one file).
- A header row with overall counts: `X uploaded · Y failed · Z remaining` and a "Clear completed" link.
- No real byte-level progress bar (fetch upload progress is awkward without XHR); a spinning indicator per active row is enough and matches the rest of the admin UI.

### 4. Remove the now-misleading single `alert()`
Errors are already shown inline per row, so drop the global `alert("Upload failed: …")` from `uploadMut.onError`. Keep `console.error` for debugging.

### 5. Keep the idle-screen dropzone unchanged
The idle-image panel above is a separate, single-file zone with a different purpose (it sets the idle screen), so leave it as-is. Only the general media upload area changes.

## Out of scope
- No changes to `/api/upload-media`, `media.functions.ts`, the `media_assets` table, or storage buckets.
- No chunked / resumable uploads. Existing 50MB image / 50MB doc / 500MB video limits remain.
- No changes to the media grid, filters, rename, delete, or idle-image behavior.

## Verification
- Drag 5+ mixed images onto the new zone → all enqueue, up to 3 upload in parallel, grid populates progressively, queue list shows each as `Done`.
- Drag an unsupported file (e.g. `.zip`) → it shows as `Failed: Unsupported file type` and the rest still succeed.
- Click the zone (not on a row) → OS picker opens with multi-select.
- Drag a file over the zone → border + background turn accent color; leaving the zone reverts.
- One failing file (e.g. oversized video) does not block the rest of the batch.
