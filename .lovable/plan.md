# Mandate Compact: visible progress across the 8 steps

## What the logs show
- No errors. The last session read the manifesto (Step 01 extract, then ingest) and both calls came back successfully. Nothing crashed or timed out.
- Antigua has one compact, still **Draft**, with 4 pillars and 9 deliverables from July. The new manifesto was ingested, but Decompose and Transform haven't been run again since.
- The real problem is the page itself:
  - The 8-step bar at the top shows only which step you're viewing. It has no done / in progress / waiting / blocked states.
  - Nothing moves you on after a step finishes. You have to click the next number yourself.
  - The two AI steps (Decompose and Transform) are a single long call each, 30 to 90 seconds or more. All you see is a spinner on the button, and it disappears if you switch steps or refresh. That's why it looks stalled.
  - Nothing is recorded in the database while a step runs, so after a refresh there's no way to tell whether it's still running or has failed.

## What you'll see after the fix
1. **A status on every step:** each number shows Done (with a tick), Running (animated), Ready, Blocked (with the reason, e.g. "Run Decompose first") or Out of date (e.g. a new manifesto has arrived since Decompose last ran). These are worked out from real data: pillars, pledges, deliverables, scorecards and the compact's status.
2. **A live progress card for the AI steps:** named stages ("Reading manifesto", "Asking AI", "Checking pledges", "Saving pillars"), time elapsed, and what the step produced so far. It keeps running if you switch steps or refresh, and picks the run back up when you return.
3. **Stall detection:** if a run makes no progress for 3 minutes, it's marked as stalled. You get **Retry** and **See details** buttons with a plain-language reason.
4. **Next step:** when a step finishes, a "Continue to Step 03 · Transform" button appears. The step you're on is also saved in the page address, so Back and refresh keep your place.
5. **"Run remaining AI steps":** runs Decompose, then Transform, in one go, showing progress for each. It always stops before Publish, which stays a person's decision.

## Technical details
- Migration: new `compact_runs` table (compact_id, country_code, step, status queued/running/succeeded/failed/stalled, stage, stage_detail, started_at, heartbeat_at, finished_at, error, result jsonb) with GRANTs, RLS through `has_country_access`, and admin policies.
- Decompose and Transform: split into `startDecompose` / `startTransform` server functions that create a run row and return its id right away. The work continues in the handler, updating `stage` and `heartbeat_at` as it goes and writing the result or error at the end. Writes stay idempotent, as they are now.
- New `getCompactProgress(compactId)`: returns each step's derived state plus the latest run for each. The page polls it every 2 seconds while a run is active and every 30 seconds otherwise. Stalled means running with no heartbeat for 3 minutes or more.
- `Stepper` renders the state badges. `activeStep` moves to `useUrlState("step", "ingest")`. New `RunProgressCard` component.
- Explain rationales for step states and stall rules go in `src/lib/explain/mandate-compact-entries.ts`.
- Run `bun run headers && bun run map` and update the chamber map.

## Validation
On Antigua: run Decompose, refresh halfway through and confirm progress resumes. Run Transform, then confirm the steps show Done and the next-step button works. Force an error and confirm Failed shows with Retry.
