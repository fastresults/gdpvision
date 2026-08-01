## What's actually happening

The wizard is live. `StageFrame` supplies the sub-step bus, and Brief, Programme, Participants, Instruments, Fieldwork and Evidence all render through `StageWizard` — chip rail, guidance card, single fixed footer. So the scaffolding is there.

What is missing is the *inside* of each screen. The panels still hand the operator a full working surface (the recruitment board, the whole contact book, every wave card, the entire finding) with many competing controls, and nothing on the screen says "this specific thing is what you do here, and here is whether you've done it." So the frame is a wizard but the content still reads like a dashboard. That matches what you're seeing.

## The fix

### 1. A standard action head on every screen
Add one primitive, `ScreenAction`, rendered by `StageWizard` directly under the guidance card, driven by data each stage passes in:

- **State line** — `Not started · In progress · Done`, computed from the sub-step's own `isDone`.
- **The one instruction** — a single imperative sentence ("Accept at least one candidate", "Record consent for all 12 panel members").
- **The one button** — the screen's action, when it can be performed here (Research candidates, Derive the instrument, Synthesise the finding). Not a duplicate of the footer's advance button.
- **What's outstanding** — the specific blocker, in the same voice as the stage rail.

This makes every screen answer: where am I, what do I do, am I done.

### 2. Cut each panel down to its one decision
For each sub-step, exactly one primary block stays on screen; everything else moves into `ShowTheDetail` (collapsed) or off the screen entirely:

- **Participants / find** — recruitment board only. Manual roster and full contact book collapse.
- **Participants / panel** — the panel list only; the contact book becomes a picker inside a collapsed drawer.
- **Participants / consent** — a reachability checklist (reachable / no channel / opted out) instead of the whole contact book.
- **Instruments / draft, edit, coverage** — draft shows the derive action and a read-only preview; edit shows the editor alone; coverage shows only the objective-to-question map.
- **Fieldwork / waves** — the single outstanding wave, with the rest collapsed behind "Show the other waves".
- **Fieldwork / returns** — the returns table and the close test only.
- **Evidence / landed, synthesise, file** — the evidence count, then the finding, then the filing confirmation; no repeated bar on all three.

### 3. Per-screen completion feedback
When a screen's `isDone` flips true, show a quiet confirmation strip ("Panel formed · 12 members") so progression is felt, and the footer's primary reads as the natural consequence rather than an unexplained "Continue".

### 4. Empty and blocked states
Every screen gets a real empty state via the existing `EmptyAction` — never a bare table with no rows and no instruction.

## Technical notes

- New: `src/components/personas/field/kit/ScreenAction.tsx`.
- `StageWizard` gains an optional `actions: Record<string, ScreenActionProps>` prop, rendered per current sub-step; `FIELD_SUBSTEPS` already carries `why`, `goodLooksLike` and `isDone`, so state and copy come from the existing spine — no new source of truth.
- Panel edits are confined to `ParticipantsStage.tsx`, `InstrumentsStage.tsx`, `FieldworkStage.tsx`, `EvidenceStage.tsx`, `BriefStage.tsx` and the `PlanStage` block in `countries.$code.personas.field.$step.tsx`.
- No backend, schema, or server-function changes. Buttons use the `btn-*` contract.

## Verification

Walk GRD project `dad662d1` through all six stages in the browser and confirm every screen shows one state line, one instruction, at most one in-screen action, and one advance button in the footer.
