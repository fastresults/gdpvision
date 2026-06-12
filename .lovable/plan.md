Let admins create, rename, reorder, and delete the categories that appear in the kiosk's top-bar dropdown. Each category declares a content behavior (Website iframe, PDF upload, Google Doc, or Video), which controls how its items render in the bottom iframe. The five existing categories (Events, GDP Sectors, Google Docs, Past Events, Brand Building) migrate to editable rows with no visual change on the kiosk.

## What the admin gets

A new "Categories" section in `/admin` with a table of rows. Each row has:
- **Label** (text, shown in the dropdown and tooltips)
- **Icon** (pick from a curated lucide set: Globe, Presentation, FileText, Film, Sparkles, plus ~10 more like Building2, Briefcase, GraduationCap, HeartPulse, Leaf, Anchor, Zap, etc.)
- **Behavior** (Website / PDF / Google Doc / Video — chosen at create time, locked after items exist so we never strand incompatible items)
- **Sort order** (up/down arrows, same UX as items)
- **Delete** (blocked with a clear message when the category still has items)

"Add category" opens a small form: label + icon + behavior. New categories show up immediately in the kiosk dropdown and the admin's item editor.

## Data model

New table `public.categories`:
- `slug` (text, unique, stable identifier used by `items.category` — auto-derived from label on create, e.g. "events", "gdp-sectors")
- `label` (text)
- `icon` (text, lucide icon name)
- `behavior` (text, one of `website` / `pdf` / `docs` / `video`)
- `is_builtin` (bool, true for the 5 seeded rows — cannot be deleted, behavior locked, but label/icon/order editable)
- `sort_order` (int)

Seeded in the same migration with slugs `websites`, `presentations`, `docs`, `videos`, `brand` so existing `items.category` values keep matching. RLS: public SELECT (kiosk needs it); writes only via admin server fns using `supabaseAdmin`. GRANTs follow the standard pattern.

`items.category` stays a text column referencing `categories.slug` (no DB FK so we can keep the existing rows untouched — server fns enforce the relationship).

## Server functions (`src/lib/categories.functions.ts`)

`listCategories`, `createCategory`, `updateCategory` (label/icon/sort), `deleteCategory` (rejects if items reference it), `moveCategory` (up/down, mirrors `moveItem`).

## Kiosk wiring (`src/routes/index.tsx`, `src/routes/api/kiosk-data.ts`)

- `/api/kiosk-data` returns `categories` alongside `items` / `settings` / `idleImages`.
- The hardcoded `ItemCategory` union and `CATEGORY_LABELS` / `CATEGORY_SETTING_KEY` constants come from the categories list at runtime.
- `CategoryIcon` resolves the icon name dynamically from a lucide name → component map.
- `PDF_CATEGORIES` / `VIDEO_CATEGORIES` derivations are replaced by `category.behavior === 'pdf'` and `=== 'video'` checks against the active item's category.
- Dropdown renders one button per category row in `sort_order`.
- `MobileKiosk` and `PresentationUpload` get the same treatment (behavior-driven, not slug-driven).

## Admin wiring (`src/routes/admin.tsx`)

- New "Categories" panel above the existing items panel.
- The item editor's category selector becomes a dropdown of the live category list.
- The "label_*" settings (label_websites, etc.) are deprecated in favor of `categories.label`; the Settings panel drops those five rows. `admin_title` / `kiosk_title` / `idle_image_url` stay.

## Migration safety

- Migration seeds the 5 builtin rows with matching slugs before any code change ships, so existing items keep working.
- `settings.functions.ts` keeps reading the old `label_*` keys for one release as a fallback (only used if a category row is missing) — harmless once the table is seeded.

## Out of scope

- Per-category color theming.
- Custom uploaded icons (curated lucide set only).
- Changing a category's behavior after creation.
- Idle carousel, favicon, video upload, PDF rendering — all unchanged.

## Verification

1. Kiosk dropdown still shows the same 5 categories with the same labels/icons after migration.
2. Admin adds a new "Reports" category (Website behavior) → it appears in the kiosk dropdown and in the item editor's category picker.
3. Admin adds a Website URL to "Reports", clicks it on the kiosk → loads in the bottom iframe like any other website.
4. Admin renames "Events" to "Conferences" → kiosk dropdown updates on next refetch.
5. Deleting a category that still has items shows a clear error and does nothing.
