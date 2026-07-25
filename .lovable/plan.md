
## What happened

Server logs for the last hour show **zero calls to `extractManifesto`** even though the user dropped a file. Combined with "no visual feedback at all," this means the browser event never reached our React `onDrop` handler at all — the state transition to `extracting` never ran, so no spinner, no toast, no network request.

The DropZone component itself (`src/routes/_authenticated/admin/countries.$code.mandate-compact.tsx` L664–L810) is wired correctly: `role="button"` div, `onDragOver` calls `preventDefault`, `onDrop` reads `dataTransfer.files`. Live DOM inspection confirms the element exists, is on-screen, has `pointer-events: auto`, and its descendants are hit-testable.

## Root cause (most likely)

We prevent the browser's default drop behaviour **only when the pointer is over our div**. If the user's cursor enters the browser window over any other area first (header, sidebar, padding around the zone) or briefly leaves the zone mid-drag, the browser's own drag handler wins and, on drop, **navigates the tab to `file://…`**, unloading React before our handler runs. Because the navigation is cancelled by the SPA router the user sees "nothing happen" — no spinner, no error, no network call. This matches the empty log signature exactly.

Secondary contributors:
- The zone's top edge sits at `y = -69.5` in the current viewport (partly under the sticky header), so the user's drop point is close to non-zone regions.
- There's no non-state visual acknowledgement — if React state fails to update for any reason, the UI stays completely idle.

## Fix

### 1. Window-level drag/drop guard (mandate-compact route only)
Add a `useEffect` on the Ingest step that installs `dragover` and `drop` listeners on `window` while the panel is mounted. Both call `preventDefault()` so the browser never navigates away when a file is dropped anywhere on the page. The listeners are removed on unmount and only active during the ingest step to avoid interfering with other drag/drop UIs.

### 2. Reliable feedback on the zone itself
- Enlarge the effective hit area and add a fixed min-height so the zone can't shrink behind the sticky header.
- Fire an immediate `toast.loading("Reading manifesto…")` inside `handleFile` **before** the async `arrayBuffer()` call, and dismiss/replace it in `runExtract`. Guarantees at least one visible signal even if React batching delays the `setPhase` render.
- Add a lightweight top-of-page progress bar (existing token) toggled by `phase === "extracting"` so feedback is visible even when the zone is scrolled off screen.

### 3. Diagnostic breadcrumbs
- Add `console.info("[mandate-compact] drop received", …)` at the very top of `onDrop` (before any early return), and one at the top of `handleFile`. These let us verify the event path on the next attempt via console logs.
- Log the extract result and any thrown error with a `[mandate-compact]` tag in `runExtract`.

### 4. Verify
After the change, ask the user to drop again; then:
- Read browser console for `[mandate-compact] drop received`.
- Check `stack_modern--server-function-logs` for an `extractManifesto` entry.
- If drop still doesn't fire but browser is no longer navigating away, we know it's a hit-test issue and iterate on zone geometry.

## Files touched

- `src/routes/_authenticated/admin/countries.$code.mandate-compact.tsx` — window drag guard `useEffect`, immediate `toast.loading` in `handleFile`, breadcrumb `console.info` calls, min-height on the drop zone, top progress indicator during extraction.

No server-side or schema changes. No changes to the extract server function (already fixed in the previous turn).
