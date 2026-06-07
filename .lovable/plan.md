## Plan

The presentation viewer is not failing inside React anymore; the browser is refusing to inline-render the proxied PDF. The network log shows the iframe request to `/api/presentation-pdf?...` ends as `net::ERR_ABORTED`, and Chrome falls back to its generic file tile with an **Open** button instead of displaying pages.

## What I’ll change

1. **Stop relying on Chrome’s native PDF plugin inside the kiosk iframe**
   - Replace the current native `<iframe>` PDF embed in `PdfViewer.tsx`.
   - Use a bundled viewer page instead, so the PDF is rendered inside our app rather than by the browser’s file-preview fallback.

2. **Add a dedicated PDF.js viewer route**
   - Create a client-only route like `/pdf-viewer` that loads PDF.js only in the browser.
   - Fetch the same `/api/presentation-pdf?path=...` URL and render pages into a scrollable presentation surface.
   - This keeps PDF.js out of SSR and avoids the previous SSR failures.

3. **Make the kiosk iframe point to the viewer route**
   - `PdfViewer.tsx` will embed `/pdf-viewer?path=...&label=...` instead of embedding the raw PDF file.
   - Keep the dark full-screen kiosk styling and current fallback actions.

4. **Improve loading/error detection**
   - Add an iframe-to-parent `postMessage` handshake so the kiosk can distinguish “viewer loaded” from “PDF render failed”.
   - If the PDF fetch/render fails, show the existing retry/open fallback instead of an indefinite blank/loading screen.

5. **Verify the exact reported case**
   - Open the preview, select **Presentations → CEIS '27**, and confirm the viewer no longer shows the generic PDF tile/blank screen.
   - Check the network request for `/api/presentation-pdf` and browser console for render errors.