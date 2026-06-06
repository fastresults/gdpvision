## Goal
Make the mobile tray thumbnails predictable: each website card should either show a saved homepage/hero preview, show a clear “generating” state, or fall back gracefully without broken/clunky behavior.

## Current problem
The mobile tray currently builds screenshot URLs directly in the browser using WordPress mShots. That service is asynchronous and can return a placeholder while it generates the real screenshot. Because the app does not save thumbnail status or a successfully generated image, every session is dependent on an external live image request. That creates intermittent missing thumbnails.

## Plan

### 1. Add saved thumbnail state to items
Add database fields on `items` for website thumbnails:
- `thumbnail_url` — URL of the saved/generated thumbnail to display
- `thumbnail_status` — `pending`, `processing`, `ready`, or `failed`
- `thumbnail_error` — short failure reason for admin/debug visibility
- `thumbnail_updated_at` — when it was last attempted

This gives the UI a predictable source of truth instead of guessing from `<img>` load behavior.

### 2. Generate thumbnails server-side
Add TanStack server functions to:
- request a screenshot URL for each website/doc/presentation item
- verify that the returned image is usable rather than a placeholder
- save the final usable thumbnail URL/status back to the item
- mark failures explicitly instead of leaving cards stuck in an invisible loading state

I will keep this Worker-compatible: no Puppeteer, no native image libraries, no long-running browser automation.

### 3. Use a safer provider fallback chain
Update `src/lib/thumbnail.ts` so thumbnail generation has multiple deterministic candidates instead of one brittle endpoint:
1. saved `item.thumbnail_url` if ready
2. generated screenshot URL candidate
3. fallback visual placeholder if generation is pending/failed

The tray will prefer saved thumbnails first and only trigger generation when needed.

### 4. Update the mobile tray UX
Update `MobileKiosk.tsx` so each card shows a clear state:
- **Ready:** saved homepage thumbnail
- **Processing:** non-jumpy shimmer/skeleton with category icon, not an empty black box
- **Failed/unavailable:** clean branded placeholder with category icon and label

This prevents broken images and makes the tray feel stable even when a screenshot provider is delayed.

### 5. Add admin refresh controls
Update `/admin` so the existing “Refresh favicons” concept becomes thumbnail-aware:
- add a “Refresh thumbnails” action
- allow refreshing all items or a single item
- show status beside each item so it’s obvious which thumbnails are ready, processing, or failed

### 6. Keep mobile performance stable
Avoid loading every external screenshot directly in the tray on every open. Once thumbnails are saved, mobile loads the saved/stable URL. Cards remain tappable regardless of thumbnail status.

## Technical files likely to change
- `src/lib/items.functions.ts` — item shape, list query, thumbnail generation/refresh server functions
- `src/lib/thumbnail.ts` — thumbnail URL/status helpers
- `src/components/mobile/MobileKiosk.tsx` — card rendering states
- `src/routes/admin.tsx` — refresh/status controls
- new migration under `supabase/migrations/` — thumbnail columns and safe defaults

## Validation
After implementation I will verify:
- mobile tray opens and shows every card in a stable visual state
- saved thumbnails display when available
- failed thumbnails show the fallback, not a broken/missing image
- refresh action updates thumbnail status
- no SSR/runtime errors on `/` or `/admin`