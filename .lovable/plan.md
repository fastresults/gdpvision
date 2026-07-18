# Chamber 03 — Live Lever Workbench

## What the PM sees today
- ATG has **0 rows in `public.levers`**, confirmed. Step 3 renders the "Synthesize levers with AI" empty-state, so no sliders exist to drag. Step 4 then reports "Top 3 movers · Levers at default · no attribution" — accurately, but it feels like a dead product.
- Plays in Step 2 are on/off chips only; the consequence of stacking a play is not visualised until the user leaves the step.
- Even where sliders exist (seeded countries), the engine call is debounced 250ms and routes to the server, so drag feels laggy rather than "cinema-real".

## Design principle
> **Drag → the future bends. Immediately.**

Every input in the chamber must produce a visible reaction on the right-hand canvas within one animation frame. Server calls are for *persistence*, never for *feedback*.

## The plan

### 1. Kill the empty state — one-click to drivable sliders
- When Step 2 lands on ATG (or any country with 0 levers), the "Synthesize levers with AI" CTA fires automatically the moment a play is stacked, pre-seeded with the play's thesis as `focus`.
- Show inline progress ("Composing 12 levers grounded in ATG sectors, KPIs, ministries…"). On commit, jump straight into Step 3 with sliders ready.
- Manual "Regenerate / add more" affordance stays for stewards.

### 2. Client-side engine for real-time preview
- `runEngine` in `src/lib/engine/v1_macro.ts` is already pure and deterministic. Import it directly on the client and recompute on every `input` event of a slider — no debounce, no network.
- The server `runScenarioEngine` call becomes a **commit-on-release** operation (mouseup / keyup) that persists the model_version, citations and canonical output. UI still shows the client-side projection during drag; server result reconciles on release.

### 3. Premium slider (LeverRow v2)
- Full-width track with:
  - Tick marks at `min`, `default`, `max` (labels underneath in tabular-nums).
  - A **baseline dot** at `default` and a **ghost dot** at the pre-drag value.
  - The active track fills from `default` → current value, colored by sector.
- Drag interactions: hover reveals a tooltip with unit, rationale, and clickable citations (from `levers.citations`).
- Right-hand chips (already there) upgraded to **three live chips**: `Δ lever`, `Δ Y1 GDP (pp)`, `Δ Exposure (pp)`.
- New **per-lever impact meter**: a thin horizontal bar under each row showing this lever's share of total |GDP Δ| — instant "which knob is doing the work".
- Keyboard: `←/→` nudges 0.5, `Shift+←/→` nudges 5, `0` returns to default, `L` toggles lock.

### 4. Canvas reacts in real time
- `GdpFanChart`: keep the dashed ghost baseline; add a **tweened P50 line** using `requestAnimationFrame` so the fan visibly "bends" as the user drags.
- `StatStrip`: values morph via a 120ms tween (no jump-cut). Colour flashes green/red on the changed cell.
- `SectorWaterfall`: bars grow/shrink live.
- `AttributionStack`: reorders + resizes live so the "top movers" ranking is visible mid-drag.
- Add a small **"Live · engine v1_macro" pulse** that flashes on each recompute.

### 5. Step 4 becomes interactive too
Replace the read-only "Top 3 movers" list with **sensitivity mini-sliders**: each of the top 3 attribution movers gets a compact slider inline in the brief. A PM can micro-tweak the assumption *from the summary page* and watch the fan update — no need to go back to Step 3.

### 6. Multi-play stacking preview in Step 2
When a play is toggled, briefly overlay the resulting fan curve on the mini-preview under Step 2 (200ms fade) so the *choice* of a play is itself an interactive consequence, not a leap of faith.

## Files to touch

**New**
- `src/lib/scenarios/local-engine.ts` — thin wrapper that calls `runEngine` from `v1_macro.ts` on the client with the same shape as the server fn.
- `src/components/scenarios/LeverRowV2.tsx` — premium slider row (replaces `LeverRow.tsx` usages in `GuidedRail`).
- `src/components/scenarios/ImpactMeter.tsx` — per-lever contribution bar.
- `src/components/scenarios/SensitivityMini.tsx` — Step-4 inline sliders.
- `src/hooks/useTweenedNumber.ts` — 120ms rAF tween for StatStrip cells.

**Edited**
- `src/routes/_authenticated/admin/countries.$code.scenarios.new.tsx` — swap `scheduleRun` for a **live client preview** + `commitOnRelease` server call; wire auto-synthesis after play toggle when levers=0.
- `src/components/scenarios/GuidedRail.tsx` — use `LeverRowV2`; add sensitivity mini-sliders block to Step 4; add mid-stack preview in Step 2.
- `src/components/scenarios/GdpFanChart.tsx` — rAF-tween the P50 line; keep ghost dash.
- `src/components/scenarios/StatStrip.tsx` — tweened numbers + flash-on-change.
- `src/components/scenarios/AttributionStack.tsx`, `SectorWaterfall.tsx` — accept the client-preview `output` and re-render each frame.

## Data / backend
- No schema changes. `levers.citations` already exists from the last turn; surfaced in the new tooltip.
- Server function `runScenarioEngine` unchanged — used only for commit and initial baseline.

## Out of scope (call out explicitly)
- Cross-country lever sharing.
- Persisting drag history (undo/redo) — considered but not in this pass; can layer on later.
- Changing the engine math itself (`v1_macro`).

## Acceptance
1. Open `/admin/countries/ATG/scenarios/new`, pick any play → levers auto-synthesize and Step 3 opens with 8–14 sliders.
2. Drag any slider → the fan chart bends within one frame; StatStrip numbers tween; sector waterfall reshapes.
3. Release the slider → a subtle "committed" pulse fires; server run reconciles.
4. Step 4 shows three inline mini-sliders bound to the top movers; dragging them updates the fan the same way.
5. Every slider row shows unit, tick labels, live Δ chips, and an impact-share meter.
