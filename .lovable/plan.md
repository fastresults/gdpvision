# Chamber 07 Field Programme — Corrective Wizard Rebuild

## Verified diagnosis

The current implementation has wizard primitives, but not one coherent wizard experience:

- The live page stacks a six-stage rail, a separate track/action bar, sub-step chips, a guidance panel, and a fixed footer before or around the task itself.
- `StageFrame` allows **Continue** even when the current sub-step is incomplete; it labels the move “Continue anyway.” This makes completion advisory rather than enforced.
- Large legacy workbenches are mounted inside nominally atomic wizard screens:
  - Brief contains its own three-beat intake flow.
  - Participants embeds the full 797-line recruitment board.
  - Instruments contains another local instrument tab system.
  - Fieldwork embeds multi-step wave ladders inside the three advertised wizard steps.
- The same action can appear in both `ScreenAction` and the fixed footer, so users do not have one clear primary action.
- Required fallback work is sometimes hidden in “Show the detail” drawers, although that component is documented for optional detail.
- Locked preconditions render outside the normal wizard frame, so the experience changes structure when a gate is encountered.

The fix is therefore an architectural rebuild of the interaction contract, not another visual patch.

## 1. Establish one authoritative wizard model

Replace the loose `FIELD_SUBSTEPS` list with a typed workflow definition for every screen:

- stable screen key and route/search state
- title, purpose, and “what good looks like”
- entry prerequisites
- completion predicate
- one primary action definition
- optional secondary actions
- previous and next screen
- visible summary when completed
- recovery action when blocked

The model will drive the stage rail, screen progress, footer, URL, resume position, and completion counters. A screen may not invent its own navigation or completion meaning.

## 2. Make navigation completion-aware and truthful

Refactor `StageFrame` into the sole navigation and action owner:

- **Continue** advances only after the active screen’s completion predicate passes.
- If work is incomplete, the footer shows the exact action required instead of “Continue anyway.”
- Completed screens remain reopenable through an explicit **Amend** action.
- Back always returns to the preceding wizard screen, not merely the preceding top-level stage.
- Locked stages open inside the same frame with a plain explanation and a direct route back to the prerequisite.
- Save-on-navigation remains, but save success is distinct from workflow completion.
- The URL records the active screen, and reload/back/forward restore exactly that screen.

## 3. Reduce the page to one visual hierarchy

Keep one primary stage rail and one screen-progress treatment:

- Move Synthetic/Field switching and Discovery Brief/Presentation/Tracker into a compact programme header, visually separated from workflow navigation.
- Replace chip-like sub-step navigation with a clear “Stage X · Step Y of Z” progress header and a concise step list/drawer for revisiting completed work.
- Keep one guidance block directly above the decision surface.
- Keep one fixed footer with Back, the single primary action, consequence text, and current save state.
- Remove duplicated primary controls from `ScreenAction`; it becomes status/instruction only.
- Never hide required work inside `ShowTheDetail`; reserve disclosures for reference material, audit data, and optional manual overrides.

## 4. Decompose all six stages into genuinely atomic screens

### Brief

Convert the internal read/scope/open beats into real wizard screens:

1. Add the governing brief and supporting context.
2. Review the AI-read scope and resolve missing dimensions.
3. Commit the question of record.

Remove the nested intake progress line and its separate sticky footer. The global wizard footer owns Read, Re-read, and Commit at the appropriate screen.

### Programme

Use three screens:

1. Add optional steering and generate the programme.
2. Review dates, phases, methods, milestones, and deliverables.
3. Approve the programme.

Approval cannot occur before a draft exists and has been reviewed. Redrafting is a secondary amendment action, not a competing primary path.

### Participants

Break the recruitment workbench into explicit decisions:

1. Review/derive the recruitment frame and personas.
2. Run AI deep research for each incomplete persona.
3. Review recommendations — accept, edit, reject, or add people.
4. Form survey panels and focus-group slates.
5. Resolve reachability, consent, and opt-outs.

Each screen shows only the relevant slice of the recruitment data. AI-empty and low-confidence results get a visible recovery path; manual addition is never hidden.

### Instruments

Replace local instrument tabs with workflow screens generated from the approved method mix:

1. Generate required instruments.
2. Edit each required instrument one at a time.
3. Validate objective coverage and the mandatory frontline-insight block.
4. Approve instruments for fielding.

The active instrument becomes part of wizard state, so browser navigation and resume behavior stay synchronized.

### Fieldwork

Promote each planned wave and its operational beats into the wizard model instead of embedding ladders:

- Survey wave: open → issue links → send/prepare invitations → monitor/import returns → close.
- Session wave: schedule rooms → record held sessions → file transcripts → close.
- Returns review follows only after all required waves meet their closure rule.

Only the current live beat is expanded. Completed beats collapse to a factual summary; future beats show their unlock condition. This removes the nested “wizard inside wizard” behavior.

### Evidence

Use four explicit screens:

1. Review the evidence inventory and gaps.
2. Generate the synthesis.
3. Review/edit findings, confidence, limitations, and frontline innovation signals.
4. Accept and file the programme to the second brain.

Closing remains blocked until a synthesis exists and required limitations/confidence fields are present.

## 5. Align progress calculations with the new screen contract

Update field progress so every screen reports one of:

- locked
- ready
- in progress
- needs review
- complete
- failed with recovery available

Separate “data exists” from “the administrator accepted this decision.” Progress will no longer mark a screen complete merely because a row or count exists when review/approval is still required.

Persist the last active screen per project so returning users resume at the first unresolved decision, while still allowing deliberate amendments to completed screens.

## 6. Add guardrails against regression

- Add component tests for next/back, blocked continuation, amendment, dirty-save behavior, URL restoration, and first-unresolved resume.
- Add workflow tests for all six stages, including empty AI results, partial research, missing instruments, uncontactable participants, incomplete waves, and failed synthesis.
- Add a development invariant that warns when a wizard screen renders another navigation rail or more than one primary action.
- Keep required controls out of closed disclosures through tests and review rules.

## 7. Validate the complete administrator journey

Run the rebuilt flow against a real existing field project and a clean project:

1. Start at Brief and proceed screen by screen through Evidence.
2. Reload and use browser back/forward at every stage.
3. Amend earlier completed work and confirm downstream outputs become visibly stale where applicable.
4. Verify desktop and mobile layouts, fixed-footer clearance, scroll-to-top behavior, and no overlapping controls.
5. Verify each screen answers, without interpretation: **Where am I? Why am I here? What must I do now? What happens when I press this? What unlocks next?**

## Scope

This rebuild preserves the existing research, recruitment, instrument, fieldwork, evidence, database, and corpus operations wherever they are correct. It restructures how those operations are exposed, sequenced, gated, and resumed; backend changes are limited to progress/acceptance state needed to make the wizard truthful.