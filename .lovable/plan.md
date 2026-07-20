## Problem

Stage 02 auto-runs proposing/casting segments, but when the user lands on Stage 03 (Rehearse) with 5 existing segments (Grenada), nothing fires. The user still has to click "Study →" on each row. That violates the AI-first / auto-run mandate — the instrument should draft a study for every uncovered segment automatically, then hand back a review queue.

## Goal

On entering Stage 03 (or at the tail of Stage 02's auto-run handoff), the Studio must automatically:
1. Detect segments without a study.
2. Sequentially compose + launch a draft study for each.
3. Show live "Studying 2 of 5 · <segment>" progress in the header and on the stepper's Rehearse node.
4. Stop cleanly at the end with a review list; never block, never require a click to start.

## Plan

### 1. Server — bulk study composer (`src/lib/personas/compose-study.functions.ts`)
- Add `composeStudiesForUncoveredSegments({ countryCode })`:
  - Query `persona_segments` for `country_code`.
  - Left-join / filter against `persona_studies` to find segments with **no study**.
  - Return an ordered list `[{ segmentId, label, prompt, size }]`.
- Keep existing single-segment `composeStudy` untouched; reuse it per segment inside the client loop for idempotency and per-item retry.

### 2. Stage 03 route — auto-run state machine (`src/routes/_authenticated/admin/countries.$code.personas.studies.tsx`)
Mirror the Stage 02 pattern exactly so behavior is consistent:
- States: `idle → composing → studying(i/n) → complete | cancelled | error`.
- On mount, if `uncovered.length > 0` AND `localStorage[`ch07:auto-studies:${code}`]` is not set:
  - Set flag, fetch uncovered, transition to `studying`.
  - For each segment in sequence: call `composeStudy` → `createStudy` (existing wizard fn) with the AI-proposed framing; mark that segment as done in local state; heartbeat between items so the UI paints.
- Never re-fire if flag exists; a "↻ Run again" button clears the flag and re-runs only against still-uncovered segments.
- Provide `⏸ Cancel Auto-run` and `Stay here` escape hatches identical to Stage 02.

### 3. Header CTA + coach line
- Add a header banner on the Studies page identical in shape to Stage 02:
  - Primary CTA: `▶ Start Auto-run` (when idle + uncovered > 0) / `⏸ Cancel Auto-run` (while running) / `↻ Run again` (when complete).
  - Coach line: "AI will draft a study for each segment without one. You review before sending."
- Row-level: while auto-run is active, show a spinner + `AUTO · drafting…` chip on the segment currently being studied, and a subtle `queued` chip on pending ones.

### 4. Stepper status
- Extend `StudioStepper` `autoStatus` prop to also accept a Rehearse status (`AUTO · drafting 2/5`), and pass it from Stage 03. The Group node keeps its existing chip.

### 5. Handoff from Stage 02
- When Stage 02's 3-second countdown completes and navigates to `/personas/studies`, Stage 03's mount effect picks up and starts auto-run immediately — one continuous Cast → Group → Rehearse ribbon with no user click.

### 6. Guardrails
- Per-item try/catch: a failed segment marks `error` on that row and continues; final banner reports `4 drafted · 1 failed — Retry failed`.
- Rate-limit / 429 from Gateway pauses the loop 8s and retries once before marking failed.
- Never auto-**send** a study — auto-run stops at "draft ready for review" to preserve human oversight on outreach.

## Files touched
- `src/lib/personas/compose-study.functions.ts` — add bulk uncovered-segment composer.
- `src/routes/_authenticated/admin/countries.$code.personas.studies.tsx` — add auto-run state machine, header CTA, row chips, localStorage guard.
- `src/components/personas/StudioStepper.tsx` — accept Rehearse `autoStatus`.
- `src/routes/_authenticated/admin/countries.$code.personas.segments.tsx` — pass through so the auto-nav handoff sets a "start immediately" hint (query param `?auto=1`) that Stage 03 respects even if the localStorage flag was cleared.

## Out of scope
- Actually sending studies to real respondents.
- Changing the underlying study schema or wizard steps.
