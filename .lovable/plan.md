# Remove the coloured left borders from the homepage chamber cards

## Recommended treatment
Remove the full-height coloured stripe down the left edge of all ten chamber cards, including the two featured cards. Keep the clean paper background and subtle top/bottom separators; do not replace the stripe with another vertical border.

## Preserve
- Existing card layout, spacing, headings, copy, images and value estimates.
- Small horizontal chamber-colour accents and bullet marks.
- Screenshot zoom, navigation and explanatory controls.
- All other pages and presentation sections.

## Technical changes
In `src/components/marketing/ChamberPanel.tsx`, remove the absolutely positioned full-height accent element and update the component comments. Keep `accentVar` for the remaining horizontal accents and screenshot outline. No data or access-rule changes.

## Verification
Check all ten homepage chamber cards at desktop and phone widths: no coloured left rail, no shifted content or new overflow, and existing interactions remain intact. Confirm the preview has no errors.