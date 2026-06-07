## Plan: replace the current PDF canvas renderer with a native embedded PDF viewer

The current presentation viewer still relies on `react-pdf` / pdf.js rendering each page into a canvas. The blank/solid-color pages are consistent with pdf.js failing to paint embedded image layers in some of these presentation PDFs. A native browser PDF renderer is a better fit here because it uses the browser’s built-in PDF engine instead of the app’s JavaScript canvas renderer.

## What I’ll change

1. **Replace the front-facing presentation renderer**
   - Refactor `src/components/mobile/PdfViewer.tsx` so it no longer uses `react-pdf`, `<Document>`, or `<Page>` for the kiosk presentation display.
   - Render the uploaded PDF URL through a native embedded PDF surface, using an `<iframe>` / `<object>` style viewer.
   - Keep the existing full-screen layout, dark background, and app chrome so it still feels integrated with the kiosk.

2. **Use a clean embedded PDF URL**
   - Pass the signed PDF URL directly to the embedded viewer.
   - Add PDF URL fragments where supported, such as hiding native toolbar controls if the browser honors them.
   - Avoid re-processing the PDF bytes in JavaScript, which is the source of the blank image-layer issue.

3. **Add graceful fallbacks**
   - If the browser refuses to embed the PDF, show a polished fallback with:
     - presentation name
     - “Open PDF” action
     - retry/reload action
   - Keep the existing external-open button in the kiosk header.

4. **Keep upload/admin thumbnail generation separate**
   - Leave `PresentationUpload.tsx` thumbnail generation alone for now, because the reported issue is the front-facing viewing experience, not upload storage.
   - If thumbnails later show blank too, we can separately change thumbnail rendering to a different strategy.

5. **Clean up unused viewer dependencies if safe**
   - Once the front-facing viewer no longer imports `react-pdf`, remove unused imports from `PdfViewer.tsx`.
   - Keep `react-pdf`/`pdfjs-dist` installed if admin upload thumbnail generation still depends on them.

6. **Verify the exact workflow**
   - Open the kiosk.
   - Switch to the **Presentations** category, not the Websites category.
   - Select the affected presentation.
   - Confirm page 4 of 15 renders as an actual PDF page instead of a blank/solid blue canvas.
   - Check console logs for absence of pdf.js image warnings from the front-facing viewer.

## Technical notes

- This is a viewer swap, not a database or upload change.
- The strongest fix is to stop using pdf.js canvas rendering for the presentation display, because these PDFs appear to contain image-heavy/vector-heavy slide content that pdf.js is not painting reliably in the current setup.
- Native embedded rendering trades custom page/zoom controls for reliability. The browser’s own PDF controls handle scrolling, zooming, and page navigation.

## Files expected to change

- `src/components/mobile/PdfViewer.tsx`

Possibly no other files are needed because both desktop and mobile already route presentations through this component.