## What's wrong

Clicking **Brief** in the field rail does not show the brief. Confirmed by reading the code:

- `FieldStepper.tsx` (line 143) sends the Brief chip to `/admin/countries/$code/personas?project=…` — the chamber door, not a stage.
- `countries.$code.personas.index.tsx` (line 145) has a hard rule: if a field-track project's brief is already committed, it immediately `<Navigate>`s to `/personas/field/plan`.
- The brief editor (`ProgramBriefIntake`) renders there only when `gate.needsIntake` is true — i.e. only before the brief is committed.

So after commit, Brief bounces the user straight back to Programme. It looks like a dead tab.

Everything else is fine: `ProgramBriefIntake` already hydrates a committed brief, autosaves, and can re-commit — it just has nowhere to be shown.

## The fix

Make Brief a real stage on the field rail instead of a link back to the chamber door.

1. **Add `brief` to the stage route.** In `countries.$code.personas.field.$step.tsx`, accept `brief` as a valid step and render a `BriefStage` inside the same `StageFrame` every other stage uses — so it gets the breadcrumb, the "done when" card, the programme step counter and the footer grammar.

2. **Build `BriefStage`.** A thin wrapper in `src/components/personas/field/BriefStage.tsx` that renders `ProgramBriefIntake` through `StageWizard` under the existing `brief → commit` sub-step already registered in `field-substeps.ts`. When the brief is already committed it opens in amend mode: a short "Committed on <date>" line, the material and scope on view, and edits re-commit in place rather than pretending it is a first pass.

3. **Repoint the chip.** `FieldStepper` maps `brief` to the stage route (`{ code, step: "brief" }`) like every other node, keeping `?project=`.

4. **Leave the door redirect alone.** `/personas?project=…` still forwards a committed field programme to the rail — but now that lands on a rail where Brief is reachable, and the uncommitted-brief intake path at the chamber door is untouched, so first-run onboarding is unchanged.

5. **Continue action.** From Brief, the footer primary reads *Approve the programme material* and advances to Programme — matching the sub-step spec already in the registry.

## Technical notes

- Files: `src/routes/_authenticated/admin/countries.$code.personas.field.$step.tsx`, `src/components/personas/field/BriefStage.tsx` (new), `src/components/personas/FieldStepper.tsx`.
- `STEPS` in the route file gains `"brief"`; `FIELD_WORK_STAGES` in `field-stages.ts` (which currently slices `brief` off) stays as-is for progress maths and is not the rail's source of truth.
- No database or server-function changes; `getProjectBrief` / `saveProjectBrief` / `commitProjectBrief` already cover both first commit and amendment.
- Verification: typecheck, then drive the rail in a headless browser for a committed field programme and confirm `/personas/field/brief?project=…` renders the brief with its material, and that amending and re-committing keeps the downstream stages intact.
