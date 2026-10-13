# Anchor “How this flow works” as a collapsible right-edge tray

## Recommendation

Make the reading column a **docked tray at the far-right edge**, rather than a column that travels with the diagram. Open it by default, limit its expanded width to **30% of the viewport**, and let the animation use the space released when it collapses. Keep the text comfortably readable with its own vertical scroll.

## Confirmed layout issue

The current flow combines its diagram and a fixed 320px sidebar inside an outer flex container that does not explicitly fill the available width. The full-screen dialog also adds padding around that container. This permits unused space to the right instead of anchoring the reading column to the screen edge. In `/present`, the same sidebar sits inside a centred, scaled reference canvas; attaching a viewport tray inside that transformed canvas would not reliably reach the real screen edge.

## Proposed experience

- **Flush right:** the tray’s outer edge meets the viewport edge, with a fine divider on its left. Internal text padding remains; no blank outer gutter.
- **Expanded by default:** target a comfortable desktop width of about 360px, always capped at 30vw. Text wraps rather than making the tray wider.
- **Clear collapse control:** a chevron in the tray header collapses it to a narrow icon rail. An always-visible, labelled-on-focus/hover control restores it.
- **More room for the flow:** expanded and collapsed states reserve their actual widths, so the animation resizes without being covered. Collapsing must not restart the scenario or change pause state.
- **Independent scrolling:** keep the tray header and collapse control visible while its reading content scrolls, including the safeguards at the bottom.
- **Selected-item details:** clicking a diagram item continues to show its explanation in this same tray. If collapsed, selecting an item opens the tray; “Resume the flow” restores the guide as it does now.
- **No obstruction:** keep the presentation title, view tabs and close control above the tray, reachable at all times. The tray begins below that header and ends at the bottom of the viewport.
- **Narrow screens:** do not squeeze the guide into a 30%-wide phone column. Use an edge-attached, vertically expandable reading panel below the flow, with the same collapse control and no horizontal overflow.

## Scope

Apply the edge-docked tray to the homepage’s **National system** modal and the equivalent national-flow section in `/present`. In `/present`, dock it only within that slide so it never covers neighbouring slides. Leave the **By Chamber** layout, all wording, scenario routes and animation behaviour unchanged.

## Technical approach

- Extract the existing guide and selected-item explanation into a shared tray presentation, keeping selection and playback state in `DataDecisionFlow`.
- Give the dialog flow body explicit full-width, bounded-height layout; remove only its outer right gutter, preserving header and diagram spacing.
- Use a reserved-space grid for the animation and tray rather than overlaying the diagram with a fixed-position panel.
- For `/present`, keep the tray outside the transformed reference canvas and fit the diagram alone to the remaining width and height. Preserve the full-map contain-fit guarantee.
- Use existing semantic tokens and approved button utilities. Provide accessible labels, `aria-expanded`, keyboard operation and reduced-motion transitions. Keep expanded state local to each mounted presentation; no stored preference is needed.

## Validation

- At 1397×857, 1280×720 and 1920×1080, measure that the expanded tray is flush right and never wider than 30% of the viewport.
- Confirm collapsing enlarges the map, reopening restores the guide, and neither action restarts or pauses the running scenario.
- Verify selected-item explanations, return to the guide, scrolling to the final safeguard text, and uninterrupted access to tabs and Close.
- Check `/present` for full-map visibility in both tray states and no tray appearing over other slides.
- Verify phone layout, keyboard controls, reduced motion, no horizontal overflow, no runtime errors and a clean preview build.
