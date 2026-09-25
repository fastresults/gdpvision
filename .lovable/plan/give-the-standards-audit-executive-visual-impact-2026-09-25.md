# Give the Standards Audit executive visual impact

## Recommendation

Build a compact **Audit Pulse** above the existing tabs and requirement table. The page already has the right source measures—coverage, impact-weighted score, five status counts, per-standard scores, and monthly snapshots—but they are presented mostly as numbers and small cards.

The best visual hierarchy is:

1. **Two-ring audit gauge** — concentric radial arcs for plain coverage and impact-weighted readiness. This becomes the page's focal point without pretending the two scores are interchangeable.
2. **12-month momentum chart** — a gradient area line for the weighted score, with the raw monthly line plus a three-month moving average once at least three snapshots exist. Show the latest change and direction beside it.
3. **Gap composition rail** — one proportional horizontal bar showing collected, partial, stale, planned, and missing requirements. This is more statistically honest and easier to compare than five separate radial charts.
4. **Standards readiness ranking** — replace the visually flat standards card row with compact horizontal bullet charts, sorted by impact-weighted readiness. Selecting a standard still filters the table.
5. **Priority gap matrix** — a small heatmap crossing impact level with status, immediately revealing high-impact missing or stale requirements. Clicking a cell filters the gap register.

## Executive perspective

Every chart and measure will support the established two-second dwell interaction:

- Hover or keyboard focus opens one shared, centered **Executive perspective** panel.
- The panel explains the headline, direction, strongest and weakest standards, high-impact exposure, and data limitations.
- Moving to another measure replaces the perspective; click/tap pins it; Escape closes it.
- All copy is calculated from the loaded audit data, not generated live by AI.

## Visual direction

- Use restrained semantic gradients: positive progress, gold attention, and negative exposure—not decorative rainbow gradients.
- Keep the paper-and-ink GDPVision style, with gradients limited to chart fills and active traces.
- Use subtle draw-in animation for arcs and lines, while respecting reduced-motion settings.
- Keep exact values, labels, and status meaning visible; color is never the only indicator.
- On mobile, stack the radial pulse above the trend and turn the perspective panel into a bottom sheet.

## Implementation

- Create focused SVG chart components using the existing audit response; no new database tables or data collection are required.
- Extend the current summary area rather than placing charts in nested cards.
- Preserve the existing tabs, filters, approval workflow, collection-plan sheet, and requirement table.
- Register Explain rationales for the radial score, moving average, composition percentages, ranking, and priority matrix.
- Make chart selections update the existing standard/status/impact filters so every visual leads directly to the underlying requirements.
- Diagnose and resolve the current blank rendering state before visual verification, then test the page at desktop and mobile sizes.

## Guardrails

- Do not show a moving average with fewer than three monthly snapshots.
- Do not fabricate trend history; show a clear first-period state when history is insufficient.
- Do not use radial charts for individual standards or status counts; those comparisons belong on common linear scales.
- Preserve exact audit scoring rules and governance behavior.
