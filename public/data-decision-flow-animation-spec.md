# Data & Decision Flow — Animation Build Spec

A portable, self-contained brief for rebuilding the **"Data & Decision Flow"** animated map in any React + Tailwind (Lovable.dev) app. Paste this whole file into a new project's chat and say: *"Build this animation exactly as specified, adapting the node labels and scenarios to my domain."*

---

## 1. What it is

A full-screen, explorable **engraved-schematic flow map** that shows how inputs travel through a system to outcomes. It works in two acts:

1. **Draw once.** Columns, boxes and connecting lines draw themselves left → right (~9 s), then the map **stays static** — it never redraws.
2. **Run scenarios.** Gold dots travel only along the route of a named real-world scenario (e.g. *"A scandal breaks inside Cabinet. What do we do?"*), step by step, lighting boxes as the dots **land**. The outcome holds 3 s, then the next scenario plays. Loops indefinitely.

The visitor can pick a category (here: 10 "Chambers", 2 scenarios each = 20), run any scenario, pause, click any box for an explanation, or highlight a thematic path.

---

## 2. Visual style (house rules)

- **Look:** monochrome hand-engraved graphite schematic on warm paper. Think banknote engraving / technical plate — not a flat SaaS diagram.
- **Palette (semantic tokens only, never raw hex in components):**
  | Token | Example | Use |
  |---|---|---|
  | `--paper-0` | `#fcfcfa` | background, box fill |
  | `--paper-50` | `#f6f5f0` | subtle surfaces |
  | `--ink-950` | `#08111f` | primary text, active line, selected box fill |
  | `--ink-700` | `#2e3a4d` | box stroke, body text |
  | `--ink-500` | `#6b7585` | idle lines, mono labels |
  | `--line-200` | `#dcd9cf` | column frames, hatch |
  | `--gold-500` | `#b98a2f` | the ONLY accent: dots, travelled lines, lit boxes, feedback loop |
- **Gold means one thing:** "the flow has travelled here." Never decorate with it.
- **Type:** serif display for the scenario question (`font-display`), monospace uppercase with wide tracking (`0.18–0.22em`) for labels/eyebrows (e.g. IBM Plex Mono), plain sans/serif body at 14px.
- **Texture:** the middle "core" column has a 45° hatch pattern fill (`<pattern>` of 1px lines every 6px in `--line-200`). Other columns: dashed hairline frames.
- **Strokes:** hairlines 0.9px idle, 1.6px active/gold. Box corners `rx=3`. No shadows, no gradients.
- **Faded state:** inactive boxes at opacity 0.25, inactive lines at 0.08.

---

## 3. Layout

- One SVG, `viewBox="0 0 1280 700"`, scales to container (`w-full h-full min-h-[520px]`).
- **Five columns (bands)**, left → right. Column x: `[30, 290, 545, 830, 1060]`, widths `[210, 210, 230, 190, 200]`, box height `36`.
  1. **Inputs** (evidence in) — ~7 boxes
  2. **Core** (the protected brain / store) — ~3 boxes, hatched
  3. **Workers** (the 10 processing units) — each carries a small right-aligned mono group tag (UNDERSTAND / REHEARSE / DECIDE / DELIVER)
  4. **Decisions** — ~4 boxes
  5. **Outcomes** — ~4 boxes
- Boxes in a column are vertically centred with spacing `min(64, available / count)`.
- Column titles in mono uppercase above each column.
- **Edges:** cubic Béziers from right-middle of source to left-middle of target:
  `M x1 y1 C mx y1, mx y2, x2 y2` where `mx = (x1+x2)/2`. Same-column edges bow out to the right by 24px.
- **Feedback loop:** a dotted gold curve from the outcomes column back to the core column along the bottom, captioned in mono: *"RESULTS RETURN AS EVIDENCE — EACH CYCLE DECIDES FASTER"*.
- **Right sidebar (320px on desktop, stacked above on mobile):** numbered 5-step "How this flow works" list, a gold-bordered italic case statement, a safety line, and the selected-box detail panel.

---

## 4. Data model (keep data separate from the component)

```ts
type Path = "evidence" | "safeguards" | "money" | "delivery";
interface FlowNode {
  id: string; band: 0|1|2|3|4; label: string; group?: string;
  what: string; feeds: string; gdp: string;   // three-part explanation panel
  href?: string; paths: Path[];               // thematic paths it belongs to
}
const EDGES: [string, string][] = [["stats","corpus"], /* … */];

// scenarios.ts
interface Scenario {
  chamber: string;            // category id, e.g. "05"
  title: string;              // "A scandal breaks inside Cabinet"
  question: string;           // shown large in serif
  steps: { edges: [string,string][]; text: string }[]; // 3–6 steps
  outcome: string;            // shown after last step
  loop?: boolean;             // also run a dot along the feedback loop
}
```

**Dev assertion (required):** in development, check every `scenario.steps[].edges` pair exists in `EDGES`; `console.error` if not. Dots must never travel an undrawn line.

---

## 5. Timing

| Constant | Value | Meaning |
|---|---|---|
| `DRAW_MS` | 9000 | initial self-draw before scenario 1 |
| `STEP_MS` | 1400 | per scenario step |
| Dot travel | 1.2 s | `ease-in-out`, 3 dots per edge staggered 0.18 s (first r=4.5, others r=3) |
| Land delay | 1200 ms | destination box lights only after dots arrive |
| `HOLD_MS` | 3000 | outcome stays on screen before next scenario (+1400 if `loop`) |
| Column stagger | 1.6 s per band | boxes and lines of each column appear in sequence |

---

## 6. Animation mechanics

### Draw-once
- Lines: `pathLength={1}`, `stroke-dasharray: 1`, animate `stroke-dashoffset 1 → 0` over 1.4 s, delay `0.8 + band*1.6 + (i%7)*0.08 s`.
- Boxes: `ddf-rise` (fade + 6px lift, 0.7 s), delay `band*1.6 + 0.3 s`.
- Column frames: fade 0.8 s, delay `i*1.6 s`.
- These are CSS animations with `both` fill — they run once and never restart, because the SVG is not re-keyed.

### Travelling dots
Use **CSS motion path**, not JS rAF:
```tsx
<circle r={4.5} className="ddf-dot"
  style={{ offsetPath: `path('${edgePath(a,b)}')`, animationDelay: `${k*0.18}s` }}
  key={`${scn}-${step}-${a}-${b}-${k}`} />   // key forces a fresh run each step
```

### Lighting rules (single source of truth)
- `mode = selected ? "node" : filter ? "path" : "scenario"` — **only one thing drives the map at a time.**
- **Scenario mode:**
  - `completed` = steps before the current one → their nodes + edges are **gold**.
  - Current step: sources light immediately; destinations + edges turn gold only when `landed` becomes true (1.2 s timer), with a one-shot gold pulse ring (`ddf-land`: stroke-width 6→1, opacity .9→0, 0.7 s).
  - The edge currently being crossed is dark ink (`--ink-950`, 1.6px); everything else faint.
- **Path mode** (thematic button): dots stop, show only nodes/edges whose `paths` include the filter. Caption: *"Showing the Delivery path — press Play or pick a scenario to resume."*
- **Node mode** (box clicked/Enter/Space): dots stop, only that box and its direct neighbours are shown; box fills ink with paper text; detail panel opens (What it does / What it feeds / Why it matters).
- Play, a scenario card, or a category chip clears filter + selection and resumes scenarios.

### Scheduler
One `useEffect` with a single `setTimeout` keyed on `[step, scn, paused, playing, reduce]`: `step=-1` → wait `DRAW_MS`; `step < steps.length` → `STEP_MS`, then `step+1`; `step === steps.length` → `HOLD_MS`, then next scenario, `step=0`. Pausing just skips scheduling; add class `ddf-paused` to freeze running CSS animations.

---

## 7. CSS (add to global stylesheet)

```css
@keyframes ddf-fade { from { opacity: 0 } to { opacity: 1 } }
@keyframes ddf-draw { from { stroke-dashoffset: 1 } to { stroke-dashoffset: 0 } }
@keyframes ddf-rise { from { opacity: 0; transform: translateY(6px) } to { opacity: 1; transform: none } }
@keyframes ddf-travel {
  from { offset-distance: 0%; opacity: 0 } 10% { opacity: 1 } 90% { opacity: 1 }
  to { offset-distance: 100%; opacity: 0 }
}
@keyframes ddf-land { 0% { stroke-width: 6; opacity: .9 } 100% { stroke-width: 1; opacity: 0 } }

.ddf .ddf-fade { animation: ddf-fade .8s ease-out both; }
.ddf .ddf-rise > * { animation: ddf-rise .7s ease-out both; animation-delay: inherit; }
.ddf .ddf-draw:not(.ddf-loop) { stroke-dasharray: 1; animation: ddf-draw 1.4s ease-in-out both; }
.ddf .ddf-loop { animation: ddf-fade 1.2s ease-out both; }
.ddf .ddf-node:focus-visible rect { stroke: var(--gold-500); stroke-width: 2.5; }
.ddf-dot { fill: var(--gold-500); offset-rotate: 0deg; animation: ddf-travel 1.2s ease-in-out both; }
.ddf-dot-slow { animation-duration: 1.4s; }
.ddf .ddf-rise > .ddf-land { animation: ddf-land .7s ease-out both; pointer-events: none; }
.ddf-paused, .ddf-paused * { animation-play-state: paused !important; }
@media (prefers-reduced-motion: reduce) { .ddf * { animation: none !important; } }
```

---

## 8. Controls above the map

1. **Category chips** (`All`, `01`…`10`) as a horizontally scrollable tablist; active chip uses a selected-card style.
2. **Pause / Play** ghost button.
3. **Scenario cards** (when a category is chosen): 2-column grid, each card = mono eyebrow "Scenario 1 · Title" + the question. Click runs it immediately.
4. **Caption block** (gold left border, `aria-live="polite"`, min-height 64px so nothing jumps):
   - eyebrow: `Chamber 05 · Narrative · Scenario 1 of 2 — A scandal breaks inside Cabinet`
   - serif question (18–20px)
   - current step text, or `Outcome: … (a pathway, never a forecast)`
5. **"Show the path of"** buttons: Evidence / Safeguards / Money / Delivery (toggle, `aria-pressed`).

---

## 9. The trigger button (homepage)

An **"engraved alchemical lens" plate** centred under a hero illustration:
- Paper background, 1px ink border, 4px solid ink offset shadow; hover → 8px **gold** offset shadow + translate(-2px,-2px); active → 2px shadow + scale .97.
- Inner inset gold hairline frame (`inset-1.5`, gold at 40%) + four 8px corner etchings.
- Lens emblem: gold pulsing ring, dashed ink ring spinning 14 s, gold 4-point compass star.
- Mono uppercase label "Data & Decision Flow", italic serif sub-line "Engage the National Decision Engine".
- Behind it, two faint dashed sketch rings spinning 60 s (opacity .25). Small mono caption below: "Twenty scenarios — two for every Chamber".
- Opens a Radix Dialog: **full screen** (`fixed inset-0 h-dvh w-screen`, paper background, scrollable), header eyebrow + serif title + one-line description + ghost close button.

---

## 10. Accessibility & responsive

- Every box is `role="button"`, `tabIndex=0`, `aria-label="{label}. {what}"`, toggles on Enter/Space.
- A visually hidden text outline lists every node and connection for screen readers.
- **Reduced motion:** no draw, no dots — show the complete still map with the chosen scenario's full route lit.
- **Mobile (< md):** replace the SVG with a vertical stack of the five bands (same lit logic, same detail panel); chips scroll sideways; cards stack; no horizontal overflow (verify `scrollWidth === innerWidth`).

---

## 11. Writing the scenarios

- Two per category; each is a **real, recognisable situation phrased as a question** ("A natural disaster is imminent — how do we prepare the public?").
- 3–6 steps, each step's `text` in the form *"Source → Destination: what happens, in plain words."*
- Sensitive/private-data scenarios must route through the protected core node (e.g. a Vault), never directly.
- Outcomes are phrased as pathways, never forecasts.

---

## 12. Acceptance checklist

- [ ] Map draws once, then never redraws.
- [ ] Dots only travel drawn edges (dev assertion silent).
- [ ] Lit boxes/lines always match the dots; destinations light on arrival.
- [ ] Path button or box click stops dots; Play resumes.
- [ ] Outcome holds 3 s, then next scenario; loops forever.
- [ ] Category chips + scenario cards run any scenario on demand.
- [ ] Keyboard, reduced-motion and mobile layouts work; no console errors; no sideways scroll.
- [ ] Only semantic colour tokens; gold used exclusively for travelled flow.
