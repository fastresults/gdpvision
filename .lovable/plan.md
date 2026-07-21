## Problem

Selecting a project from the switcher dropdown navigates to Chamber 07's Studies (Stage 03) route — and that route auto-starts a full synthesis pipeline on landing whenever any study is incomplete. Same pattern on Segments (Stage 02): it auto-fires on mount when the state looks "eligible." So merely *opening* a project is indistinguishable from *saying go*.

Root cause (verified in code):

- `src/routes/_authenticated/admin/countries.$code.personas.studies.tsx` ~L373–387: a mount `useEffect` calls `startAutoRun()` whenever anything is incomplete, gated only by a per-mount ref.
- `src/routes/_authenticated/admin/countries.$code.personas.segments.tsx` ~L329–344: a mount `useEffect` calls `runAuto()` whenever there are personas and no segments yet, gated only by a `localStorage` "consumed" flag.

Neither gate checks user intent. Switching projects remounts the route → auto-run fires again.

## Fix — require explicit intent to auto-run

Treat auto-run as a user action, not a side effect of navigation. Loading a project should only *load and display* its current state.

### Stage 03 (Studies) — `countries.$code.personas.studies.tsx`

- Remove the "defensive auto-run on landing" `useEffect` (L373–387). Landing never starts work.
- Only auto-start when the route is entered with an explicit intent signal:
  - the existing `?auto=1` search param (already used by "Create study" and by the Stage 02 handoff), OR
  - a one-shot intent key written to `sessionStorage` by an explicit CTA (e.g. `stage03:intent:<code>:<projectId>`), consumed on mount.
- After consuming the intent, strip `?auto=1` from the URL so a browser refresh or re-navigation does not re-trigger.
- Render a clear resume state when incomplete work exists but no intent was given: an inline banner "N studies incomplete" with a primary "Resume auto-run" button that sets the intent and calls `startAutoRun()`. The existing Stop control stays.

### Stage 02 (Segments) — `countries.$code.personas.segments.tsx`

- Remove the mount auto-fire (L329–344).
- Same intent model: only run when `?auto=1` is present or a one-shot `sessionStorage` intent was set by an explicit CTA (the existing "Start auto-run" button, and the Stage 02 handoff from a "New program" creation).
- Keep the existing manual CTAs ("Start auto-run", "Accept all", "Regenerate") — those already represent explicit intent and continue to work unchanged.

### Project switcher — `src/components/personas/StudyWizard/ProjectSwitcher.tsx`

- When the user picks a project from the dropdown, navigate to the target route **without** `?auto=1` and **without** writing the intent key. Loading a project is a read-only action.
- "New program" (creation flow) is the one place that should still set intent so a freshly created project runs end-to-end — keep that path as-is.

### Beacon interaction

- If a run is already active for the country/project (beacon shows running), do not start a second one on landing even if intent is present — the beacon's existing dedupe already covers this; just confirm the intent-consumer respects it.

## What stays the same

- All auto-run engines (`study-autorun.ts`, `compose-segments`, synthesis phases) are unchanged.
- The global beacon, Stop-all, and Resume controls are unchanged.
- Backfill jobs and other admin flows are untouched.

## Acceptance

- Switching between existing projects via the dropdown never starts synthesis, casting, or drafting — the page renders current state only.
- The only ways auto-run starts are: clicking a visible CTA ("Start auto-run", "Resume auto-run", "New program"), or arriving via a link that carries `?auto=1` from one of those CTAs.
- Refreshing a Studies/Segments page never restarts auto-run.
- Incomplete-work states show a clear inline "Resume auto-run" button instead of silently starting.
