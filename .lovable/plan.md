## Goal

Any number, assumption or AI-generated output a user might question can be interrogated in place: hover for a one-line rationale, click for a modal that shows the full derivation — inputs, coefficient, formula, the actual arithmetic with the user's own values, and the caveat.

## The primitive: `<Explain>`

One component, used everywhere. Wraps a figure or label and adds a subtle dotted underline plus a small superscript mark (no clutter, no icon soup).

```text
  US$41.2 m ˟          <- hover: "Year-three uplift, soft-capped at 1.2% of GDP."
      |                   click / tap / Enter: opens Rationale modal
      v
  ┌──────────────────────────────────────────┐
  │ WHAT THIS IS      one sentence, plain     │
  │ HOW IT IS DERIVED formula, stated         │
  │ WITH YOUR NUMBERS 3–6 substituted lines   │
  │ WHY WE BELIEVE IT basis / source          │
  │ WHAT WOULD CHANGE IT  the caveat          │
  └──────────────────────────────────────────┘
```

Behaviour:
- Desktop: hover/focus opens a compact popover (existing `hover-card`) after ~150ms with the short rationale and a "See the full derivation →" link.
- Touch/mobile: no hover; tap opens the modal directly (existing `dialog`, full-height sheet under `sm`).
- Keyboard: the trigger is a real `<button>`, focusable, `aria-describedby` the short text.
- Print: the marks and popovers are hidden; nothing leaks into the PDF.

## The content layer: a rationale registry

New `src/lib/explain/registry.ts` — a keyed map of rationale entries, so copy lives in one auditable place rather than scattered across JSX.

```ts
type Rationale = {
  key: string;              // "calc.uplift", "calc.pool.latency", "calc.chamber.04"
  title: string;
  short: string;            // hover line
  formula?: string;         // stated in words + symbols
  basis?: string;           // where the coefficient comes from
  caveat?: string;          // what would change it
  derive?: (ctx) => Array<{ label: string; value: string; note?: string }>;
};
```

`derive` receives the live `ValueResult` + `ValueInput`, so "with your numbers" is always the user's actual run, not a generic example. Reuses `formatUsd`/`formatUsdExact` from `model.ts`; no duplicate math — every line reads from `result.trace`, which already carries pools, ceiling, ramp, per-chamber draws and cost rules.

## Coverage in the calculator (phase 1)

- **Verdict rail**: modelled uplift, pp of GDP, return multiple, payback, cost/yr, the three-year path bars.
- **Framing questions**: each of the 4 questions gets the "why we ask this / what it feeds" rationale (which pool it fills).
- **Chamber sliders**: each of the 8 — mechanism, which pools it draws, recoverable share, why that share.
- **Waterfall bars**: per-chamber contribution and its share of total.
- **Stance selector**: what conservative/central/optimistic multiply and why 0.6 / 1.0 / 1.45.
- **The ceiling**: the single most-questioned assumption — the 1.2%-of-GDP soft cap gets its own full entry explaining the softCap curve and why the ceiling protects the argument.
- **Country preset**: flags that GDP / public-spend / sector-share seeds are order-of-magnitude reference points, all editable.
- **AI Counsel panel**: a rationale on the panel header stating what the model was given (the trace, not the web), that it interprets rather than computes, and that no number in the verdict comes from the model.

The existing "Open the arithmetic" drawer stays as the full machine-readable trace; `<Explain>` is the human layer above it, and each modal ends with a "See full trace" link that opens the drawer.

## Rollout beyond the calculator (phase 2)

The same primitive is then applied to the surfaces where derived figures already exist, using the same registry namespacing:
- Executive Brief / dashboard figures and ranked alerts (`explain` on each verdict number, pointing at the ledger provenance already stored).
- Scenario Engine projections (levers → GDP path).
- FDI Studio scoring, sector dossier scores.
- Onboarding stage outputs that carry citations — the modal renders `<PrettyJson>` with the ordered `citations` array so refs stay clickable (existing global rule).

Phase 2 lands as wiring only: no new math, each call site supplies a key plus its context object.

## Technical notes

- New files: `src/lib/explain/registry.ts`, `src/lib/explain/calculator-entries.ts`, `src/components/explain/Explain.tsx`, `src/components/explain/RationaleModal.tsx`.
- Built on existing shadcn `hover-card` and `dialog`; no new dependencies.
- Styling stays inside the paper voice: mono micro-labels, serif figures, `line-200` rules, `btn-ghost` triggers — no coloured tooltips, no inline `bg-ink-*` on buttons (button contract).
- Any JSON shown inside a modal renders through `<PrettyJson>`.
- `<Explain>` renders as plain text when `print:` — `PrintableValueCase.tsx` is unaffected.
- Modal content is pure client-side; no server calls, so hovering never costs a request.
