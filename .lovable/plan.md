
## Goal

Introduce a new **Gallery** category behavior. When an admin adds a category, they pick a media mode (Videos only, Images only, or Videos + Images). Content inside the category is organized into **named galleries**, each containing media items. On the kiosk, the category opens a grid of gallery tiles; tapping one expands into a thumbnail grid of its media.

## Data model (migration)

Two new tables, plus extend `categories`:

1. `categories.media_modes text[]` — allowed kinds in this category. One of:
   `['video']`, `['image']`, `['video','image']`. Only meaningful when `behavior = 'gallery'`.
   - Update `behavior` CHECK (or app-level enum) to include `'gallery'`.

2. `galleries`
   - `category_id uuid → categories.id (cascade)`
   - `label text`, `cover_url text null`, `sort_order int`, timestamps.

3. `gallery_items`
   - `gallery_id uuid → galleries.id (cascade)`
   - `kind text check in ('video','image')`
   - `media_asset_id uuid → media_assets.id` (for library picks / uploads)
   - `storage_path text null` (for direct uploads landing in storage)
   - `thumbnail_url text`, `label text null`, `sort_order int`, timestamps.

GRANTs to `authenticated` + `service_role`, RLS enabled, public SELECT policy
(matches the pattern used by `items`, `categories`, `idle_images`).

Storage: reuse the existing `event-videos` bucket for video uploads; add a new
private `gallery-images` bucket for image uploads. Both served via signed/public
URLs the same way current media flows do.

## Server functions (`src/lib/galleries.functions.ts`)

- `listGalleries({ categoryId })` — galleries + nested item counts/covers.
- `getGallery({ id })` — gallery + ordered items.
- `createGallery / updateGallery / moveGallery / deleteGallery`.
- `addGalleryItem` — accepts either `{ mediaAssetId }` (library pick) or an
  uploaded file reference (path returned from existing upload route).
- `updateGalleryItem / moveGalleryItem / deleteGalleryItem`.

Image upload reuses `/api/upload-media`; video upload reuses the existing
video upload endpoint. A new `/api/upload-gallery-image` route is only added
if the existing media route doesn't already cover the bucket needed.

## Category creation UI (`CategoryManager.tsx`)

When admin picks `behavior = "gallery"`, reveal a second control:

- Radio: **Videos only / Images only / Videos + Images** → writes `media_modes`.

In the existing categories list, gallery rows show the media-mode badge next
to the behavior badge.

## Admin panel (`src/routes/admin.tsx`)

For a category whose `behavior = "gallery"`, the per-category tab swaps the
existing items form for a **Gallery manager**:

```
[ + New gallery ]                 (label, optional cover)
─────────────────────────────────
▸ Past Conferences (8 items)   ↑ ↓  ✎  🗑
    └ on expand: thumbnail grid of items
        each tile: thumb · label · kind badge · ↑ ↓ ✎ 🗑
        [ + Add video ] [ + Add image ]   (buttons match media_modes)
▸ Product Demos (3 items)      ↑ ↓  ✎  🗑
```

Add-item flow opens a small picker: tabs for **Upload** and **Library**
(media_assets), filtered to the kinds allowed by `media_modes`.

## Kiosk rendering (`src/routes/index.tsx` + components)

New branch alongside the existing video/PDF/website renderers:

1. Selecting a gallery category shows a **grid of gallery tiles** (cover
   image or auto-mosaic of first 4 items, label, item count).
2. Tapping a tile expands into a **thumbnail grid** of its items (videos
   show poster + play badge, images show thumbnail).
3. Tapping an item opens fullscreen — video uses the existing video player,
   image opens a lightweight image viewer with prev/next within the gallery.
4. Back button returns: item → gallery grid → category grid.

Mobile (`MobileKiosk.tsx`) mirrors the same three-level navigation.

## Types

Extend `src/lib/kiosk-types.ts`:
- `CategoryBehavior` adds `"gallery"`.
- `MediaMode = "video" | "image"`; `Category.media_modes?: MediaMode[]`.
- New `Gallery` and `GalleryItem` types.
- `kiosk-data` API returns `galleries` and `galleryItems` alongside `items`.

## Out of scope

- No reordering via drag-and-drop (keep ↑/↓ buttons, matching current UX).
- No per-gallery access control beyond what categories already have.
- No bulk import; items added one at a time (upload or library pick).

## Rollout order

1. Migration (categories.media_modes + behavior enum, galleries, gallery_items, grants, RLS, bucket).
2. Types + server functions + kiosk-data API extension.
3. CategoryManager: media-mode picker.
4. Admin panel: Gallery manager component.
5. Kiosk: gallery grid + thumbnail grid + image viewer.
6. Mobile kiosk parity.
