## Goal

Every tab icon (Websites, Presentations, Docs) should be the favicon of the URL it opens in the iframe — automatically, with no manual upload.

## Current state

- Favicons are already auto-derived from the URL via Google's favicon service (`https://www.google.com/s2/favicons?domain={host}&sz=64`) — but **only** for the `websites` category, and **only** on insert. Presentations/Docs and any existing rows with `favicon_url = null` show the generic category icon.

## Changes

1. **`src/lib/items.functions.ts` — `createItem`**
   - Remove the `category === "websites"` restriction so the favicon is derived for all categories whenever the user doesn't supply one.

2. **`src/lib/items.functions.ts` — `updateItem`**
   - When the URL changes and the user didn't supply a custom `favicon_url`, recompute the favicon from the new host so renaming/repointing a tab keeps the icon in sync.

3. **`src/lib/items.functions.ts` — new `refreshFavicons` server fn**
   - One-shot backfill: select all `items` where `favicon_url IS NULL`, derive `https://www.google.com/s2/favicons?domain={host}&sz=64` from each row's `url`, and update in place. Returns count updated.

4. **`src/routes/admin.tsx`**
   - Add a small "Refresh favicons" button in the admin header that calls `refreshFavicons` via `useMutation` and invalidates the items query on success. Gives the user a way to fix any rows that pre-date the change.

5. **`src/routes/index.tsx` (kiosk)**
   - No logic change. The existing `<img src={item.favicon_url} />` already renders the icon; the `onError` fallback to the category icon stays as-is for hosts that block the favicon service.

## Notes

- Google's s2 service returns a generic globe for hosts it can't resolve, so the visual fallback is graceful.
- No schema migration needed — `favicon_url` already exists and is nullable.
- No new dependencies, no new env vars, no UI redesign.
