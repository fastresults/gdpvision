# Sovereign Eye map interaction redesign

## Recommendation

Turn the Sovereign Theatre into a true layer-driven intelligence map, not a static diagram beside an AI selector. Separate **what is visible** from **what is being inspected**, add a persistent dynamic legend, and make every mark discoverable by hover, keyboard focus, or tap.

## Confirmed current gaps

- The left rail’s controls say “Selected for AI” / “Add to AI brief,” so they do not communicate map visibility.
- Visibility state currently changes capital-flow lines, but most other layer switches do not produce a distinct map view.
- Map points and flow lines have no hover, focus, click, or tap behavior.
- Only a few locations show short country codes; flow endpoints and decorative paths are unlabeled.
- There is no legend explaining marker shape, line colour, direction, width, confidence, or active/private evidence.
- The three summary blocks over the map always show the first three layers rather than the enabled or focused layers.

## Proposed experience

### 1. Replace the “Layer rail” with a clear Map Layers panel

Each layer row will have two independent actions:

- **Visible switch** — explicitly labeled On/Off and immediately adds or removes that layer from the theater.
- **Inspect action** — selecting the row focuses that layer, updates the map explanation, legend, and detail panel without silently changing visibility.

Add **Show all** and **Clear map** controls, a visible-layer count, and plain status text such as “3 of 6 layers shown.” Keep “Use in AI brief” as a separate checkbox or later selection step so map display and AI inputs are never conflated.

### 2. Add a persistent, dynamic map legend

Place a compact legend inside the theater at the lower-right on desktop and in an expandable “Legend” drawer on smaller screens. It will update to show only encodings currently present, including:

- selected country versus regional comparator
- inbound versus outbound capital flows
- line width as relative value
- solid/dashed treatment for confidence or evidence quality
- weather and seismic symbols
- public versus private evidence where that distinction affects what can be shared

Every legend item will use the exact symbol, line, and token seen on the map—not prose alone.

### 3. Give every layer a distinct, truthful visual grammar

- **Macro pulse:** labeled KPI signals anchored to the selected country, with value and period.
- **Sector structure:** proportional sector markers or rings with sector name and share.
- **Capital currents:** directional arrows with origin/destination or flow category, amount, and confidence.
- **Ministerial coverage:** ministry nodes labeled by ministry and coverage status.
- **Corpus memory:** source/evidence markers summarized by type and visibility, not decorative points.
- **Live conditions:** timestamped weather and seismic markers with freshness state.

Do not draw a layer when there is no supporting data; show a clear empty state instead of decorative geometry.

### 4. Add hover, focus, click, and touch inspection

Every rendered mark will support:

- **Hover/focus preview:** name, current value, unit, period, direction, confidence, visibility, and source count as applicable.
- **Click/tap to pin:** keeps the detail open in a dedicated inspector beside the map.
- **Evidence path:** a direct action from the inspector to the supporting records below.

Questionable calculations and model-authored values will continue to use the existing “Explain this” system rather than unexplained tooltips.

### 5. Improve labels and map orientation

- Show the selected country’s full name prominently at its marker.
- Label visible flow endpoints and active regional nodes; use collision-aware placement and hide lower-priority labels at tight widths.
- Add simple geographic orientation and make the background paths meaningful or remove them.
- Replace the three fixed overlay cards with a compact active-layer summary tied to the focused layer.

### 6. Preserve the experience in saved and shared scenes

Saved scenes will retain visible layers, focused layer, and pinned item. Public shared scenes will render the same read-only legend and inspection behavior while continuing to exclude private evidence and platform branding.

## Technical approach

- Refactor `RegionMap` into layer-specific renderers sharing one projection and one interaction model.
- Keep `visibleLayerIds`, `focusedLayerId`, and `pinnedFeature` as separate state.
- Add typed feature metadata so tooltips and the inspector are generated consistently across layers.
- Build hover previews with accessible popovers; all SVG marks receive keyboard focus, semantic labels, and adequate touch targets.
- Use existing semantic colour tokens and approved button utilities; add new semantic tokens only when a legend role has no existing equivalent.
- Respect reduced-motion preferences and avoid pulsing or animated flows when motion is disabled.

## Validation

- Verify every layer switch visibly changes the theater and never changes AI selection unintentionally.
- Verify every visible symbol is represented in the legend and every mark can be inspected by mouse, keyboard, and touch.
- Check desktop and mobile layouts for label collisions, map obstruction, and readable controls.
- Confirm empty-data layers remain honest, saved scenes restore correctly, and public scenes expose no private records.
- Run the project’s type, map-drift, and build checks after implementation.
