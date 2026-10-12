# Keep the full Data & Decision Flow animation visible

## Recommendation

Treat this presentation section as a **single fitted visual stage**, not as a tall web page inside a slide. The full title, scenario, controls and map should be composed on one stable desktop canvas, then automatically scaled down to fit both the available width and the available height under the fixed briefing bar. This is the most reliable way to guarantee that neither the top nor bottom is cropped on laptops, conference displays or embedded viewers.

The current `/present` section combines its heading with an animation container set to roughly 78% of the viewport height. Those heights are additive, so the complete section becomes taller than the visible slide. The map also enforces its own minimum height and can scroll internally. That is why the screenshot shows only the middle of the animation.

## Implementation

1. **Create a presentation-fit mode for the flow**
   - Add a dedicated presentation variant to the existing Data & Decision Flow component; keep the homepage/modal version unchanged.
   - Compose the full flow on a stable reference canvas with explicit dimensions.
   - Measure the actual space below the briefing bar and apply a proportional `contain` scale based on both width and height.
   - Centre the fitted canvas without enlarging it beyond 100%, preserving sharp type and proportions.

2. **Make the slide use the available viewport exactly**
   - Change only the Data & Decision Flow presentation section to use the viewport height minus the fixed briefing bar and safe top/bottom margins.
   - Replace the additive `min-height + 78dvh` arrangement with a grid whose title is `auto` and whose animation area is `minmax(0, 1fr)`.
   - Remove inner vertical scrolling and clipping from this presentation instance.

3. **Compact without removing information**
   - Keep the scenario headline, current step, path filters, all map columns and bottom-most nodes visible simultaneously.
   - Tighten presentation-only gaps and vertical spacing before scaling, so text stays readable on common laptop displays.
   - Keep all buttons, scenario cycling, animated paths and click-to-pause behavior unchanged.

4. **Handle narrow screens deliberately**
   - On phone widths, retain the existing stacked/mobile flow and normal page scrolling rather than shrinking the desktop map until it becomes illegible.
   - Ensure there is no horizontal overflow in either mode.

## Validation

- Verify the entire flow at the current 1397×857 viewport shown in the screenshot, including its top heading and bottom nodes.
- Verify at 1280×720 and 1920×1080 conference-display sizes.
- Verify at 390×844 that the mobile flow remains readable and scrolls vertically without horizontal overflow.
- Run several scenarios and confirm their animated paths stay inside the visible stage.
- Confirm pause/resume, path filters, section navigation, reduced motion, console output and the preview build.
