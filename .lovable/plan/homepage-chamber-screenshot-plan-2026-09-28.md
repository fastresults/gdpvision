# Homepage chamber screenshot plan

## Recommended treatment
Use ten **real, curated product captures** from a single demonstration country. Each image becomes a quiet 16:9 “evidence plate” inside its chamber card: no browser chrome, no marketing labels over the image, a fine frame, modest rounded corners, and the chamber’s existing graphite illustration left exactly where it is.

A static captured image is preferable to a live embedded page: it loads quickly, cannot expose restricted information, stays visually composed, and remains reliable when a chamber or session is unavailable.

## What will be built
- Add one 16:9 screenshot field for every chamber and retain the current illustration field separately.
- Capture a representative, visually strong state for all ten chambers:
  1. National Ledger — KPI/trend and evidence view
  2. Portfolio Workspaces — minister GDP-exposure curve and accountability grid
  3. Scenario Engine — GDP fan chart with policy levers
  4. FDI Transition Studio — multi-view concentration or transition analysis
  5. Narrative Chamber — signal triage and strategic response view
  6. Cabinet Room — situation board and decision queue
  7. Persona Lab — research programme, evidence, and briefing progress
  8. Mandate Compact — mandate-to-delivery stepper and compact summary
  9. Digital Government Studio — PRD sections, evidence, and approval state
  10. Sector Studio — “Plan at a glance” trajectory and delivery summary
- Use one sanitized demonstration-country session and remove names, private documents, email addresses, IDs, and restricted records from every capture.
- Crop each view around its strongest visual rather than shrinking an entire dashboard into unreadable miniature text.
- Export consistent high-density 16:9 assets, optimized for fast homepage loading.
- Place each screenshot immediately above its chamber title, spanning the card’s usable width.
- Preserve the selected drafting-grid character: paper-and-ink card, hairline frame, subtle depth, and the existing colored chamber accent.
- Keep the existing two featured cards and responsive card grid; on mobile, maintain the 16:9 ratio without horizontal overflow.
- Add restrained interaction only: a slight focus/settle effect on hover or keyboard focus, with reduced-motion support. The screenshot itself will not become an interactive dashboard.

## Screenshot maintenance
Create a repeatable authenticated capture script with fixed viewport, fixed demonstration data, stable selectors, and a per-chamber crop target. This lets the ten images be refreshed after meaningful visual changes without hand-cropping them again.

The homepage will consume checked-in optimized assets, while the capture script remains the controlled refresh mechanism. A missing image will fall back gracefully to the current illustration-led card rather than showing a broken area.

## Validation
- Confirm all ten images come from the real product and contain no restricted information.
- Check desktop, tablet, and mobile layouts for consistent ratios, legibility, and card alignment.
- Confirm lazy loading, image dimensions, and optimization prevent layout shift.
- Verify the existing pen-and-hatch illustrations remain present and unchanged.
- Run code checks and inspect the complete homepage in-browser for visual balance and loading errors.
