# Realign the Instrument overview

## Recommendation

Treat the page as three deliberate horizontal bands instead of letting the title, control, circular visual and ledger table position themselves independently:

```text
1. PAGE HEADER
   CBI PILOT INSTANCE                         PRESS-SAFE VIEW
   The Antigua & Barbuda Instrument

2. CONTENT HEADINGS
   NATIONAL SIGNATURE                         NATIONAL LEDGER — SECTOR COMPOSITION

3. CONTENT
   [complete circular visual]                 [sector table]
```

This gives every element reserved space and removes the need for visual offsets that can collide at different screen sizes.

## Changes

1. **Create a protected header band**
   - Keep the eyebrow, rule and full page title together on the left.
   - Anchor “Press-safe view” at the top-right of the same band, aligned with the eyebrow rather than the title baseline.
   - Reserve the full title height before the visual area begins, so a long country name can wrap without entering the content below.

2. **Remove the source of the overlap**
   - The circular visual currently shifts upward by one-quarter of its own height; remove that upward translation on this page.
   - Do not replace it with another negative margin or fixed offset.
   - Keep the complete ring inside a stable square that scales down to its column width.

3. **Align both columns from the same top edge**
   - Put “National Signature — 12 sector composition” above the circle, not below it.
   - Put “National Ledger — sector composition” on the same baseline above the table.
   - Start the circle and the table immediately beneath their respective headings, using the same heading-to-content spacing.
   - Use a balanced desktop grid where the visual receives a fixed maximum width and the ledger receives the remaining space.

4. **Improve responsive placement**
   - On medium widths, keep the title and control in a two-column header but allow the title column to shrink safely.
   - Stack the signature and ledger vertically before either column becomes cramped.
   - On phones, place Press-safe view below the title, show the full circle at container width, then the ledger with horizontal overflow confined to the table only.

5. **Preserve the page’s visual hierarchy**
   - Keep the current typography, colours, ring artwork, data, actions and safeguards unchanged.
   - Use spacing and grid structure—not smaller type or clipped content—to solve the collision.

## Technical details

- Update the Instrument overview layout only; do not change the shared circular visual globally because it is used on other pages.
- Override the ring’s upward translation at this call site and give its wrapper `min-width: 0` and a stable responsive width.
- Rebuild the top area with a mobile-safe grid for the title/control row and a separate aligned grid for the two content columns.
- Move the signature caption before the ring in document order so visual and screen-reader hierarchy match.

## Validation

- Verify the authenticated Instrument overview at 1397×857, 1280×720, 1024×768 and 390×844.
- Confirm the title never touches the ring, both content headings align, the complete circle is visible, the Press-safe control remains reachable, and no page-level horizontal scrolling appears.
- Toggle Press-safe view at each representative width and confirm its status label does not displace or overlap the title.