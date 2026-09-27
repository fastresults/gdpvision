# Concentration map: three chart views with a toggle

The single coloured strip on the FDI Studio Macro board has no labels, so the smaller sectors can't be read. It will become a panel with three views, switched with one control. Every view uses the same sector colours, and clicking a sector still opens its sector page.

## The three views (recommended)

1. **Ranked bars (default).** Horizontal bars, largest to smallest. Each bar shows the sector name, its share of GDP and its value. It's the easiest view for reading exact sizes, and small sectors stay visible and labelled.
2. **Treemap.** Tiles sized by share of GDP, labelled inside when they fit and by hover otherwise. It shows the "whole economy" shape at a glance. This replaces the strip and does the same job better.
3. **Concentration curve.** A cumulative line: sectors ordered largest first, rising to 100%. A faint diagonal marks a perfectly even economy, and the gold-to-30% gradient fill matches the Portfolio chart. Markers show how many sectors make up 50% and 80% of GDP. This view explains the HHI and Top-1 numbers in the Peer benchmark table.

## Toggle and behaviour
- A small segmented control sits in the section header: **Bars · Treemap · Curve**.
- The chosen view is saved in the page address, so refresh, Back and shared links keep it.
- Hovering a sector highlights it the same way in every view. Clicking opens that sector's page.
- A one-line reading under the chart, taken from the data. For example: "Top sector: Tourism 30% · 3 sectors make up 80% of GDP · HHI 0.154".
- Short "What this means" explanations cover the curve's 50% and 80% markers and HHI.
- Works on small screens: bars stack full-width, the treemap keeps its proportions, and the curve scrolls sideways if needed.

## Technical details
- New `src/components/studio/ConcentrationViews.tsx`: `ConcentrationPanel({ code, sectors, hhi })` with `RankedBars`, `Treemap` (a simple squarified layout computed in the file, drawn as SVG) and `ConcentrationCurve` (SVG with a linearGradient from gold-500 at full to 30% opacity).
- View state: `useUrlState("cview", "bars", { allowed: ["bars","treemap","curve"], replace: true })`.
- Colours come from the existing `sectorColor(hue_token, i)`. No new colour tokens. Buttons use the `btn-ghost` / active pattern.
- New rationales `fdi.concentration-curve` and `fdi.hhi`, added to the matching explain entries file for the FDI studio.
- `MacroFdiBoard.tsx`: replace lines 145–170 with `<ConcentrationPanel …/>`. No change to the data or server code.
