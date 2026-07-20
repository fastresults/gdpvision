
# Stage 02 · Full auto-run (AI-first, zero-click)

## Problem observed
Stage 02 today is only *half* auto-run: the AI proposes segments on entry, but the user must still click "Accept & cast" or "Accept all", then manually navigate to Stage 03. That breaks the auto-run promise the rest of the studio makes.

## Goal
When a user lands on Stage 02 with personas cast and no segments yet, the studio should:
1. compose segments from brief + cast (already happening),
2. auto-cast them in sequence,
3. mark the stage complete and gently hand off to Stage 03 — all without a click.

The manual composer and "Advanced" disclosure stay, but demoted. Users can still stop, dismiss, or regenerate at any time.

## UX contract

- **Auto-run banner** at top of Stage 02:
  `Auto · drafting segments → casting → handing off to Rehearse`
  Shows live phase: *Proposing… → Casting 2 of 3 · "Coastal tourism operators" → Ready · advancing to Rehearse in 3s*.
- **Cancel Auto-run** button in the banner — pauses the loop, keeps whatever was already cast, and reveals the existing "Accept / Dismiss" per-proposal buttons for manual control.
- **Auto-advance to Stage 03** once all accepted segments finish casting AND at least one segment exists. Uses a 3-second countdown the user can cancel (`Stay here`).
- Re-entering Stage 02 with segments already present does *not* re-fire auto-run (idempotent). A `Regenerate` button remains for explicit re-runs.
- Manual composer stays behind the existing `<details>` disclosure. Nothing removed.

## Implementation

### `src/routes/_authenticated/admin/countries.$code.personas.segments.tsx`
- Add an auto-run state machine (client-only, in the page component):
  `idle → proposing → casting(index) → done → advancing → complete` plus `paused` and `error`.
- Trigger transitions:
  - mount + personas>0 + segments=0 + proposals=0 → `proposing` (calls existing `composeSegments`).
  - `composeSegments` success → auto-start `casting(0)`; sequentially `await gen.mutateAsync(...)` per proposal (reuse existing `acceptProposal` logic, refactored into a shared `castOne(p)` helper).
  - all cast → `advancing` (3s countdown) → `navigate({ to: "/admin/countries/$code/personas/studies", params: { code } })`.
- `Cancel Auto-run` sets state to `paused`; existing per-item buttons remain the fallback.
- `Regenerate` and manual accept both cancel the auto-run loop so user actions win.
- Persist a per-draft "auto-run consumed" flag in `localStorage` keyed by `code` so refreshing the page after completion does not re-trigger. (No schema change; this is a session convenience only.)

### `src/components/personas/StudioStepper.tsx`
- Add an optional `hint` next to the active stage: when Stage 02's auto-run is running, show `Auto-running` chip; when complete, show `Advancing → Rehearse`. Small addition, no structural change.

### Error handling
- If `composeSegments` returns `{ ok: false }` or throws, state → `error`; show existing error UI and *do not* auto-retry. User can hit `Regenerate` or `Cancel Auto-run` to compose manually.
- If any single `gen.mutateAsync` throws, state → `paused` with an inline notice `"Casting paused on 'X' — resume or dismiss below"`. Remaining proposals stay visible for manual accept.

## Non-goals
- No changes to server functions (`composeSegments`, `generateSegment`) — behavior is purely on the Stage 02 route.
- No change to the auto-run wizard (`autorun.functions.ts`) — that pipeline (brief→outcome→cast→commit→synthesis) already covers segments as part of the `cast` phase's `cast_draft`. This plan is specifically for the *manual studio journey* (Cast/Group/Rehearse pages) which the user is currently on.
- No new tables, columns, or RLS changes.

## Acceptance
- Land on `/admin/countries/{code}/personas/segments` with personas cast and no segments → within ~30–60s the page shows N segments cast and auto-navigates to `/personas/studies` after a 3s countdown, no clicks required.
- Clicking `Cancel Auto-run` at any point leaves the studio in a clean manual state with whatever was already cast.
- Refreshing the segments page after completion does not re-fire auto-run.
