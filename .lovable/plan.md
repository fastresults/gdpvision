# Forensic findings: blank images in PDF presentations

## What's actually happening

The PDF text and vector shapes render correctly, but embedded raster images come out blank. The console confirms the cause:

```
Warning: Dependent image isn't ready yet
  at _CanvasGraphics.paintImageXObject (react-pdf.js)
  at _CanvasGraphics.executeOperatorList
```

This is a well-known pdf.js symptom. When `paintImageXObject` runs and its image stream hasn't finished decoding, pdf.js skips that image and continues painting everything else — so the page looks "fine" except images are missing/blank.

The image stream gets dropped because the **render task is being canceled and restarted while images are still being decoded**. The trigger in `PdfViewer.tsx` is the `width` prop on `<Page>`:

1. On mount, `baseWidth` is `undefined`, so `<Page>` renders at the pdfjs default width and kicks off image decoding.
2. `ResizeObserver` fires immediately after layout, setting `baseWidth` to the real container width.
3. React re-renders `<Page>` with a new `width`. react-pdf cancels the in-flight render task; the image XObjects that were mid-decode are discarded.
4. The second render reuses the cached operator list but the dependent image objects are gone → `paintImageXObject` → "Dependent image isn't ready yet" → blank.

This also fires again any time the container size changes (orientation, zoom, sidebar opening, etc.).

## Plan

Scope: `src/components/mobile/PdfViewer.tsx` only. No business logic, no schema, no upload changes.

1. **Don't render `<Page>` until we know the width.** Gate the `<Page>` element on `baseWidth !== undefined`. Show the existing spinner until layout has been measured once. This eliminates the first-render-then-resize race that's causing the blank images on initial open.

2. **Measure width synchronously before paint.** Switch the measurement effect from `useEffect` to `useLayoutEffect` and round the width to an integer. This guarantees `baseWidth` is set in the same commit as the first `<Page>` render and prevents sub-pixel ResizeObserver thrash from triggering re-renders.

3. **Debounce/quantize ResizeObserver updates.** Only call `setBaseWidth` when the new integer width actually differs from the current one. Pdfjs treats every width change as "re-render the whole page", so suppressing no-op changes prevents mid-decode cancellations during scroll/zoom.

4. **Keep `renderTextLayer={false}` and `renderAnnotationLayer={false}`** — they are not the cause and removing them would slow rendering. The fix is purely about not interrupting the canvas render task.

5. **Verification.** After the change, open a presentation (e.g. CEIS '27), confirm:
   - No "Dependent image isn't ready yet" warnings in the console.
   - All page images visible on first open and after page navigation.
   - Resizing the window or rotating doesn't blank images on subsequent pages.

## Out of scope

- No change to upload, storage, signed URLs, or thumbnail generation — the bytes on disk are fine; this is purely a viewer-side render race.
- No pdfjs/react-pdf version changes; current pinned versions are correct.
