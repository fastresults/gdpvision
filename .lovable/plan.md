# Every manifesto always has a cover thumbnail

## Goal
Every manifesto on file shows a cover. A manifesto can never appear without one: it uses a real cover when there is one, a cover automatically taken from its first page when possible, and a clearly labelled stand-in otherwise. The ABLP 2026 manifesto ("Renaissance") uses the cover you attached.

## What users will see
- **Elections index:** each manifesto card shows a portrait cover thumbnail on the left (3:4, like a document).
- **Compact header:** the selected manifesto's cover appears beside its title. Clicking it opens the full-size cover.
- **Cover controls (admins):** "Replace cover" (upload JPG/PNG/WebP) and "Use first page" (re-take it from the PDF). Where the cover came from is labelled: *Uploaded*, *From first page* or *Stand-in*.
- **Step 01 (Drop the manifesto):** there's an optional "Cover image" drop area.
  - **PDF upload:** if no cover is given, the first page is automatically saved as the cover.
  - **Link or pasted text:** a typographic stand-in cover is used (party initials, year, title) until someone uploads a real one.
- **Stand-in cover:** drawn from the existing ink and paper colours. It is never left blank.

## Rules that keep it "always"
- The system won't save a manifesto without a cover.
- Existing manifestos with no cover get a stand-in once, then show a "Replace cover" prompt.
- Covers go in the existing private thumbnails storage, in a folder per country. They're shown through short-lived signed links, so only people with access to that country can see them.

## ABLP-Manifesto-2026
Upload the attached cover and attach it to the existing ATG manifesto record, labelled *Uploaded*. No other data changes.

## Technical details
- **Migration:** add these columns to `country_manifestos`:
  - `thumbnail_path text`
  - `thumbnail_source text check in ('uploaded','first_page','placeholder')`
  - `thumbnail_updated_at timestamptz`
- **Same migration:** backfill `thumbnail_source='placeholder'` for existing rows, then set `thumbnail_source` to NOT NULL with default `'placeholder'` so no row can be coverless. The placeholder itself is drawn by the app, so no path is required.
- **Same migration:** add storage RLS on the `thumbnails` bucket for the `manifestos/<country>/...` prefix. Read access uses `has_country_access`. Write access is for super admins and country admins.
- **New `src/lib/mandate-compact/thumbnail.functions.ts`** (protected), with the usual `@domain`/`@tables`/`@ui` header:
  - `uploadManifestoThumbnail`: base64 image, 5 MB limit, image types only. Writes the file and upserts the row.
  - `getManifestoThumbnailUrl`: signed URL.
  - `regenerateFromFirstPage`
- **First-page render:** done in the browser with pdf.js (the server can't render PDFs), both at ingest and when "Use first page" is clicked. The resulting PNG is sent to the upload function.
- **`list.functions.ts` / `detail.functions.ts`:** join the manifesto's `thumbnail_path`/`thumbnail_source` and return a signed URL.
- **New `src/components/mandate-compact/ManifestoCover.tsx`:** renders the image or the typographic placeholder, used in both the index and the header.
- **ABLP cover:** upload the attached PNG to `thumbnails/manifestos/ATG/d08db01f-....png` and set the row's cover fields.
- **Afterwards:** run `bun run headers && bun run map`, then check in the browser at `/admin/countries/ATG/mandate-compact`.
