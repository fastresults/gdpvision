## What actually happened

You saw:
> `A ministry_deep_dive run is already in progress for VCT. Refresh to see live progress; stale runs auto-clear when their heartbeat is quiet for 45 minutes.`

Root cause (verified in `src/lib/country-onboarding/corpus.functions.ts` and `orchestrator.functions.ts`):

1. Every stage acquires a per-country lock via a unique constraint on open `onboarding_runs`. `openRun` throws `23505` → the human-readable "already in progress" message (line 88).
2. **The message and the actual cleanup are inconsistent.** The message says "45 minutes"; the sweeper (`clearStaleRuns`, line 48) uses **8 minutes**.
3. **The sweeper only runs from the orchestrator's `nextAction`, not from `planMinistryDeepDive`.** If a previous Stage 9 run died mid-loop (browser closed, "Failed to fetch" before the last turn's retry landed, tab throttled), the row sits in `planning`/`resolving` and blocks the next attempt until you happen to trigger the orchestrator path.
4. **Stage 9 is now item-based and fully resumable** (rows in `ministry_deep_dive_items` with `pending` / `done` / `failed`). Throwing on the existing run wastes that work — a resume is trivially safe. Right now we don't take advantage of it.
5. `runAllPending` in the onboard page treats "already in progress" as a hard stop, so the sequential run halts on a condition that is actually recoverable.

## Improvement principle

Every recurring error should either (a) auto-recover on the next attempt or (b) collapse to a one-click operator action — never require waiting out a 45-minute timer. Apply that principle here.

## Plan

### 1. Stage 9 becomes resume-first, not lock-first
In `planMinistryDeepDive`:
- Before calling `openRun`, look for an existing non-terminal `onboarding_runs` row for `(country, ministry_deep_dive)`.
- If found and it has `ministry_deep_dive_items` rows:
  - Reset any `running` items back to `pending` (previous resolver crashed mid-call).
  - Touch `updated_at` so the sweeper won't clobber it while the client loop is active.
  - Return `{ runId, total }` from the existing run — the client loop picks up exactly where it stopped.
- Only if no items exist (truly a stillborn plan), delete the empty run row and open a fresh one.

This turns "already in progress" from a blocker into a resume, and preserves every ministry already resolved.

### 2. Unify the stale-run window and honor it at lock time
- Add `clearStaleRuns(admin, countryCode, stage)` (single-stage variant) and call it inside `openRun` right before insert, so every stage self-heals its own stale lock instead of waiting for the orchestrator.
- Move the timeout to one constant `STALE_RUN_MS` in a shared file and use it everywhere (`orchestrator.functions.ts` and the error message in `corpus.functions.ts`). Set it to **10 minutes** — long enough for a legitimate stage-9 ministry to finish, short enough that a dead tab doesn't strand the country.
- The user-visible error message reads the same constant, so the "45 minutes" / "8 minutes" drift can never happen again.

### 3. `runAllPending` treats the lock as recoverable
In `src/routes/_authenticated/admin/countries.$code.onboard.tsx` (`runAllPending`):
- Detect the "already in progress" error class (match on the error tag we throw, not the string).
- On that class, wait ~5s and retry the same stage once. With change #1 the second call adopts the existing run and the sequential pipeline keeps flowing.
- Only surface the red banner if the retry also fails.

### 4. Client loop pings a heartbeat while resolving
`runMinistryDeepDiveFlow` (client) already loops one HTTP call per ministry. Add a lightweight heartbeat: each `resolveNext` server call already writes `updated_at` via `updateRunPlan`. Confirm that path fires even when an item marks itself `failed`, and add a heartbeat write from `planMinistryDeepDive` too, so a resumed run's `updated_at` is fresh the moment the loop restarts.

### 5. Operator escape hatch on the banner
The current "Stage failure" banner just says "Dismiss / Open stage." Add a third link **"Clear stuck lock"** that calls a small server function `clearStageLock({ countryCode, stage })`. Super-admin only, marks any open run for that stage as `stale`, and refreshes. This is the manual fallback the user asked for after the KPI-7 wait — no more sitting for minutes.

## Files to change (technical detail)

- `src/lib/country-onboarding/orchestrator.functions.ts` — export `STALE_RUN_MS`, add `clearStaleStageRuns(admin, countryCode, stage)`, tighten to 10 min.
- `src/lib/country-onboarding/corpus.functions.ts` — `openRun` calls the single-stage sweeper first; `planMinistryDeepDive` adopts an existing run with items; new `clearStageLock` server fn; error message reads the shared constant. Throw a tagged error (`err.code = "RUN_LOCKED"`) so the client can branch.
- `src/routes/_authenticated/admin/countries.$code.onboard.tsx` — `runAllPending` retries once on `RUN_LOCKED`; banner adds "Clear stuck lock" action wired to `clearStageLock`.

No database migration needed — `ministry_deep_dive_items` and `onboarding_runs` already carry the fields we need.

## What "improving each onboarding" looks like after this

- A stuck Stage 9 self-heals in ≤10 min without you touching anything.
- Re-running the stage from the UI now resumes; you never lose the ministries already resolved.
- Run-All-Pending survives the exact class of error you just hit without operator intervention.
- If you ever need to force it, one click on the banner clears the lock — no waiting.
- Same pattern (resume-on-lock + shared stale window + one-click clear) can be applied to Stage 10 / 12 next; this plan lays the reusable primitives.