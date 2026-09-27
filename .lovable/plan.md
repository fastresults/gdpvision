# Fix Back navigation so it always matches real browser history

## What the logs show
- The build is fine, and no errors come from navigation. The only repeated console error is a duplicate-item warning (`signal-w0.0`) on the Narrative signals list, which has nothing to do with Back.
- So the problem is logic, not a crash. It sits in the "journey trail" that drives the Back button and the "Where I've been" menu.

## Root cause (from reading the trail code)
The trail tries to *guess* what the browser did, instead of reading it:
1. **Tab and step changes add a browser history entry, but the trail only overwrites its current entry.** The two drift apart. On a page where you've only changed tabs or steps (FDI Studio, Standards, wizards), the trail thinks you have no history. Back then jumps **Up** to the parent page instead of stepping back.
2. **"Where I've been" jumps count trail entries, not browser entries.** Once they differ, choosing an earlier page lands on the wrong page.
3. **Going A → B → A forward looks like a Back to the trail.** It drops B, so the next Back goes somewhere unexpected.

## Fix
- Track the browser's own position number for each page (the router keeps a hidden position index on every history entry). Store trail entries by that position:
  - Moving forward cuts off anything after the current position, then adds the new page.
  - Back and Forward move to a known position, so there's no guessing.
  - Pages that replace the address (filters, redirects) overwrite their own position.
- "Where I've been" still lists one row per page (tab changes on the same page are grouped under it). Jumping uses the real position difference, so it always lands on the chosen page.
- Back button: step back in the browser whenever an earlier position exists in this tab. Only go **Up** to the parent page when this tab has no earlier page (shared link or new tab).
- Keep sign-in return, per-tab storage and the unsaved-changes guard as they are.

## Verify
Browser test on Antigua, signed in:
1. Go to FDI Studio, open a threat, go back to the Studio list, then press Back. It should return to the threat.
2. Standards: change tabs twice, press Back twice. It should step back through the tabs, then back to the previous page.
3. Run the A → B → A case, then press Back. It should return to B.
4. "Where I've been": jump three steps back. It should land on the chosen page, and the browser Forward button should still work.
5. Refresh mid-journey, then press Back. It should still step back.

## Technical details
- `src/lib/nav/trail.ts`: read `router.history.location.state.__TSR_index` in `onResolved`. Store `{ idx, href, pathname, title }`. Update by `idx` (truncate on push). `record()` no longer guesses Back from matching addresses.
- `src/components/nav/NavControls.tsx`: `useSmartBack` checks whether an entry exists with `idx < current`. `jump()` uses `history.go(target.idx - current.idx)`. The grouped menu collapses consecutive same-pathname entries.
- Bump the storage key to `v2` so old, drifted trails are discarded.
- Separately, fix the duplicate key in the signals list (unique key per signal) to clear the console error.
