## What's wrong

The deck print sheet is declared in pixels:

```css
@page { size: 1920px 1080px landscape; margin: 0; }
```

Chrome does not accept a pixel page size of that magnitude — it falls back to the default sheet, which is why the print dialog shows **Layout: Portrait** and offers no way to correct it. The slide itself is still laid out at a hard `width: 1920px; height: 1080px`, so each slide is cropped at the right edge (the headline is cut mid-word) and spills a blank second page — 10 slides printing as 11 pages.

Two independent defects, both must be fixed:
1. the sheet is the wrong shape and orientation;
2. the slide is never scaled down to whatever sheet it lands on.

## The fix

### 1. Declare the sheet in physical units

In `DeckModal.tsx`, replace the pixel page rule with a real 16:9 landscape sheet:

```text
@page { size: 13.333in 7.5in; margin: 0 }
```

That is the exact PowerPoint 16:9 widescreen sheet, so the printed PDF matches the `.pptx` export page-for-page. Browsers honour inch/mm page sizes, and the dialog will report Landscape without the user touching anything.

### 2. Scale the slide into the sheet instead of overflowing it

Each `.deck-print-page` becomes a fixed 1280×720 CSS-px box (13.333in × 7.5in at 96dpi) containing the untouched 1920×1080 `SlideBody`, scaled by `transform: scale(0.666667)` with `transform-origin: top left`. Nothing about slide authoring changes — the same pixels that appear on screen and in Present mode land on the page, just uniformly reduced. `overflow: hidden` plus `break-after: page` on every page except the last gives exactly one page per slide.

### 3. Force background fidelity

Cover and closing slides are ink-dark. Add `print-color-adjust: exact` (with the `-webkit-` prefix) to the print root so browsers don't strip the dark ground in "simplified" print paths.

### 4. Guard the page count

Add `break-inside: avoid` on the page box and reset any inherited margin/padding inside the print portal, so a stray margin cannot push a slide onto a second sheet.

## Verification

Drive the deck route in a headless browser, print to PDF via the DevTools protocol, and confirm with `pdfinfo`/`pdftoppm`:
- page size reads ~960×540pt (13.333in × 7.5in) in landscape;
- page count equals slide count exactly — no trailing blank;
- render page 1 to an image and confirm the headline is complete and the dark ground is present.

## Files touched

- `src/components/personas/field/deck/DeckModal.tsx` — `PAGE_CSS` sheet size, `PRINT_CSS` page box + scale wrapper.
- `src/components/personas/field/deck/SlideCanvas.tsx` — small print wrapper export if the scale wrapper is cleaner co-located with the slide (no change to `SlideBody` itself).
