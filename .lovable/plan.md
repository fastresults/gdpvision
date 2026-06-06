# Media Hub Plan

A central media library in the admin where you upload files once and reuse them anywhere: as item favicons, as the kiosk's idle (pre-selection) screen image, or as the URL backing a video/presentation/doc item. Filterable by file type.

## What you'll see

**New "Media Library" tab in /admin** (alongside Websites, Presentations, Google Docs, Past Events, Brand Building):
- Drop zone / "Upload" button. Accepts images (png, jpg, webp, svg, gif), videos (mp4, webm, mov), PDFs, and Office docs (pdf, doc/docx, ppt/pptx).
- Grid of uploaded files showing thumbnail (image preview, video poster, or type icon), filename, size, upload date.
- Filter chips at the top: **All / Images / Videos / PDFs / Documents**.
- Each tile: copy URL, set as Idle Image (images only), rename, delete.

**Idle screen on kiosk (/)**:
- Replaces the eye-icon placeholder shown before a resource is selected.
- If an idle image is set in admin, it displays full-screen (object-contain, centered) with the kiosk title overlaid at the bottom.
- If none is set, the existing eye-icon placeholder stays as fallback.
- Admin tab has a small "Idle Screen" panel showing the current image with "Change" / "Clear" actions, also accessible from any image tile's "Set as Idle Image" action.

**Custom favicons for items**:
- In every existing category tab (Websites / Presentations / Docs), the row's favicon becomes clickable. Clicking opens a small picker showing images from the library; choosing one overrides the auto-derived favicon. A "Reset to auto" option restores the Google-derived favicon.
- Past Events / Brand Building rows keep the Film badge (no favicon concept for videos).

**Video/doc items via library**:
- When adding to Past Events or Brand Building, in addition to the existing direct upload, a "Pick from Library" button opens a video-filtered picker.
- When adding to Presentations or Google Docs, a "Pick from Library" button opens a PDF/doc-filtered picker that fills the URL field with the file's public URL.

## How it works (technical)

**Storage**: new private bucket `media-library` (separate from `event-videos` so existing video items are untouched). Signed URLs with 10-year expiry, same pattern as `uploadEventVideo`.

**DB**: new table `public.media_assets` with columns:
- `id uuid pk`, `filename text`, `mime_type text`, `size_bytes bigint`, `storage_path text`, `public_url text`, `kind text` (one of `image | video | pdf | document`), `created_at timestamptz`.
- RLS: public read (same posture as `items`); writes go through service-role server fns. Standard GRANTs for `anon`, `authenticated`, `service_role`.

**Settings**: add one new key `idle_image_url` to `settings.functions.ts` (default empty string → kiosk uses eye-icon fallback).

**Items table**: add nullable `favicon_asset_id uuid` column (FK to `media_assets.id`, on delete set null). When set, kiosk and admin prefer this over `favicon_url`. The existing auto-derived `favicon_url` keeps working unchanged.

**Server functions** in new `src/lib/media.functions.ts`:
- `listMedia({ kind? })` — returns assets, optionally filtered by kind.
- `uploadMedia(FormData)` — validates MIME, derives `kind`, max 500 MB for video / 50 MB for everything else, uploads to `media-library`, signs URL, inserts row.
- `renameMedia({ id, filename })`, `deleteMedia({ id })` — admin maintenance (delete removes both row and storage object).
- `setItemFaviconAsset({ itemId, assetId | null })` — sets/clears the override.

**Admin UI**: new `MediaTab` component in `src/routes/admin.tsx`, added to `CATEGORY_KEYS` UX as a sibling tab but rendering its own grid instead of the items list. Filter chips set local state. Existing item rows get a small popover picker for favicon override.

**Kiosk UI**: in `src/routes/index.tsx`, the idle state checks `labels.idle_image_url`; if present, renders `<img src={...} className="h-full w-full object-contain" />` with the title overlay; otherwise keeps the current eye-icon block. Item favicon resolution becomes `item.favicon_asset?.public_url ?? item.favicon_url`.

## Files touched

- new migration: `media_assets` table + GRANTs + RLS, `items.favicon_asset_id` column, `media-library` bucket policy on `storage.objects`
- new bucket `media-library` (private, via storage tool)
- new: `src/lib/media.functions.ts`
- edit: `src/lib/settings.functions.ts` (add `idle_image_url`)
- edit: `src/lib/items.functions.ts` (return joined favicon asset; add favicon-asset server fn)
- edit: `src/routes/admin.tsx` (Media Library tab, idle-image panel, favicon picker)
- edit: `src/routes/index.tsx` (idle image rendering, favicon resolution)

No new npm packages.

## Out of scope (per your answers)

- Category usage / search / date filters — only file-type filter.
- Replacing the URL-based add flow for Websites etc. — those stay as-is; the library is additive.
- Looping idle video — single image only; can revisit later.
