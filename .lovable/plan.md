## EyeFrame — Build Plan

A full-screen kiosk that previews Websites, Presentations, and Google Docs in an iframe, with an open `/admin` page to manage the items.

### Routes
- `/` — kiosk view (top bar + iframe).
- `/admin` — CRUD for items (no auth, per your choice).

### Backend (Lovable Cloud)
Enable Lovable Cloud and create one table:

`items`
- `id` uuid pk
- `category` text — one of `websites` | `presentations` | `docs`
- `label` text
- `url` text
- `favicon_url` text nullable (auto-filled for websites from `google.com/s2/favicons`)
- `sort_order` int
- `created_at` timestamptz

RLS: enable, with public `SELECT` + public `INSERT/UPDATE/DELETE` policies (matches your "open admin" choice). Grants for `anon` + `authenticated`. Seed with the spec's starter items per category.

### Kiosk page (`/`)
Layout: `grid-rows-[8vh_92vh] h-screen overflow-hidden`.

Top bar (`#0D1F2D`, single row, no wrap):
- Left: ~180px category dropdown labeled "EyeFrame" with Websites / Presentations / Google Docs.
- Right: horizontally scrollable thumbnail strip (`overflow-x-auto`, `whitespace-nowrap`), cards ~140×52px with favicon/icon + label, rounded, dark bg, hover lifts brightness and shows `#00C9A7` bottom border. Click → sets active URL.

Preview area (92vh):
- Default: centered EyeFrame logo + "Select a resource above to begin" on `#0A0A0A`.
- Active: `<iframe>` full width/height, zero border, `sandbox="allow-scripts allow-same-origin allow-popups allow-forms"`, `allow="fullscreen"`.
- Iframe-blocked fallback (per your choice): detect with an `onLoad` timeout (~3s) — if the iframe never fires `load` for cross-origin sites that send `X-Frame-Options: DENY`, overlay a card with the site favicon, label, "This site can't be embedded", and an "Open in new tab" button (`target="_blank" rel="noopener"`). Reset the timer whenever the active URL changes.

State: `useState` for active category + active URL; switching category clears the URL back to the placeholder.

Mobile (<768px): full-screen centered message "EyeFrame is optimized for desktop".

### Admin page (`/admin`)
Simple dark UI matching the kiosk palette:
- Category tabs (Websites / Presentations / Docs).
- Table of items for the active category showing label, URL, sort order.
- Add row form: label + URL (favicon auto-derived for websites).
- Edit (inline) and Delete buttons per row.
- Reorder via Up/Down buttons that swap `sort_order` (keeps it simple; no drag-drop dep).
- All reads/writes via `createServerFn` handlers using `supabaseAdmin` (server-only) — kiosk page also reads via a public server fn ordered by `sort_order`.

### Design tokens (src/styles.css)
Add semantic tokens so we don't hard-code hex in components:
- `--background: oklch(...) /* #0A0A0A */`
- `--topbar: oklch(...) /* #0D1F2D */`
- `--accent: oklch(...) /* #00C9A7 */`
- `--foreground: oklch(...) /* #F0F4F8 */`

Load Inter via `<link>` in `__root.tsx` and register `--font-sans` in `@theme`.

### Technical notes
- Files: `src/routes/index.tsx` (kiosk), `src/routes/admin.tsx`, `src/lib/items.functions.ts` (list/create/update/delete/reorder server fns), one migration for the `items` table + grants + policies + seed data.
- No auth, no per-user scoping, global shared library.
- Single shared `items` source feeds both kiosk and admin so changes appear immediately after `router.invalidate()` / query refetch.

Ready to build when you approve.