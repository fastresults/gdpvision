# Compact, movable Sovereign Eye legend

## Recommendation

Replace the always-open desktop legend with a **floating legend dock** inside the map. It starts collapsed as a small “Legend” control, can be dragged by a dedicated grip, and expands in place when needed. This preserves the full legend without permanently obscuring map labels and flows.

Dragging should remain bounded to the Sovereign Theatre—not the whole browser window—so the control cannot cover navigation, disappear off-screen, or interfere with scrolling.

## Confirmed current behaviour

- The desktop legend is forced open and occupies a fixed 256px panel in the map’s upper-right corner.
- The current mobile-only control can collapse the legend, but desktop users cannot.
- The supplied screenshots show the panel covering flow paths, labels, and central map marks.
- Legend state currently lives only inside the map component; saved scenes do not store legend placement.
- The same map component is used for the authenticated workspace and public shared scenes, so the interaction can remain consistent in both views.

## Interaction design

1. **Collapsed by default**
   - Show a compact bordered dock with a legend icon, “Legend,” and an expand chevron.
   - Keep its footprint stable so it does not jump when the visible layer count changes.

2. **Drag only from a clear grip**
   - Add a familiar grip icon and move cursor.
   - Use pointer events so mouse, pen, and touch all work without adding a heavy drag library.
   - Keep click-to-expand separate from the grip to prevent accidental opening while dragging.

3. **Constrain and intelligently place**
   - Clamp movement to the map viewport with a small safe margin.
   - Preserve the dock’s relative position when the map resizes.
   - When expanded near an edge, open inward so the full legend stays visible.

4. **Expanded state stays controllable**
   - Keep a visible collapse button in the legend header on every screen size.
   - Do not make the large expanded panel draggable; collapse first, move the small dock, then reopen. This avoids accidental map obstruction and unclear drag targets.
   - Escape collapses the panel; focus remains on the legend control.

5. **Remember the user’s choice locally**
   - Remember open/closed state and dock position in the browser for subsequent visits.
   - Do not add this presentation preference to saved scenes or the backend.
   - If a stored position no longer fits after resizing, automatically clamp it back into view.

## Technical approach

- Refactor the legend block in `RegionMap` into a focused floating-legend component.
- Track collapsed state and normalized x/y position; measure the map and legend with refs.
- Implement pointer capture for smooth drag behaviour and a small movement threshold to distinguish dragging from clicking.
- Use existing semantic tokens and approved button utilities; add no new package and no data-layer changes.
- Respect reduced-motion preferences and avoid animated travel across the map.

## Validation

- Verify collapse, expand, drag, and edge clamping with mouse and touch.
- Verify the legend cannot leave the map or overlap page navigation after resizing.
- Verify keyboard users can expand/collapse and always see a focus indicator.
- Check authenticated and public scenes at desktop and mobile widths.
- Confirm map marks remain hoverable/clickable beneath the legend’s former fixed location and that the project still builds cleanly.
