## Problems observed

1. **White screen on Comms Library.** The route
   `src/routes/_authenticated/admin/countries.$code.narrative.library.tsx`
   has no `errorComponent`, no `notFoundComponent`, and no `Suspense`
   fallback. Any thrown error (transient auth token, first-load race on
   `getCommsDetail`, chunk load failure) bubbles past the shell and paints
   nothing.
2. **No way to edit body during review.** `WorkflowRail` moves state
   forward, but `CommsDetail` renders the body read-only through
   `CitedMarkdown`. A reviewer can't fix a typo before approving — they
   have to reject → open the signal → regenerate.
3. **Drafts land as "Untitled draft".** `generateChannelDraft` in
   `src/lib/narrative-chamber.functions.ts` inserts `comms_artifacts`
   with no `title` column. `deriveTitle(channel, topic)` runs only in the
   list snippet — the detail header shows the raw null → "Untitled
   draft". There is also no obvious rename affordance.

## Fix plan

### A. Kill the white screen

Edit `countries.$code.narrative.library.tsx`:
- Add route-level `errorComponent` and `notFoundComponent` that render
  inside the narrative shell (message + "Reload" button that calls
  `router.invalidate()` + `reset()`).
- Wrap `<CommsDetail />` in `<Suspense fallback="Loading…">` and an
  inline `ErrorBoundary` so a single failing detail fetch never
  unmounts the list.
- Harden `activeId`: only set from `rows[0]?.id` after the list query is
  `isSuccess` (avoids briefly requesting a stale id during re-fetch).

### B. Edit body before approval

Add a body editor to `CommsDetail`:
- New tab `Edit` (visible when `draft_state ∈ {draft, review}` and user
  has `advisor | comms_director | line_minister | cabinet_secretary |
  admin` — reuse `has_role` via a new lightweight `canEditComms` server
  fn returning a boolean).
- Textarea (or lightweight markdown editor) bound to a local draft; on
  Save → new server fn `updateCommsBody({ id, body, note? })`:
  - Loads existing row, guards `draft_state !== 'released'`.
  - Writes `body` + bumps `updated_at`.
  - The existing `comms_artifact_snapshot_revision` trigger already
    snapshots the previous body into `comms_artifact_revisions`, so
    every edit becomes a reviewable revision automatically.
- After save: `invalidateQueries` on detail + library; toast "Saved
  revision" and flip tab back to `Body`. Activity tab already renders
  revisions via `UnifiedTimeline`.
- `WorkflowRail`: when body has been edited during `review`, show a
  small "Re-approve needed" hint alongside the Approve button
  (client-side flag using `updated_at > last approval `at`).

### C. Auto-name drafts + rename

- In `generateChannelDraft` (server), compute a title before insert:
  `${strategyTitleShort} — ${channelLabel}` (e.g. "Venezuela quake
  response — LinkedIn"), fall back to `deriveTitle(channel,
  signal.topic)` when strategy title is missing. Truncate at 140 chars.
  Store on `comms_artifacts.title`.
- Backfill: one-shot server fn `backfillCommsTitles({ scopeKey })`
  callable by admins that fills `title` for rows where it's null using
  the same logic. Not automatic; exposed as a small button in the
  library empty-state / header for admins only.
- Rename UX: the header already has an inline title `<input>` — add a
  visible pencil icon + "Rename" tooltip so users discover it; keep the
  blur-to-save behaviour that already calls `updateCommsMeta`.

### D. Docs / minor

- Update the workflow tooltip on the "In review" state to say "You can
  still edit the copy before approving — every save is versioned."

## Files touched

```text
src/routes/_authenticated/admin/countries.$code.narrative.library.tsx
src/components/narrative/comms/WorkflowRail.tsx
src/lib/narrative.functions.ts                 (updateCommsBody, canEditComms, backfillCommsTitles)
src/lib/narrative-chamber.functions.ts         (title on insert)
```

No schema changes: `comms_artifacts.title` already exists, and the
revision trigger already snapshots edits.

## Out of scope

Rich-text editing (stick with markdown textarea + preview toggle),
comment threads on revisions, and per-line diff view — flag if you
want any of those in a follow-up.
