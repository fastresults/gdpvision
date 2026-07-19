## Goal
Add small, discreet info icons next to each of the three sidebar entries (Personas, Segments, Studies) in the Chamber 07 layout, so novice users get a concise, high-value McKinsey-style explanation of *what it is*, *when to use it*, and *the decision value* — without cluttering the nav.

## Where
Single file: `src/routes/_authenticated/admin/countries.$code.personas.tsx` (the `PersonasLayout` sidebar that already renders the three nav items).

## Design
- Add an `info?: string | { what: string; use: string; value: string }` field to each nav item entry.
- Render a tiny `Info` icon (lucide, `h-3.5 w-3.5`, `text-muted-foreground/60 hover:text-foreground`) inline at the right edge of each row, only visible on row hover/focus so the nav stays clean.
- Wrap the icon in shadcn `HoverCard` (desktop hover, keyboard-focusable) + `Popover` fallback for touch — or simply use `HoverCard` which already handles focus. Content width ~280px.
- Popover content, McKinsey-style, ~50–70 words each with three micro-sections:
  - **What it is** — one sentence definition.
  - **When to use** — 1–2 concrete decision moments.
  - **Why it matters** — the outcome/value it unlocks.
- Prevent the icon click from triggering nav (stopPropagation, `e.preventDefault` inside HoverCard trigger).

## Copy (draft)
- **Personas** — What: AI-generated synthetic citizens grounded in this country's second-brain data. When: pressure-test a policy, message, or product before a single dollar or dispatch. Why: surface objections, hopes and blind spots from voices you'd otherwise miss.
- **Segments** — What: coherent groups of personas sharing geography, livelihood or attitude. When: targeting a program, tailoring comms, or sizing an intervention. Why: converts millions of citizens into a handful of decision-ready audiences.
- **Studies** — What: structured surveys and focus groups run against your personas and segments. When: you need directional evidence in hours, not weeks. Why: de-risks Cabinet decisions with cited, reproducible signal before field research.

## Acceptance
- Icon is visually quiet (small, muted, appears on row hover/focus).
- Hover/tap opens a compact card with the three-section brief; clicking the icon does not navigate.
- Works keyboard-accessible; no layout shift in the sidebar.
