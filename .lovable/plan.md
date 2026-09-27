# Concentration curve: clean labels and hover explanations

## Problem
- The sector names along the bottom are cut short ("manufactu", "agricultu") and crowd each other.
- The dots, the "50% in 3" / "80% in 6" markers, the dashed diagonal and the percentage scale have no explanation when you point at them. Only the dots show a plain browser tooltip, which is slow and small.

## Approach
A single explanation card that follows what you're pointing at. It's the same idea as the "What this means" panel used elsewhere in the platform, but lighter and instant (no 2-second wait), because it describes one chart point.

### Hover targets and what they show
- **Each sector (dot, its column, or its label):** hovering anywhere in a sector's column counts, so you don't have to aim at a small dot. The card shows:
  - Rank and name, e.g. "#4 Financial services"
  - Its share of GDP: "10.0%"
  - Running total: "65.0% of GDP covered by the top 4"
  - How it compares with an even split: "10.0% vs 9.1% if all 11 sectors were equal"
  - "Click to open the sector page"
- **50% and 80% markers:** "Half of GDP comes from just 3 of 11 sectors (Tourism, Other services, Real estate)." Includes one line on what that means for exposure to a shock.
- **Dashed diagonal:** "A perfectly even economy would follow this line. The wider the gold area above it, the more concentrated the economy."
- **Scale labels (0–100%):** "Cumulative share of GDP."

### Readability fixes
- Pointing at a sector draws a thin guide line from the dot down to its label, highlights that label and dims the others.
- Bottom labels: use short full names ("Tourism", "Manufacturing", "Agriculture"). When space is tight, tilt them slightly; with more than 12 sectors, show only rank numbers.
- Marker labels move above the curve with a light backing so they never sit on the line.

### Card behaviour
- Sits beside the pointer and flips side near the edges so it never covers the point being read.
- Keyboard: arrow keys step through sectors, and the card follows.
- Touch: tap shows the card, tap again opens the sector.
- Bars and Treemap get the same card, replacing their plain browser tooltips.

## Technical details
- `ConcentrationViews.tsx`: add a `ChartTip` (absolutely positioned inside a relative wrapper; position computed from the SVG point via `getScreenCTM`). Shared `hover` state is extended to `{ kind: "sector" | "marker" | "diagonal" | "axis", id }`.
- Curve: invisible full-height `<rect>` hit zones per sector column. Label via a `shortLabel()` helper (first word, or a small map for multi-word sectors). Tilt labels -30° when `n > 8`.
- Remove the native `<title>` tooltips. Keep `aria-label` on the hit zones for screen readers.
- No data or server changes.
