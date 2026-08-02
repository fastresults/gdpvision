## Goal

Turn the Field Programme rail into six **collapsible phase sections**. Each phase header keeps the label, number, sub-caption and counter you already see (`Intake · Brief · committed`, `01 AI plan · 2/2 · Programme · active`, …). Everything that stage renders lives *inside* that phase, collapsed by default, and only the active phase is open. Inside an open phase the user steps forward and backward through that phase's screens.

```text
▸ 00  Intake        Brief         committed        (collapsed)
▾ 01  AI plan 2/2   Programme     active           (open)
      ├ step rail:  1 Draft  ● 2 Approve
      ├ guidance card + the one screen
      └ ◀ Back        [ Approve the plan ]  ▶
▸ 02  CRM 0/3       Participants  outstanding      (collapsed)
▸ 03  Fieldcraft    Instruments   done             (collapsed)
▸ 04  Collection    Fieldwork     outstanding      (collapsed)
▸ 05  Synthesis     Evidence      outstanding      (collapsed)
```

## What changes

**1. Phase accordion replaces the sticky top rail**
- `FieldStepper.tsx` becomes `PhaseAccordion`: the six nodes render as full-width header rows (chevron, number badge, sub-caption + counter, label, hint) instead of a sticky grid.
- Clicking an unlocked header navigates to that stage (still through `useGuardedGo`, so unsaved work is saved/confirmed first) and expands it; the previously open phase collapses. Locked phases show the padlock and don't open.
- Only one phase is open at a time — the active stage from the route. This preserves both directions of travel across phases.

**2. Stage UI nests under its phase**
- The route shell (`countries.$code.personas.field.$step.tsx`) stops rendering the rail above and the stage below as two separate blocks. It renders the accordion, and the current stage's `StageFrame` + content mounts as the body of the open phase row.
- `StageFrame`'s header shrinks: the phase header already states stage number, label and state, so the frame keeps only the "Done when" test and its guidance, avoiding a doubled title.

**3. Everything expanded gets collapsed under its phase**
- Long secondary surfaces already using `ShowTheDetail` stay as is; any remaining always-open tables/panels inside stages (recruitment board tables, wave lists, evidence tables) are moved into `ShowTheDetail` drawers so an opened phase shows only the current screen.
- Collapsed phases render no body at all (unmounted), so the page is short and scannable.

**4. Forward/backward inside each phase**
- The footer stays the single navigation grammar, and it moves into the open phase body so Back/Next are visually part of that phase.
- `Back`: previous sub-step; at the first sub-step it collapses this phase and opens the previous one.
- Primary: performs the published screen action if one is pending; otherwise advances to the next sub-step; at the last sub-step it collapses this phase and opens the next.
- The in-phase step chips in `StageWizard` become clickable for steps already completed or currently reachable (same rule the frame already uses to validate `?sub=`), so backward movement inside a phase is one click as well as one Back press.

## Technical notes

- Files: `src/components/personas/FieldStepper.tsx` (rewritten as the accordion), `src/components/personas/field/StageFrame.tsx` (header slimmed, footer relocated into the phase body, back-at-first-substep behaviour unchanged), `src/components/personas/field/StageWizard.tsx` (chips become guarded links), plus the field `$step` route shell for composition.
- Open/closed state is derived from the route (`$step` + `?sub=`), not local state — deep links, refreshes and the browser back button stay correct.
- Lock rules are unchanged: brief unlocks the programme; an active programme plan unlocks the remaining four phases.
- No data, server-function or schema changes.
