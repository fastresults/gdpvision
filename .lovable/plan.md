# Fix PDF Presentation Viewer

## What's broken

I opened CEIS '27 in the preview. The PDF file is downloaded successfully from Supabase (200 OK, 2 MB, CORS allowed), but the viewer never moves past "Loading PDF…". No `pdf.worker.min.mjs` request is ever made — meaning pdfjs's web worker fails to start, so `getDocument()` hangs and `onLoadSuccess` never fires. There is also a latent version mismatch: the project pins `pdfjs-dist@^6.0.227` at the top level while `react-pdf@10.4.1` requires `pdfjs-dist@5.4.296`. Loading the worker from `unpkg.com` based on `pdfjs.version` makes this fragile (CDN flakiness, version skew, occasional CORS issues for module workers).

There's also no zoom, no fit-to-page, no error UI beyond a string, and no loading spinner — so even when it works, it doesn't feel elegant.

## Fix

### 1. Serve the pdfjs worker locally via Vite

Replace the CDN worker URL with a Vite-bundled worker that's guaranteed to match the installed pdfjs version, in both `src/components/mobile/PdfViewer.tsx` and `src/components/admin/PresentationUpload.tsx`:

```ts
import { pdfjs } from "react-pdf";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
```

This removes the unpkg dependency, eliminates CORS/version-skew failure modes, and the worker is requested from the same origin so the browser actually starts it.

### 2. Align `pdfjs-dist` with what `react-pdf` ships

Pin `pdfjs-dist` to `5.4.296` (what `react-pdf@10` peer-depends on) so the `?url` import resolves the same build that react-pdf calls into. This prevents subtle parsing differences between the worker and the main-thread API.

### 3. Make the viewer feel polished

Rework `src/components/mobile/PdfViewer.tsx`:

- Real loading state: centered spinner + "Loading presentation…" instead of bare text.
- Clear error state with a Retry button (calls `setReloadKey(k => k + 1)` to remount `Document`).
- Fit-to-width by default, plus zoom controls (`−` / `100%` / `+`) and a "Fit width" reset. Cap zoom 50–250%.
- Smooth scroll-to-top on page change.
- Keyboard shortcuts: `←` / `→` for page nav, `+` / `−` for zoom (only when viewer is mounted).
- Disable text/annotation layers (already done) for speed; keep `renderMode="canvas"`.
- Replace the `#111` hardcode with `var(--eyeframe-bg)` so it matches the kiosk theme.
- Page indicator stays at the bottom bar; add subtle border + safe-area padding for mobile.

### 4. Robust `Document` props

Pass `options` once (memoized) including `cMapUrl`, `cMapPacked: true`, `standardFontDataUrl` — pointing at same-origin Vite-bundled assets:

```ts
import cMapUrl from "pdfjs-dist/cmaps/?url"; // or use new URL(...) pattern
```

If `?url` on a directory isn't supported, fall back to the unpkg URLs for cmaps/fonts only (these are optional assets; missing them just falls back to default fonts, not a hang). The worker MUST be local; cmaps can stay remote.

### 5. Surface failures during PDF parsing

In `onLoadError`, log to console and show the actual `error.message` plus the file label, so when a future upload is corrupt we see why immediately instead of staring at "Loading PDF…".

## Files touched

- `src/components/mobile/PdfViewer.tsx` — rewrite with bundled worker, zoom, error/retry, theme tokens, keyboard nav.
- `src/components/admin/PresentationUpload.tsx` — switch to the bundled worker URL (same one-line change) so admin thumbnail generation also stops depending on unpkg.
- `package.json` — pin `pdfjs-dist` to `5.4.296` to match `react-pdf@10`'s peer.

## Verification

1. Open `/` → Presentations → CEIS '27 in preview. PDF should render the first page within ~1 s.
2. Network panel should show a `pdf.worker.min.mjs` request from the lovableproject origin (not unpkg).
3. Page next/prev, zoom in/out, fit-to-width all work; mobile and desktop both render the same component.
4. Upload a fresh PDF in `/admin` — admin thumbnail generation still works (uses the same worker path).

## Out of scope

- Pinch-to-zoom gestures on mobile (browser pinch-zoom on the page still works; in-component pinch can be a follow-up).
- Continuous scroll of all pages at once (current paginated viewer is faster for large decks).
