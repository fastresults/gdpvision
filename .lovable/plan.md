## Goal

Make the floating **Auto-run in progress** card self-diagnosing: the user always sees whether the run is actually healthy, and if it stalls the beacon quietly repairs and resumes it — no manual clicks.

Scope is UI + a small client-side watchdog in the beacon layer. No schema changes, no server-function changes.

## What changes in the UI (the attached card)

Extend `AutoRunEntry` and the `RunRow` in `src/components/autorun/AutoRunBeacon.tsx` with a **health chip** rendered under the title:

- `Healthy` — progress moved within the last ~30s. Small ink dot.
- `Slow` — no progress for 30–90s. Amber dot, subtitle "Still working…".
- `Stalled` — no progress for 90s+. Amber ring + subtitle "Stalled — auto-resuming…". A resume attempt kicks off automatically.
- `Recovering` — after a stall, while the auto-fix tick is in flight. Spinner + "Resuming step N".
- `Broken` — 2 consecutive resume attempts failed. Rose ring + "Couldn't auto-resume" and a **Retry now** button (manual escape hatch).

Also add, next to `Open →`:

- **Resume** button — visible on `stalled`/`broken`. Fires the same resume the watchdog uses.
- Health is always visible; the existing progress bar and `Open →` link stay.

## What changes underneath

Small additions in `src/lib/autorun/beacon.ts` — no new files:

- Extend `AutoRunEntry` with:
  - `lastProgressAt: number` — updated automatically whenever `progress.current` or `detail` changes on a `publishAutoRun` call.
  - `health: 'healthy' | 'slow' | 'stalled' | 'recovering' | 'broken'` — derived, stored so the UI reads a single field.
  - `resumeAttempts: number` and `lastResumeAt: number`.
  - Optional `resume?: () => Promise<void>` — publishers register a resume callback (see below).
- New helper `registerAutoRunResume(id, fn)` that stores the resume fn on the entry.
- Watchdog: `useAutoRuns()` runs a `setInterval(1000)` (guarded so only one interval exists) that recomputes `health` and, when an entry crosses into `stalled` and has a `resume` fn and `resumeAttempts < 2`, invokes it, flips health to `recovering`, and bumps `resumeAttempts`. If the next progress tick lands, health returns to `healthy` and `resumeAttempts` resets. If two attempts pass without progress, health becomes `broken`.

## Wiring the two current publishers to the resume path

Both are trivial one-line additions — they already have the loop functions we need:

- `src/components/personas/StudyWizard/AutoRunConsole.tsx` — after `publishAutoRun(...)` in the existing effect, call `registerAutoRunResume(id, () => tickLoop())`. `tickLoop` is already idempotent and lock-guarded server-side.
- `src/routes/_authenticated/admin/countries.$code.personas.studies.tsx` — after publishing its beacon entry, register `() => startAutoRun()` (the existing Stage 03 pipeline entry point, which already runs behind `AUTO_STUDIES_LOCK` and calls `completeIncompleteStudies`, so re-entry is safe).
- Same one-liner in `src/routes/_authenticated/admin/countries.$code.personas.segments.tsx` (Stage 02) pointing at its `runAuto`.

If a publisher doesn't register a resume fn, the beacon still shows health but skips auto-resume and shows the manual **Retry now** button instead.

## Behaviour the user will see on the card in the screenshot

- Normal case: card shows `Healthy` under the title while progress ticks.
- The current GRD situation (4 running, 6 drafts idle behind a single lock): as soon as any study hasn't moved for 30s the chip flips to `Slow`, then at 90s to `Stalled — auto-resuming…` and the Stage 03 `startAutoRun` fires again. Because that call is idempotent and `completeIncompleteStudies` sweeps every non-synthesized study, the 6 stuck drafts + the 5h-stale runner get picked up automatically on the next tick.
- If two auto-resumes in a row produce no progress, the card turns rose with "Couldn't auto-resume" and a **Retry now** button — the user is never left wondering whether something broke.

## Out of scope

- No server-side heartbeat or DB timeout column (kept purely client-side per the request — "just add to this UI").
- No changes to any server functions or migrations.
- No changes to other chambers' beacons beyond the one-line `registerAutoRunResume` where a natural resume fn already exists.

## Files touched

- `src/lib/autorun/beacon.ts` — extend entry shape, add `registerAutoRunResume`, add watchdog interval.
- `src/components/autorun/AutoRunBeacon.tsx` — render health chip + Resume button; use new health field.
- `src/components/personas/StudyWizard/AutoRunConsole.tsx` — register resume.
- `src/routes/_authenticated/admin/countries.$code.personas.studies.tsx` — register resume.
- `src/routes/_authenticated/admin/countries.$code.personas.segments.tsx` — register resume.
