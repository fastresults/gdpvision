## What's broken

For **Project Destiny (KNA)** the workspace shows `0/0 studies · 0 segments` and the Rehearse page renders the old "Start with a segment" empty state. There's no visible AI recommendation on Cast / Group / Rehearse — because those three routes still render their own manual wizards, and the AI Blueprint page (`/blueprint`) is a separate stop that this project never reached (or was skipped past via the stepper).

Result: the admin lands on Rehearse with nothing to do and no path back to the AI recommendations.

## Root cause

1. `useProgramBriefGate` exposes `blueprintCommitted`, but the three downstream routes (`index.tsx` / `segments.tsx` / `studies.tsx`) don't gate on it. They fall through to their legacy manual UIs when segments/studies are empty.
2. `StudioStepper` still ships all 5 stages; Cast/Group/Rehearse are click-through even when blueprint isn't committed — the disabled styling is not being applied for this project (the "locked" tiles are visually there but the intake link on Rehearse was still reachable via direct URL / prior nav).
3. `ProgramsIndex` "Continue" on a project without a committed blueprint should hard-route to `/blueprint`, not to studies.

## Plan — force the AI Blueprint to be the single guided cockpit

### 1. Route-level gate for Cast / Group / Rehearse

In all three route components — `countries.$code.personas.index.tsx`, `…segments.tsx`, `…studies.tsx` — after resolving `activeProjectId` and `briefGate`, add:

```
if (activeProjectId && briefGate.committed && !briefGate.blueprintCommitted) {
  return <Navigate to="/admin/countries/$code/personas/blueprint"
                   params={{ code }}
                   search={{ project: activeProjectId, open: 1 }} replace />;
}
```

So the moment a program has a brief but no approved blueprint, every downstream page bounces to Blueprint. No more empty "Start with a segment" screens.

### 2. Programs Index "Continue" routing

In `ProgramsIndex.tsx`, when a row has `brief_committed_at` but no `blueprint_committed_at`, the primary CTA and row-click both link to `/blueprint` (not `/studies`). Row label: `NEEDS BLUEPRINT`.

### 3. Stepper: hard-lock downstream tiles

Already partially done. Confirm `StudioStepper` renders Cast/Group/Rehearse with `locked=true` when `!blueprintCommitted` and that the onClick preventDefault is honored. Add a short "Approve the blueprint to unlock" tooltip via `title=` on locked tiles so the admin understands why they can't click.

### 4. Auto-open Blueprint after Brief commit (verify)

`ProgramBriefIntake` already navigates to `/blueprint` on commit — leave as is, just confirm nothing intercepts.

### 5. Empty-state fallback (belt-and-braces)

Inside the studies route's `activeProjectId && segments.length === 0` branch, replace the current "Start with a segment" card with a clear callout:
- Icon + headline: "Your research plan isn't approved yet."
- Body: "The AI drafts your segments and studies from the brief. Review and approve to populate this workspace."
- Primary button → `/blueprint?project=…&open=1`.

Mirror the same callout on `index.tsx` (Cast) and `segments.tsx` (Group).

### Files to touch

- `src/routes/_authenticated/admin/countries.$code.personas.index.tsx`
- `src/routes/_authenticated/admin/countries.$code.personas.segments.tsx`
- `src/routes/_authenticated/admin/countries.$code.personas.studies.tsx`
- `src/components/personas/StudyWizard/ProgramsIndex.tsx`
- `src/components/personas/StudioStepper.tsx` (tooltip only)

No DB / server-fn changes. No behavior change for programs that already have committed blueprints — their Cast/Group/Rehearse UIs remain untouched.

### Verify

1. Open Project Destiny → land on `/studies` → auto-redirect to `/blueprint`. Confirm.
2. Generate blueprint → Approve & run → segments cast → auto-navigate to `/studies` populated.
3. Existing legacy program (blueprint pre-committed) still opens Cast/Group/Rehearse directly.
