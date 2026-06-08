## Goal
Replace the single idle image + "GDP Vision" text on the kiosk's default (no-item-selected) screen with an **admin-managed carousel of images** that auto-advances.

## Scope

### Backend (new table)
New table `public.idle_images`:
- `id uuid pk`
- `media_asset_id uuid` (nullable) — link to existing Media Hub asset
- `image_url text not null` — resolved URL (denormalized for fast kiosk read)
- `caption text` (nullable, optional overlay text)
- `sort_order int not null default 0`
- `created_at timestamptz`

RLS: public SELECT; writes via service role only (admin server fns), matching the pattern used by `items` and `app_settings`.

The existing `idle_image_url` setting is kept as a **fallback** when the table is empty (no data migration needed; admin can move it into the new table manually if desired). The "GDP Vision" title text on the idle screen is removed per request.

### Server functions (`src/lib/idle-images.functions.ts`)
- `listIdleImages` (GET) — used by `/api/kiosk-data` and admin.
- `addIdleImage({ media_asset_id?, image_url, caption? })`
- `updateIdleImage({ id, caption?, sort_order? })`
- `removeIdleImage({ id })`
- `reorderIdleImages({ ids: string[] })`

`/api/kiosk-data` returns `{ items, settings, idleImages }`.

### Admin UI (`src/routes/admin.tsx`)
New "Idle Carousel" section near the existing idle-image upload area:
- Grid of current carousel images with thumbnail, caption input, up/down reorder buttons, and a delete button.
- "Add image" picker that lets the admin either:
  - Pick from existing Media Hub images (modal listing `media_assets` of `kind='image'`), or
  - Upload a new one (reuses existing `/api/upload-media` then auto-adds to carousel).
- Optional per-image caption text input (saved via `updateIdleImage`).

The single legacy `idle_image_url` setting stays editable as a fallback for now (small note: "Used only when carousel is empty").

### Kiosk idle screen (`src/routes/index.tsx`)
When `!active`:
- If `idleImages.length > 0` → render a full-bleed shadcn `Carousel` (already in `src/components/ui/carousel.tsx`) using `embla-carousel-autoplay`:
  - Autoplay every ~6s, loop, no visible arrows, no dots.
  - Each slide: image with `object-contain`, sized like current idle image (`max-h-[66%] max-w-[66%]`), centered.
  - Optional caption rendered below the image if present.
- Else if `idle_image_url` setting exists → current single-image fallback.
- Else → existing eye-icon placeholder.

The standalone "GDP Vision" title text below the image is removed (carousel is the focal point).

### Dependencies
- Add `embla-carousel-autoplay` (small plugin, ~2KB) — shadcn `Carousel` already wraps `embla-carousel-react`.

## Out of scope
- No changes to Media Hub upload pipeline, video player, PDF viewer, top bar, mobile kiosk (current single idle behavior on mobile preserved unless you ask).
- No transitions/effects beyond embla's default slide; no Ken Burns / fade.
- No scheduling (time-of-day rotation), no per-image link targets.

## Verification
1. Admin adds 3 images → kiosk idle screen cycles through them every 6s.
2. Admin removes all → kiosk falls back to `idle_image_url` setting; if also empty, shows the icon placeholder.
3. Reorder in admin reflects on kiosk after the kiosk-data refetch.
4. Mobile view unchanged.

## Open question
Should the idle screen on **mobile** (`MobileKiosk`) also use the carousel, or keep its current behavior? Default in this plan: keep mobile unchanged.
