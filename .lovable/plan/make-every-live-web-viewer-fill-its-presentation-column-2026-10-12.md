# Make every live web viewer fill its presentation column

## Recommended approach

Use the presentation grid as the single source of width. The embedded viewer should be `width: 100%` of the column it occupies, instead of calculating its width from half the browser and the available height.

This gives the selected viewer—and every other embedded Chamber or event website—the full right-column width with no unused side space. The existing portrait viewport remains stable, so the embedded page is not stretched or distorted.

## Changes

- Replace the viewport-based width calculation in the shared live viewer with a full-width container.
- Keep the current 9:12 viewing ratio, loading state, toolbar, reload control, larger-view control, and open-in-new-tab control.
- Ensure both presentation layouts allow the viewer to consume the complete grid track:
  - standard view: full width of the right column;
  - larger view: full width of the presentation area after the left narrative column is hidden.
- Add the necessary minimum-width constraints to the parent grid cells so long embedded content cannot force overflow or shrink the viewer unexpectedly.
- Apply this through the shared viewer, covering all ten Chamber embeds and every event website embed consistently.

## Responsive behavior

- Desktop: viewer spans edge-to-edge within the right column.
- Larger-view mode: viewer spans the available presentation width.
- Phone and tablet: viewer spans the available page width while retaining its aspect ratio.

## Verification

- Check Chamber 01 and representative later Chambers in standard and larger-view modes.
- Check an external event website embed using the same viewer.
- Verify desktop and phone layouts for no horizontal overflow, clipping, or distortion.
- Confirm reload, resize, external-link controls, loading state, and embedded-page interaction still work.
