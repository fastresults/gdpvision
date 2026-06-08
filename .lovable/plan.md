## Plan

Replace the current custom canvas renderer with the previously tried official PDF.js web viewer approach, using the existing same-origin `/api/public/presentation-pdf` proxy so uploaded presentation PDFs are loaded from a stable app URL.

## Changes

1. **Update `PdfViewer.tsx`**
   - Remove the hand-written `pdfjs.getDocument()` page-by-page canvas rendering.
   - Render the PDF through PDF.js’ packaged viewer UI instead.
   - Keep the existing public proxy URL logic for `pdf_storage_path`.
   - Preserve loading/error fallback controls and an “Open PDF” fallback link.

2. **Keep the public PDF proxy**
   - Leave `src/routes/api/public/presentation-pdf.ts` in place.
   - Do not recreate the old `/api/presentation-pdf` route, since that caused stale route/auth redirect issues.

3. **Verify the route tree issue stays fixed**
   - Confirm generated routing no longer references `src/routes/api/presentation-pdf.ts`.
   - If the dev server still has stale module references, restart it after the code change.

4. **Validate in preview**
   - Open a presentation PDF in the kiosk flow.
   - Check that the viewer loads without a blank white screen and that later pages render rather than showing solid-color/blank pages.