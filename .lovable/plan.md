# Sankey hover magnification

Make small nodes in the Sovereign Capital Flow Sankey readable by expanding the label + amount of the hovered node (and the endpoints of the hovered ribbon) into a large, high-contrast callout, while dimming everything else. Purely a `src/components/viz/SovereignSankey.tsx` change — no data / server work.

## Behaviour

- Hover a **node rect**, **ribbon**, or **label**: that node becomes the "focused" node. Focused node's linked ribbon and Treasury endpoint also count as active.
- Focused node renders a large callout near its rect (left-anchored for L side, right-anchored for R side, above/below Treasury for center):
  - Line 1: Node label at ~18px serif, ink-950, semi-bold.
  - Line 2: Amount at ~22px mono tabular-nums, ink-950 (e.g. `$142M` or `$1.4B`).
  - Line 3: Share of total (`12.4% of inputs` / `of outputs`) at 11px mono uppercase tracking, ink-500.
  - Line 4 (if present): method · confidence · first citation domain, 10px mono, ink-500; citation is a clickable underline.
  - Rendered inside a rounded rect with `fill="var(--paper-0)"`, `stroke="var(--line-200)"`, subtle drop shadow (SVG `<filter>` with `feGaussianBlur` + `feOffset`), padding ~10px.
- The focused node's rect gets a 2px ink-950 outline and its ribbon opacity jumps to ~0.85; all other ribbons drop to ~0.05, non-focused rects to ~0.2, non-focused inline labels hidden.
- Callout appears with a 120ms fade + 4px translate-in via CSS transition on `opacity` and `transform`. No layout thrash.
- Callout is positioned so it never clips the viewBox: clamp `y` within `[8, H-calloutH-8]`; for L nodes anchor at `x = COL_L + NODE_W + 14`, for R nodes anchor at `x = COL_R - 14` with `text-anchor="end"` and rect drawn to the left; for Treasury draw above the midpoint.
- Inline labels on the rects stay for nodes with `h >= 12` (unchanged) but hide the moment a hover callout is active for any node, so the callout is the only source of text and never overlaps small siblings.
- Keyboard / no-mouse: add `tabIndex={0}` + `focus` handlers on each node `<g>` so focus reproduces hover state; `Esc` clears (via `onKeyDown` on the outer svg).
- Touch: `onTouchStart` on node maps to hover; tapping empty svg clears.

## Small-node affordance

- Compute `minPixelH = 6`. Any node with `h < 14` gets:
  - A faint `stroke="var(--ink-500)"` `stroke-dasharray="2 2"` leader line from its rect to a fixed "index label" column on the outer edge (tiny 10px label with just the node name). This gives baseline legibility even without hover.
  - A `<title>` element with `label — amount — share` for native tooltip fallback.
- Leader-line labels are dimmed when any hover is active so the callout dominates.

## Legend / footer

- Footer strip becomes hover-reactive: when a node is focused, replace the "Inputs · Outputs · Residual" line with the focused node's full breakdown (label, amount, share, method, confidence, notes truncated to 140 chars, first citation link). Restores when hover clears.

## Technical notes

- All new state stays inside the existing `useState<string | null>(hover)`; no new dependencies.
- Reuse existing `fmtUsdM`; add `fmtPct(part, total)`.
- Add a `<defs>` block with a single reusable soft-shadow filter (`id="sankey-callout-shadow"`).
- Callout dimensions measured heuristically (label length * 8px + padding); no DOM measurement needed — SVG `<text>` with `textLength` unset is fine at these sizes.
- Keep color tokens semantic (`--paper-0`, `--line-200`, `--ink-*`), no hardcoded hex.
- No changes to `flows.functions.ts`, capital-flows workbook, or Sankey data model.

## Acceptance

- Hovering the thinnest ATG output node (e.g. `DEBT_SERVICE` if small) shows a crisp callout with label + `$XXM` + share, readable at default zoom.
- Non-hovered ribbons dim; hovered ribbon stays vivid; nothing overlaps.
- Moving between neighbouring small nodes swaps callouts smoothly (no flicker, ≤120ms).
- Removing the mouse restores the default view with all inline labels for nodes with `h >= 12`.
- Works on Treasury hover (callout above the center block).
