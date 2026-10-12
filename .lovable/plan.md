# Fit every embedded page to the viewer width

## Recommendation

Use a true **fit-to-width viewport**, rather than only making the outer viewer `width: 100%`.

The current frame already fills the right column, but its embedded page still receives the narrow column as its browsing width. Desktop-oriented Chamber screens can therefore retain a wider internal layout and overflow horizontally. The viewer should instead render each embedded page on a stable desktop canvas and scale that complete canvas down to the exact available width.

## Changes

1. **Measure the available viewer width**
   - Observe the selected viewer’s content area so the fit updates when the presentation window, column, or expanded view changes size.

2. **Render on a stable internal canvas**
   - Give the embedded page a desktop-sized internal viewport wide enough for Chamber layouts to render as designed.
   - Keep the presentation frame itself at `width: 100%` with no horizontal overflow.

3. **Scale the complete page to fit**
   - Calculate `scale = available width / internal canvas width`, capped at `1` so content is never enlarged beyond its native size.
   - Apply the scale from the top-left corner and compensate the embedded page’s dimensions so its left and right edges align exactly with the viewer.
   - Preserve vertical scrolling inside the embedded page while eliminating horizontal scrolling.

4. **Handle all viewer states consistently**
   - Recalculate after resize, narrow/wide mode changes, and page reload.
   - Use the same behavior for every Chamber and external web embed, with a safe natural-width fallback where external browser restrictions prevent controlled scaling.

5. **Verify the actual problem, not only the container**
   - Test Chamber 02 in the selected two-column presentation and expanded mode.
   - Confirm the embedded page’s full left and right edges are simultaneously visible and horizontal scrolling is absent.
   - Repeat at desktop, tablet, and phone widths; confirm vertical scrolling, viewer controls, links, and page interaction still work.

## Technical details

- Implement the sizing in the shared live viewer so every embed inherits one rule.
- Use a `ResizeObserver` and a transformed iframe canvas with `transform-origin: 0 0`.
- Keep the existing portrait viewer ratio and loading state unless the scaled content requires a height correction to retain usable vertical space.
- Do not modify Chamber content or business logic.
