## Plan: bulletproof presentation PDF viewing

### What I found
- The current viewer is only using the browser’s native `<object>/<iframe>` PDF support, which is inconsistent across browsers and mobile devices and commonly shows a blank/light screen.
- Recent server logs show the previous stale route error is no longer active after restart; the current issue is viewer/rendering reliability, not that same route-tree crash.
- The app already has a safe same-origin PDF proxy at `/api/public/presentation-pdf`, so a third-party viewer can load PDFs without cross-origin storage problems.

### Recommended viewer
Use **`pdfjs-viewer-element`** as the primary viewer.

Why this is the best next option:
- It is a third-party package that wraps Mozilla’s full PDF.js default web viewer, not a hand-rolled canvas renderer.
- It runs isolated in its own iframe/web component, reducing React/CSS/layout interference.
- It supports the full PDF.js viewer experience: paging, zooming, search, page fitting, and multi-page rendering.
- It avoids relying on the browser’s native PDF plugin, which is likely the reason for the blank screen.
- It can use the existing same-origin PDF proxy URL, so we do not need to expose storage URLs or change the upload flow.

### Implementation steps
1. **Install the new viewer dependency**
   - Add `pdfjs-viewer-element`.
   - Keep existing PDF dependencies for now until the replacement is verified, since upload thumbnail generation still uses `react-pdf`/`pdfjs-dist`.

2. **Replace `PdfViewer.tsx`**
   - Remove the native `<object>/<iframe>` implementation.
   - Render the `pdfjs-viewer-element` web component as the primary PDF viewer.
   - Configure it with the proxied PDF URL:
     - `/api/public/presentation-pdf?path=<pdf_storage_path>` for uploaded presentations.
     - fallback to `url` when no storage path exists.
   - Set sane defaults: fit-to-page/width, full-height layout, iframe title, and reload behavior when the active presentation changes.

3. **Add robust fallback states**
   - Show a clear loading state while the viewer initializes.
   - Detect viewer load errors where the component exposes them.
   - Keep an “Open PDF” fallback action so the user is never trapped on a blank screen.
   - Add a retry button that remounts the viewer cleanly.

4. **Harden the PDF proxy route**
   - Keep the route at `/api/public/presentation-pdf`.
   - Add `Accept-Ranges: bytes` and stronger PDF-serving headers if needed, because many PDF viewers expect range-friendly responses for page-by-page loading.
   - Keep validation for `pdf_storage_path` and keep responses inline as `application/pdf`.

5. **Verify in preview**
   - Open a presentation from the kiosk/mobile presentation flow.
   - Confirm the viewer no longer displays a blank/light screen.
   - Confirm multiple slides/pages render correctly, not just the first page.
   - Check browser console and network requests for viewer asset or PDF loading failures.

### Backup option if this still fails
If `pdfjs-viewer-element` does not behave correctly in this environment, the next viable option is **Apryse WebViewer** or **Nutrient Web SDK**. Those are enterprise-grade viewers, but they may require licensing. I would only move there after trying the isolated PDF.js web viewer because `pdfjs-viewer-element` is lighter, self-contained, and better aligned with this app’s current stack.