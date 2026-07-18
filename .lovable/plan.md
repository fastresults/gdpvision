
## Goal

While the user drags sliders in Step 3/4, make it visually obvious — every frame — whether the levers are (a) still short of the baseline gap, (b) exactly compensating, or (c) surpassing baseline into surplus, and by how much across the stated horizon.

Today the fan chart shows a levered path plus a ghost of the last path, but there is no explicit reference against the do-nothing baseline, no cumulative "net revenue" readout, and no threshold marker for break-even.

## What the user will see

Two new tightly-coupled UI elements sitting directly under the GDP fan chart, both driven by the local engine so they update at 60fps with slider drags:

1. **Compensation Ledger strip** — a single horizontal band showing cumulative Δ GDP (levered − baseline) across each horizon year, tinted deficit-red below zero and surplus-green above, with a bold zero break-even line. A large numeric callout on the right reads:
   - `Gap closed: 62%` while still in deficit,
   - `Break-even Y3` at the crossover year,
   - `+1.8 pp surplus by Y5` once surpassing.
2. **Baseline-vs-levered overlay on the fan chart** — draw the flat baseline P50 as a second dashed line (distinct from the "previous drag" ghost) and shade the area between baseline and levered P50: red where levered < baseline, green where levered ≥ baseline. The chart legend gains three swatches (Baseline, Levered, Ghost).

A compact status pill above the ledger states the current regime in plain language: *"Levers offsetting deficit"*, *"At break-even"*, or *"Net surplus vs. baseline"*, with the crossover year when applicable.

## How it computes

Purely client-side, reusing the existing `runLocalEngine` output so nothing new hits the server:

- **Baseline path**: already available as `init.output.gdpGrowthPath` (levers at default). Cache once.
- **Levered path**: `current.output.gdpGrowthPath` (recomputed on every slider change).
- **Per-year delta**: `levered.p50[i] - baseline.p50[i]`.
- **Cumulative delta**: running sum of per-year deltas (pp·years — treated as the "net revenue picture" proxy since v1_macro is GDP-growth based).
- **Break-even year**: first `i` where cumulative delta ≥ 0.
- **Gap-closed %**: `min(100, cumulative_levered / cumulative_baseline_shortfall * 100)` when still negative; `null` once surplus.

All derivations live in a small pure helper `src/lib/scenarios/compensation.ts` so the same numbers can later feed the saved artifact summary.

## Files

- **New** `src/lib/scenarios/compensation.ts` — `computeCompensation(baselinePath, leveredPath)` returning `{ perYear, cumulative, breakEvenYear, regime, gapClosedPct, surplusEndPp }`.
- **New** `src/components/scenarios/CompensationLedger.tsx` — the strip + numeric callout + regime pill; pure presentational, takes the helper's output.
- **Edit** `src/components/scenarios/GdpFanChart.tsx` — accept optional `baselinePath` prop; when provided, render dashed baseline line and shade the area between baseline P50 and levered P50 with red/green split at the crossover. Keep existing `ghostPath` behavior untouched.
- **Edit** `src/routes/_authenticated/admin/countries.$code.scenarios.new.tsx` — compute `baselinePath` once from `init`, pass to `GdpFanChart`, and mount `<CompensationLedger />` immediately below the fan chart inside Step 3 and Step 4 panes.
- **Edit** `src/components/scenarios/StatStrip.tsx` (light) — add a fourth tile "Net vs baseline" showing cumulative pp and break-even year, so the top-of-canvas KPIs stay in sync with the ledger.

## Interaction & polish

- 60fps: everything derives from the already-local engine output; no queries, no effects beyond `useMemo`.
- Colors reuse existing semantic tokens (`--sector-*` for surplus, muted red token for deficit) — no hardcoded hex.
- Accessible: numeric callouts use tabular-nums, regime pill has an `aria-live="polite"` region so screen readers announce crossover transitions.
- Empty/edge cases: when levered ≡ baseline (all sliders at default), ledger shows a neutral "At baseline — move a lever to see compensation" hint instead of a flat green bar.

## Out of scope

- No server-side changes, no schema changes, no changes to saved scenario artifacts (can be a follow-up so archived scenarios also render the ledger).
- Attribution waterfall and sector impact list are unchanged.
