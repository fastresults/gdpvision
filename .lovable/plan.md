# Presentations as PDF Uploads

Replace the link-based Presentations category with a PDF upload + viewer workflow. Other categories (Websites, Google Docs, Past Events, Brand Building) stay unchanged.

## Admin (`/admin`)

When the active category is `presentations`, swap the "Add to Presentations" card for an upload UI:

- A drop zone (drag-and-drop + click to browse) that accepts a single `.pdf` (`application/pdf`, max 50 MB).
- A "Label" field above it (defaults to the file name minus extension; editable).
- On drop: upload directly to a new `presentations` storage bucket via a new `/api/upload-presentation` server route (same FormData pattern as `/api/upload-media`, since the seroval/FormData issue still applies). The route stores the file, creates a 10-year signed URL, and inserts an `items` row with `category='presentations'`, `url = signed URL`, `pdf_storage_path = path`.
- Show inline progress + error states (toast/alert on failure).
- Existing presentation rows render with a PDF icon + filename instead of the long URL; edit pencil lets the user rename the label or replace the file (re-upload). Delete also removes the storage object.

## Kiosk (front-facing UI)

In `MobileKiosk.tsx` (and the equivalent desktop tile click handler if present):

- Presentations tiles still show the existing thumbnail card. Tapping a presentations item opens a full-screen in-app **PDF viewer** instead of navigating to an external URL.
- Viewer: use `react-pdf` (wraps pdf.js) rendered in a modal/sheet with:
  - Page canvas sized to the viewport, pinch/scroll for zoom on touch.
  - Prev / Next page buttons + "Page X of Y" indicator.
  - Close (X) button to return to the kiosk.
  - Loading spinner while the PDF fetches; error fallback with retry.
- The pdf.js worker is loaded from the bundled `pdfjs-dist` (set `pdfjs.GlobalWorkerOptions.workerSrc` to the Vite-imported `?url` worker file) so it runs offline-friendly in the kiosk.

## Thumbnails

mShots only works on web URLs, so PDFs need a different path:

- On upload, server-side render page 1 with `pdfjs-dist` in the server function, capture a PNG via `@napi-rs/canvas` or `node-canvas`… **NOT viable in the Cloudflare Workers runtime** (no native canvas, see `<server-runtime>`).
- Practical alternative: render page 1 on the **client** in the admin upload flow (`react-pdf` → `canvas.toBlob`), POST the resulting PNG as a second multipart field on `/api/upload-presentation`. Server stores it in the `thumbnails` bucket and sets `thumbnail_url` + `thumbnail_status='ready'` in the same insert. No mShots polling needed for presentations.
- `generateItemThumbnail` / `refreshAllThumbnails` skip `presentations` going forward (same way they already skip video categories via `VIDEO_CATEGORIES`).

## Data model

Migration (single migration, with grants already in place from prior migrations):

- `ALTER TABLE public.items ADD COLUMN pdf_storage_path text NULL;`
- Add `presentations` to the constants list of categories that bypass URL-based thumbnailing in `src/lib/items.functions.ts` (code-only, no SQL).
- Create `presentations` storage bucket (private) via `supabase--storage_create_bucket`. RLS: only service role writes; signed URLs are used for reads, so no public policy needed.

Existing `presentations` rows (e.g. the CAFS '27 Google Slides link) are preserved — the kiosk falls back to opening `url` in the existing iframe/external viewer when `pdf_storage_path` is null, so nothing breaks. Admin shows them with an "External link (legacy)" badge and a "Replace with PDF" action.

## Files touched

- New: `src/routes/api/upload-presentation.ts`, `src/components/admin/PresentationUpload.tsx`, `src/components/mobile/PdfViewer.tsx`, migration for `pdf_storage_path`.
- Edited: `src/routes/admin.tsx` (conditional render for presentations category, delete also removes storage object), `src/components/mobile/MobileKiosk.tsx` (open `PdfViewer` for presentations with a `pdf_storage_path`), `src/lib/items.functions.ts` (skip presentations in thumbnail generation; `deleteItem` removes the PDF object when present).
- Dependencies: `bun add react-pdf pdfjs-dist`.

## Open question

The current `CAFS '27` row is a Google Slides URL, not a PDF. Should the migration:
1. Leave it as-is and just let the new uploader coexist (recommended), or
2. Delete legacy non-PDF presentation rows so the category is PDF-only?

I'll default to (1) unless you say otherwise.