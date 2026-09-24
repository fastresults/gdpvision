# Sovereign Eye contextual interpretation panel

## Recommendation

Turn the existing map preview into one **contextual interpretation panel** that responds to both map marks and legend items. Hovering or focusing replaces its contents immediately; clicking or tapping pins the current explanation. Avoid hover-triggered modals: they interrupt comparison, obscure the map, and fail on touch devices.

The panel should answer four questions in a fixed order:

1. **What am I looking at?** — the mark, line, size, shape, or colour being encoded.
2. **What does it show now?** — the actual value, unit, period, direction, confidence, and evidence state.
3. **What is the trend?** — rising, falling, stable, mixed, or unavailable, with the comparison window shown.
4. **Why does it matter?** — a concise, evidence-bounded economic interpretation and any available forecast.

## Confirmed data constraints

- Map marks currently expose a title, current value, short metadata, visibility, and evidence count.
- KPI rows include a current value, period, target, provenance, and visibility, but the Sovereign Eye payload does not currently include KPI history.
- Capital-flow rows include value, direction, period, method, confidence, and notes, but not a multi-period series in the current payload.
- Sector rows include current GDP share and confidence, but not historical shares in the current payload.
- The scenario engine has projection bands and sector impacts, but those outputs are not currently loaded into Sovereign Eye.
- The existing map preview already swaps on mark hover/focus and pins on click, so this can be extended rather than introducing a competing interaction.

Because of these constraints, the interface must say **“Trend unavailable”** or **“No forecast attached”** until real comparison or scenario data exists. It must never infer a direction from one observation or present an AI-written possibility as a forecast.

## Interaction design

### 1. One shared interpretation surface

- Replace the small lower-left preview with a stable, compact panel titled **What this means**.
- Legend hover/focus shows an **encoding explanation**: for example, “Line width compares the relative size of capital flows; it does not show growth over time.”
- Map-mark hover/focus shows a **specific reading**: for example, the flow name, amount, reporting period, direction, method, confidence, and economic significance.
- Moving directly between items replaces the content in place without stacking notices.
- When nothing is active, show a short neutral prompt rather than an empty box.

### 2. Hover previews; click pins

- Mouse hover and keyboard focus update the panel after a short delay to prevent flicker while crossing dense marks.
- Click, Enter, Space, or tap pins the interpretation so the user can move the pointer into the panel.
- A pinned state is visibly labelled and remains until closed, replaced by another click, or its layer is hidden.
- On touch devices, the first tap selects and pins; no hover-only information is required.

### 3. Structured, truthful content

Use the same content schema for every item:

- **Signal:** plain-language definition of the mark or legend encoding.
- **Current reading:** value, unit, period, inbound/outbound direction, public/private state, and source count as applicable.
- **Trend:** direction, numeric change, comparison periods, and freshness only when at least two comparable observations exist.
- **Economic meaning:** one or two bounded sentences describing plausible transmission channels, not advice or certainty.
- **Forecast:** only a named scenario projection with horizon and uncertainty band; otherwise explicitly unavailable.
- **Confidence and provenance:** reported/modelled status, grade, and a route to supporting evidence.

### 4. Layer-specific interpretation rules

- **Macro indicators:** compare real historical KPI points; explain movement relative to the previous comparable period and target.
- **Sector share:** compare historical sector composition if available; explain concentration, diversification, and exposure without treating share as growth.
- **Capital flows:** distinguish magnitude from trend, inbound from outbound, and reported from modelled; compare like-for-like periods only.
- **Ministry coverage:** describe accountability and evidence coverage, not economic performance.
- **Corpus evidence:** describe source type, recency, verification, and visibility; never turn document volume into an economic trend.
- **Live conditions:** explain current operational relevance and freshness; avoid asserting macroeconomic impact without linked evidence.
- **Legend-only encodings:** explain exactly what shape, size, width, dash, and colour mean—and explicitly what they do not mean.

### 5. Forecast integration

- Add forecasts only from a selected, saved scenario or an explicitly labelled baseline projection.
- Show P50 as the central path and P10–P90 as the uncertainty range, with horizon and scenario name.
- Do not silently use the scenario engine’s generic baseline as a country forecast.
- Keep current observations visually and verbally distinct from projections.

## Technical approach

- Extend `MapFeature` into typed interpretation metadata rather than assembling prose inside SVG branches.
- Introduce a shared `InterpretationPanel` used by map marks and legend rows.
- Make each legend row interactive and map it to an encoding-level interpretation record.
- Add a single active-item controller with clear priority: pinned item → hovered/focused item → default prompt.
- Load comparable KPI/sector/flow history in the protected workspace function, bounded to the displayed items and periods; keep public scenes filtered to public records.
- Connect scenario projections only through an explicit selected-scene reference, not an automatic default.
- Register every derived trend, comparison, and economic interpretation with the existing **Explain this** system.
- Keep economic-impact copy deterministic and reviewed by layer/type; AI may produce an optional deeper brief, but not the instant hover claim.

## Validation

- Verify every visible legend item and map mark produces a matching explanation by mouse, keyboard, and touch.
- Verify moving between items replaces content without flicker, stale text, overlapping panels, or stacked modals.
- Verify single-period records never show invented trends and unlinked scenarios never show forecasts.
- Verify trend arithmetic uses comparable periods, correct units, two-decimal display, and explicit direction.
- Verify private evidence and interpretations never appear in public shared scenes.
- Check the pinned panel remains usable without covering the selected mark at desktop and mobile widths.
- Run type, map-drift, build, and authenticated end-to-end checks.
