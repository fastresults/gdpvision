## What went wrong

The screenshot is not a layout bug in the briefing or the deck — it is two print documents printed on top of each other.

Confirmed by reading the code:

- `BriefingPanel.tsx` renders **both** `<PrintableBriefing>` and `<DeckModal>` as siblings (lines 340-344). `DeckModal` renders its `#deck-print-root` plus its `<style>` block whenever a deck exists and is open.
- `PrintableBriefing.tsx` (lines 179-181) declares `body * { visibility: hidden !important }` then `#briefing-print-root, #briefing-print-root * { visibility: visible !important }`.
- `DeckModal.tsx` (lines 244-246) declares the *identical* pair for `#deck-print-root`.

Each stylesheet hides everything and then force-shows its own root with `!important`. Neither can hide the other's root, because the other root's `visible !important` wins over a plain `body *` selector of equal specificity declared earlier/later. Both roots are `position: absolute; inset: 0`, so they stack on the same coordinates — exactly the shredded overlay in the screenshot.

Two more compounding faults:

- **`@page` collision.** Briefing declares `size: Letter` portrait with running headers; the deck declares `size: 1920px 1080px landscape; margin: 0`. `@page` is document-global, so the last one parsed wins and both documents paginate against the wrong sheet.
- **Same class of bug is latent elsewhere.** `PrintableValueCase.tsx` and `mandate-compact/PrintablePlan.tsx` use the same `body *` hide-and-force-show pattern. Any future screen that mounts two of them repeats this failure.

## The fix: one print surface at a time

### 1. Add a shared print-surface primitive

New `src/components/print/PrintSurface.tsx` + `print-surface.css` rules in `src/styles.css`:

- A tiny module-level registry with `beginPrint(surfaceId)` / `endPrint()`.
- On `window.print()`, the caller sets `document.documentElement.dataset.printing = surfaceId`.
- Base print CSS (global, declared once): every `[data-print-root]` is `display: none !important`, and only `html[data-printing="X"] [data-print-root="X"]` is `display: block !important`.
- Switch from `visibility` to `display`. `visibility: hidden` keeps layout boxes, which is why fragments still bled through; `display: none` removes them entirely.
- Hide the app shell with `html[data-printing] body > *:not(#print-portal) { display: none !important }` rather than `body *`.

### 2. Scope `@page` per surface

Only one surface can be printing, so its page box must be the only one active. Since `@page` cannot be conditioned on an attribute, inject the surface's `@page` rule dynamically: each printable component exposes its page CSS as a string, and `beginPrint` writes it into a single `<style id="print-page-rule">` node, removing it in `endPrint`. That guarantees Letter portrait for the briefing and 1920×1080 landscape for the deck, never both.

### 3. Rewire the four existing printables

- `PrintableBriefing.tsx` → `data-print-root="briefing"`, page rule extracted, `visibility` rules deleted.
- `DeckModal.tsx` → `data-print-root="deck"`, page rule extracted, `visibility` rules deleted; its `printDeck()` calls `beginPrint("deck")` → `window.print()` → `endPrint()` on `afterprint`.
- `PrintableValueCase.tsx` and `mandate-compact/plan/PrintablePlan.tsx` → same conversion, so the pattern is uniform and cannot regress.

### 4. Also close the modal-chrome leak

`BriefingModal` and `DeckModal` overlay chrome will be removed from print by the `body > *:not(#print-portal)` rule, so headers, buttons and the scroll container stop appearing on the sheet.

### 5. Verification before hand-off

- Playwright with Chromium `page.pdf()` (which honours `@media print`) against the live route with (a) briefing modal open only, (b) deck open on top of the briefing, (c) deck fullscreen — render each PDF to images and inspect every page for overlap, clipped text, and correct sheet size.
- Confirm the briefing prints Letter portrait with running footers and the deck prints one 16:9 page per slide, with no overlap in either case.

## Technical notes

No backend, schema, or AI changes. Files touched: new `src/components/print/PrintSurface.tsx`, `src/styles.css` (one global print block), `PrintableBriefing.tsx`, `DeckModal.tsx`, `PrintableValueCase.tsx`, `mandate-compact/plan/PrintablePlan.tsx`, and the two call sites that trigger `window.print()`.
