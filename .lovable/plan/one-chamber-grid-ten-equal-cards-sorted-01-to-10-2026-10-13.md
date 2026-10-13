# One chamber grid: ten equal cards, sorted 01 to 10

## What changes on the page

The "Ten Chambers" section on the homepage currently opens with two wide cards — Chamber 04 and Chamber 08 — sitting side by side in a two-column row, each with a gold tag above it, and the other eight chambers follow in a three-across grid.

After this change there is one grid of ten identical cards, three across on a desktop screen, reading Chamber 01 through Chamber 10 with no featured row and no gold tags.

- Every card is the same width and height as today's lower cards.
- Order is strictly 01, 02, 03, 04, 05, 06, 07, 08, 09, 10.
- The gold lines "04 → Where the revenue cliff is priced" and "08 → Where the manifesto becomes a delivery plan" are removed.
- Everything inside each card stays exactly as it is now: the coloured 4px rule, the chamber number in its own colour, the title, the outcome line, the purpose, the bullets, the hover zoom on the picture, and the per-country value estimate.
- On a tablet the cards sit two across; on a phone they stack one under another, as they do now.

The last desktop row holds Chamber 10 on its own — the unavoidable result of ten cards three across, and consistent with keeping every card the same size.

## How it is built

One file changes: `src/components/marketing/MarketingHome.tsx`.

1. Delete the featured/grid split (lines 59-69): `FEATURE_LABELS`, `FEATURED_CHAMBERS` and `GRID_CHAMBERS`. Nothing outside this file uses them.
2. Replace the two grid blocks (lines 465-489) with a single grid that maps over `CHAMBERS` — the list in `src/lib/chambers.ts`, already in numeric order 01-10, so no sorting code is needed.
3. The new grid reuses the exact classes of today's lower grid (`gap-x-8 gap-y-6`, `md:grid-cols-2 lg:grid-cols-3`) so chambers 04 and 08 render at the same width and with the same gutters as the cards they now sit beside.
4. The country picker and its "All ten Chamber values update together" note, and the `ExplainProvider` that supplies the value estimates, stay in place and wrap the single grid.

No changes to `src/lib/chambers.ts`, `src/components/marketing/ChamberPanel.tsx`, styles, or any data.

## Verification

- Load the homepage and read the ten chamber headings in DOM order: they must come back 01 to 10.
- Measure every card's box: all ten widths identical; the two former featured cards no longer wider or taller than their neighbours.
- Confirm no horizontal overflow at desktop, tablet and phone widths, and that the value estimate still updates when a country is chosen.
- Check the latest build result is clean.
