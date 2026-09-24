# Expandable Sovereign Theatre workspace

## Recommended experience

Reframe the map area as one coordinated three-pane workspace rather than a separate layers card beside a map-with-sidebar.

```text
Expanded
┌──────────────┬──────────────────────────────────┬─────────────┐
│ Map layers   │        Sovereign Theatre         │ Focus layer │
│ 360px tray   │             fluid                │ 300px tray  │
└──────────────┴──────────────────────────────────┴─────────────┘

Both collapsed
┌────┬────────────────────────────────────────────────────┬────┐
│ ≡  │                 Sovereign Theatre                  │ ◉  │
└────┴────────────────────────────────────────────────────┴────┘
```

The diagram receives every pixel released by either tray. Both controls remain visible as narrow icon rails, so the user is never left wondering how to restore them.

## Interaction design

### 1. Left: collapsible Map Layers tray
- Add a clear collapse control in the tray header.
- Expanded state retains all current visibility, focus, strength, and AI-brief controls.
- Collapsed state becomes a narrow vertical rail with a Layers icon, visible-layer count, and expand control.
- Keep layer state unchanged when collapsing; collapsing changes workspace space, not what the map displays.

### 2. Right: collapsible Focus Layer tray
- Add a matching collapse control to the Focused Layer header.
- Expanded state shows the current layer summary and any pinned interpretation.
- Collapsed state becomes a narrow rail showing the focused layer’s icon/status and an expand control.
- Clicking a map mark pins its interpretation and opens the right tray, giving persistent detail a stable home.

### 3. Centered hover interpretation
- Remove transient hover content from the right tray.
- On mouse hover or keyboard focus, show one compact “What this means” notice centered within the Sovereign Theatre canvas—not the whole browser window.
- New hover targets replace the notice in place, preserving the current short delay to prevent flicker.
- Give the notice a constrained width, strong border, paper surface, and subtle shadow; it must not resize the diagram or intercept pointer movement.
- The notice disappears on pointer exit. Click/tap pins the same content into the right tray instead of leaving a modal over the map.
- This remains a non-blocking notice, not a modal: no backdrop and no focus trap.

### 4. Expansion behavior
- Animate only the tray widths and map reflow with a restrained transition; respect reduced-motion preferences.
- Support all four desktop states: both open, left closed, right closed, both closed.
- Remember each tray’s open/closed preference locally, separate from saved scenes and map data.
- Trigger map remeasurement after each transition so the diagram and draggable legend stay correctly bounded.

### 5. Responsive behavior
- Desktop and wide tablet: collapsible left/right edge trays.
- Narrow screens: keep the diagram full-width and open Layers or Focus as accessible overlay drawers/bottom sheets; do not squeeze the map between mini rails.
- Ensure collapse controls, status counts, hover/focus notices, and pinning remain keyboard and touch accessible.

## Technical approach

- Move the right-hand focused-layer presentation out of the map’s fixed internal grid and let the workspace own all three columns.
- Keep map rendering and hover detection in `RegionMap`, but report the currently inspected feature upward.
- Let the workspace decide whether that feature appears as the centered transient notice or as pinned content in the right tray.
- Use semantic project tokens and existing button utilities; add no new package.
- Preserve the existing draggable legend, layer controls, evidence links, and Explain-this rationale behavior.

## Verification

- Confirm the diagram expands correctly in every tray combination at the current desktop viewport.
- Verify hover replacement, pointer exit, keyboard focus, click-to-pin, and automatic right-tray opening.
- Verify the legend remains bounded after every width change.
- Verify mobile drawers, reduced motion, and persisted tray preferences.
- Run type checks, map consistency checks, build checks, and authenticated visual checks when a preview session is available.
