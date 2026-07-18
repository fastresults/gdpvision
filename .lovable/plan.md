
# Strategy Workbench UI polish (Chamber 04 · threat detail)

The screenshot shows the strategy name input clipping mid-word ("CBI v…"), the eyebrow crowding the title, and the header widget competing with the title for width. On a top-tier government surface, the header must scale gracefully, never truncate silently, and read as a document — not a form field.

## Problems to fix

1. **Title input truncates.** `max-w-xl` + fixed serif 3xl clips long strategy names at ~640 px. There's no ellipsis, no tooltip, no rename affordance — text just disappears.
2. **Header layout is fragile.** Two-column `flex flex-wrap` lets the "Suggest resilient allocation" button steal width from the title; on narrower widths the title collapses further instead of promoting to a full row.
3. **Eyebrow is dense.** `THREAT · CBI WIND-DOWN · SEVERITY 50%` reads as one long mono string with no visual grouping (type, severity chip, horizon, onset).
4. **Rename affordance is invisible.** The title is an `<input>` styled as an `<h1>` — no pencil icon, no hover state, no hint the field is editable. Users either avoid it or click accidentally.
5. **No overflow guard on the canvas.** Long sector labels and action labels elsewhere on the page inherit the same "silently clip" pattern; the header fix should establish a pattern (`min-w-0` + `ReadMore` fallback) reused across the workbench.
6. **Stepper + eyebrow + title stack has no rhythm.** All three sit flush against each other with the same gap; the page lacks the "document header" hierarchy this tier expects.

## Fix

### 1. Header rebuild (document-grade)

Replace the current header with a responsive two-row grid that never truncates:

```text
┌─────────────────────────────────────────────────────────────┐
│ THREAT BRIEFING                                             │  eyebrow (uppercase mono, ink-500)
│                                                             │
│ Resilient strategy · CBI wind-down            [Suggest ▸]   │  h1 (serif, wraps to 2 lines max)
│ ─────────────────────────────────────────────               │  subtle underline appears on hover/focus
│                                                             │
│ ◆ Policy shock  ● Severity 50%  ⏱ 5y horizon  ▸ Immediate   │  meta chips row
└─────────────────────────────────────────────────────────────┘
```

Concretely:
- Use `grid grid-cols-[minmax(0,1fr)_auto] items-start gap-6` for title + CTA row; add `min-w-0` on the title column so `break-words` works.
- Title input: remove `max-w-xl`, keep `w-full`, allow wrapping — replace `<input>` with a `contenteditable`-style single-line-that-wraps pattern using a `<TextareaAutosize>` (or a plain `<textarea>` with `rows={1}` + `field-sizing: content` and `resize-none`) so long names wrap to a second line instead of clipping. Add `title={name}` for full-value tooltip on hover as a belt-and-braces measure.
- Add a subtle Pencil icon that appears on hover/focus of the title, plus a dotted-underline hover state, to make the rename affordance visible.
- Move "Suggest resilient allocation" into the top-right of the grid (`self-start`) so it never pushes into the title lane; on `< sm`, promote it to a full-width row below the title using `sm:col-start-2` / stacked layout.

### 2. Eyebrow → meta chip row

- Keep a single short eyebrow: `Threat briefing` (or `Threat · {name}` when scrolled).
- Replace the mono run-on line with a discrete chip row rendered under the title:
  - Threat type chip (colored dot + label from `threat-presets`)
  - Severity chip with a mini bar (`Severity 50%` + 3px bar)
  - Horizon chip (`5y horizon`)
  - Onset chip (`Immediate` / `Phased` — human label, not enum)
- Chips use `border border-line-200 px-2 py-0.5 font-mono text-[10px]` — same visual family already established, but grouped and legible.

### 3. Overflow pattern reused across the workbench

Audit the same-turn siblings for the identical "silently clips" bug and apply the pattern already introduced (`ReadMore` + `min-w-0` + wrapping):
- `ResilienceActionsRail` action label `<input>` — allow wrap or add `title={a.label}` tooltip.
- `StagingTimeline` timeline chips — wrap sector/action label with `ReadMore` at `clamp={1}`.
- `ExposureLedger` (already done last turn — verify no regression after grid changes).

### 4. Rhythm + spacing

- Stepper: keep, but add `mb-2` and a hairline `border-b border-line-200/60` below to separate it from the header block.
- Header block: wrap in a `<header className="space-y-3 pb-6 border-b border-line-200">` so the document feel is explicit, and the following canvas breathes.
- Increase gap between header and grid from `space-y-6` to `space-y-8` on `lg+`.

### 5. Micro polish

- Focus ring on the title uses `focus-visible:ring-1 focus-visible:ring-ink-950/20` instead of the current border swap (cleaner, no layout shift).
- CTA button: add `whitespace-nowrap` so "Modelling…" never wraps.
- Add `aria-label="Rename strategy"` to the title editor.

## Technical notes

Files touched:
- `src/routes/_authenticated/admin/countries.$code.studio.threats.$id.tsx` — header JSX rebuild only (no data/behavior changes).
- `src/components/studio/threat-presets.ts` — add a small helper `onsetLabel(onset)` and `threatTypeChip(type)` returning `{ label, dotColor }` if not already present.
- `src/components/studio/ResilienceActionsRail.tsx` — add `title={a.label}` fallback + `min-w-0` on the label input's flex parent.
- `src/components/studio/StagingTimeline.tsx` — wrap chip label with `ReadMore` (already imported pattern).

No new dependencies. No server-function changes. No data-shape changes. Purely presentation.

## Out of scope

- Overall Chamber 04 flow (Threat Composer, Stress Test panel) — this plan targets the header + overflow issues visible in the attached screenshot.
- Any color/token changes — the existing paper/ink/line tokens are correct for the gov register.
