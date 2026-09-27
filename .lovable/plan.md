# Cabinet influence curve for Chamber 02

## Recommendation
Add a shallow, full-width **Portfolio GDP exposure** chart between the chamber introduction and the accountability grid. It becomes the visual header for Chamber 02 while the existing table remains the detailed evidence layer.

Use “GDP exposure under portfolio influence” in the title and reserve “control” for supporting language. A minister does not literally control GDP, and the current percentages overlap because several ministries can share responsibility for the same sector.

## Visual treatment
- Sort all ministers from the lowest percentage at far left to the highest at far right.
- Draw one smooth ascending curve through every minister’s actual percentage.
- Fill beneath the curve with a restrained GDPVision semantic gradient: solid at the curve, fading vertically to **30% opacity** at the baseline.
- Keep the existing paper-and-ink palette; use one confident green signal color only for the curve, fill, active point, and highest value.
- Show exact percentages at every point. Use compact surnames or short minister names along the baseline, with full minister and portfolio names on focus or hover.
- Give the highest-exposure minister a stronger endpoint treatment without implying that the percentages total 100%.
- Add quiet scale guides and “Lower exposure” / “Higher exposure” end labels; avoid decorative totals or fabricated refresh dates.

## Interaction
- Hovering or keyboard-focusing a point highlights that minister and shows the full portfolio name, mapped sectors, exact GDP exposure, and the calculation basis.
- Clicking a point opens the existing ministerial dossier, matching the table action.
- The curve draws in once on entry; reduced-motion users receive the completed chart immediately.
- On smaller screens, retain the ascending curve in a horizontally scrollable plot with stable label spacing rather than compressing ten names into unreadable text.

## Data and trust
- Reuse the existing calculation already displayed in the **GDP owned** column: the sum of GDP shares for sectors mapped to each ministry.
- Add an **Explain this** rationale covering the calculation, shared-sector overlap, source coverage, and why values must not be added together.
- Show a concise caveat below the chart: “Portfolio exposures overlap where responsibility for a sector is shared.”
- If a ministry has no mapped GDP share, keep it at the left as “Not measured” and visually distinguish it from a true 0%.

## Implementation scope
- Build a focused responsive SVG chart component and place it above the Cabinet accountability grid.
- Derive the plotted points from the page’s existing ministry, sector, minister, and GDP-share data; no database changes or AI generation.
- Use semantic chart tokens in the existing design system, not hardcoded component colors.
- Preserve the ministry rail, table, sorting by delivery risk, routes, and all existing chamber behavior.
- Verify desktop and mobile layouts, pointer and keyboard access, dossier navigation, reduced motion, and the current build checks.
