# Chamber 07 Field Programme — true wizard rebuild

## Verified diagnosis

The current implementation is **wizard-styled, not wizard-controlled**:

- The live Participants screen exposes the full Chamber navigation, six-stage rail, three clickable substeps, Discovery Brief, Presentation, Project Tracker, an Amend menu, detailed workbench controls, and the fixed footer at once. That is not a limited-choice wizard.
- `StageWizard` renders a progress list around arbitrary legacy `panels`; those panels still contain full editors, tables, tabs, regenerate actions, opt-out actions, and secondary workflows (`StageWizard.tsx:51-118`, `ParticipantsStage.tsx:335-409`, `InstrumentsStage.tsx:318+`).
- Stage and substep completion are inferred from broad database counts, not an explicit completed transition. For example, Participants “Check you can reach them” is considered done when **any** contactable person exists, rather than when the user confirms the programme panel is ready (`field-substeps.ts:99-106`).
- Navigation is not controlled by one state machine. The stage rail, substep list, Back button, Amend menu, output tools, and local workbench buttons all compete (`FieldStepper.tsx:134-224`, `StageFrame.tsx:259-379`).
- Primary-action ownership is ambiguous: `StageWizard` publishes `active-wizard-screen`, while nested components such as `RecruitmentBoard` also publish their own resolve action. The bus selects the first object value rather than enforcing one owner (`StageWizard.tsx:30-43`, `RecruitmentBoard.tsx:217-236`, `stage-bus.tsx:131-132`).
- Several panels duplicate the footer’s action inside the body—for example Programme draft/approve and recruitment derive/accept (`field.$step.tsx:435-500`, `RecruitmentBoard.tsx:258-300, 364-395`).
- The URL only carries an optional `?sub=` and the fallback is recalculated from counts; there is no canonical persisted cursor, explicit transition record, or reliable resume point (`StageFrame.tsx:81-106`, `field-substeps.ts:236-242`).

## Rebuild objective

A novice user sees exactly:

```text
Stage context
One question or task
Only the controls needed for that task

[Back]                              [Save & continue]
```

No clickable future stages, no clickable future substeps, no project tools in the active workflow, no duplicate primary actions, and no full workbench embedded in a wizard screen.

## Implementation plan

### 1. Replace count-driven navigation with one explicit wizard state machine

- Define one canonical ordered machine for all Field Programme screens: Brief → Programme → Participants → Instruments → Fieldwork → Evidence.
- Give every atomic screen explicit states: `locked`, `available`, `in_progress`, `complete`, `error`.
- Define only four navigation events: `BACK`, `SAVE_AND_CONTINUE`, `RETRY`, and `RETURN_TO_PROJECT`.
- Persist the last completed screen and active cursor per project so refresh and resume return to the exact screen.
- Treat database counts as validation evidence only; they must not silently advance or mark a user decision complete.

### 2. Replace the current shell with a constrained WizardShell

- Remove the clickable six-stage rail from the active flow; show it as non-interactive progress only.
- Remove the clickable substep grid; show only `Step X of Y` and the current task.
- Keep one persistent footer with Back and one context-specific primary action.
- Back always moves exactly one atomic screen and never skips stages.
- Continue validates, saves, records completion, refreshes authoritative state, then moves exactly one screen.
- Locked screens cannot be opened by URL manipulation; the route redirects to the canonical active screen.

### 3. Move project-level tools out of the wizard

- Remove Discovery Brief, Presentation, Project Tracker, Synthetic Lab switching, and the Amend jump menu from active wizard screens.
- Put those controls on the Field Programme project overview/completion surface, where they remain available without competing with the current task.
- Keep a single “Exit to project” affordance separate from Back/Continue and protect unsaved work.

### 4. Break every legacy workbench into atomic screen components

Each screen will contain only the controls required for its decision:

- **Brief:** enter/review the question → attach context → confirm and commit.
- **Programme:** generate draft → review scope/method/dates → approve.
- **Participants:** define recruitment frame → research one persona at a time → review recommendations → confirm panel → resolve reachability/consent.
- **Instruments:** generate required instrument → edit one instrument at a time → review objective coverage → approve for field.
- **Fieldwork:** review first wave → execute the one current wave action → close that wave → review returns → close fieldwork.
- **Evidence:** verify evidence base → generate synthesis → review/accept finding → file to the second brain.

Large tables, raw contact books, prior waves, technical provenance, and advanced/manual tools move into optional detail drawers or separate management views; they cannot introduce another forward action.

### 5. Enforce single action ownership

- Delete the multi-publisher “first action wins” behavior.
- Each atomic screen returns one typed action contract to the shell: label, validation, save/execute handler, pending state, error, and next screen.
- Nested components may emit edits or selection state but may not publish navigation or primary actions.
- Remove all duplicated body-level Draft, Approve, Accept all, Form panel, Save, Synthesise, and Close buttons when that action belongs to the footer.

### 6. Make completion and validation exact

- Add screen-specific validators based on the actual programme record, not generic counts.
- Examples: the selected programme panel—not the whole country contact book—must be reachable; every approved method must have an approved instrument; every required wave must be explicitly closed; evidence cannot be filed before the finding is accepted.
- Show one plain-language blocking reason directly above the footer.
- On failure, remain on the same screen with preserved input and a Retry action.

### 7. Preserve backward editing without corrupting downstream work

- Back permits review and edits to completed screens.
- Material upstream changes mark dependent downstream screens stale instead of pretending they remain complete.
- Show the exact consequence before saving an upstream amendment, then return the user to the first invalidated screen.
- Continue autosaves safely; failed saves never navigate.

### 8. Verify the complete novice journey

- Test a new project from Brief through Evidence using only Back and Continue.
- Test refresh/resume on every atomic screen.
- Test direct URLs to locked and completed screens.
- Test upstream amendments and downstream invalidation.
- Test save failure, AI failure/retry, empty data, and partially completed projects.
- Browser-verify desktop and mobile that every screen has one objective, one primary action, one Back action, no competing navigation, and no overlapping fixed footer.

## Acceptance criteria

- A user can complete the entire programme without choosing a stage or substep manually.
- Every screen asks for one decision or task.
- Exactly one primary forward action is visible.
- Back always returns one screen; Continue always advances one screen after validation and save.
- Future work is visible as progress but not clickable.
- Refresh resumes the exact active screen.
- Legacy workbenches no longer render wholesale inside wizard panels.
- Project outputs and management tools do not compete with the active workflow.
- No step is marked complete solely because a broad database count is nonzero.