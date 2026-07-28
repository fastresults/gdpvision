# Mobile optimisation — public pages

Measured at 390×844 in a real mobile context. Findings, then fixes.

## What is actually broken

1. **The home page scrolls sideways.** Document scroll width is **504px against a 390px viewport**. Cause: `<SignatureRing size={480} />` in the hero renders a fixed 480px SVG inside a grid cell with no clamp, so every element in the hero column reports as overflowing. This is the single worst defect — the whole page can be dragged off-screen.
2. **Mobile gets no illustrations at all.** Every marginalia illustration on the home page is `hidden md:block` (moment, corpus, loop, and the aside slots). The house style that defines the brand disappears entirely below 768px.
3. **Business case comparison table overflows** its container (`<table class="w-full">` with three prose columns at 390px).
4. **Op-ed gate form** — label/input pair overflows the viewport slightly.
5. **Typography does not step down.** Hero H1 is `text-[43px]` at 390px (roughly 4 words per line, 4 lines deep). Business-case H1 is `text-[40px]`. Section padding is `py-24` at every breakpoint on several sections — 96px of dead space between blocks on a phone.
6. **Touch targets.** Prev/Next carousel controls in hero and "The moment" are ~20px tall text rows with 44px arrow glyphs; below the 44×44 minimum. The mobile menu rows are fine.

## The plan

### A. Kill the overflow (highest priority)
- Make `SignatureRing` responsive: drive its size from a container-relative wrapper (`w-full max-w-[480px] mx-auto`) and let the SVG scale via `viewBox` + `w-full h-auto` instead of a hard pixel `size`. Keep 480px as the desktop cap.
- Add a defensive `overflow-x-hidden` on the marketing shell root so no future asset can drag the page.
- Re-measure `scrollWidth === clientWidth` at 320 / 390 / 430px on all five public routes.

### B. Restore illustrations on mobile
Replace `hidden md:block` with a mobile-appropriate placement rather than deletion, per the illustration contract (marginalia, one per section, never full-bleed):
- "The moment": show the threat illustration **above** the section header on mobile at `spot` scale, centred, so the carousel art still changes per threat.
- Corpus / loop / counsel / sovereignty asides: render at `spot` width, centred, between the header and the card stack.
- Provenance `rule` divider already fluid — keep.

### C. Responsive type + rhythm scale
- Hero H1: `text-[32px]` → `sm:text-[43px]` → `md:text-[68px]`.
- Business-case H1: `text-[30px]` → `sm:text-[40px]` → `md:text-[56px]`.
- Body/lede: `text-[15px]` base, `md:text-[17px]` (already partly done, apply consistently).
- Section padding: `py-14 sm:py-20 md:py-32` in place of the flat `py-24 md:py-32`.
- Horizontal gutter: `px-5` on mobile instead of `px-6` to buy back reading width.

### D. Tables and dense blocks
- Business case comparison table: on mobile, render the same rows as a **stacked definition list** (test / chat / instrument as labelled rows in a bordered card), table only from `md:` up. No horizontal scroll shims.
- Number tiles and chamber grids: verify single-column stacking and that `ChamberPanel`'s `min-h-[240px]` plus 130px inline mark doesn't crush the title at 320px — drop the mark to `w-[104px]` on mobile.

### E. Touch targets and controls
- Carousel Prev/Next: give both buttons `min-h-[44px] px-2 -mx-2` hit areas; shrink the 44px arrow rules to 28px on mobile so the label stays on one line.
- Hero CTA row: make "Request a Cabinet briefing" full-width on mobile, secondary link below it as its own 44px row.
- Op-ed gate form: full-width inputs with `text-base` (prevents iOS zoom-on-focus, which needs ≥16px), fix the overflowing label/input pair.

### F. Verification
Playwright pass at 320 / 390 / 430px across `/`, `/business-case`, `/op-eds`, `/op-eds/$slug`, `/auth`:
- assert `scrollWidth === clientWidth` on every route,
- assert no element extends past the viewport,
- screenshot each for a visual review,
- exercise the mobile menu and the two carousels by touch.

## Scope
Presentation only — Tailwind classes and the `SignatureRing` sizing prop. No copy changes, no data or server-function changes, no desktop layout regressions (every change is a mobile-first base with the current values restored at `md:`).
