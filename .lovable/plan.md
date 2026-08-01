## What the audit found

I read the rail end to end — `field-stages.ts`, `field-progress.server.ts`, `FieldStepper.tsx`, `StageFrame.tsx`, the `$step` route, and the Participants / Instruments / Fieldwork / Evidence stages — plus the preview server logs. The logs show no crashes: the problem is not failure, it is that the rail never tells the user what is saved, never offers the one action that would unblock them, and makes going back to fix something feel forbidden. Six concrete defects:

1. **Edits can be silently lost.** The instrument editor holds title, intro and questions in local state, and a `useEffect` re-seeds that state every time the query refetches. Any refetch triggered elsewhere on the page overwrites in-progress wording with no warning. Nothing marks the editor dirty, and leaving via the stepper or the sticky bar discards the work without a prompt.
2. **No save confirmation anywhere.** Saving an instrument, a transcript, a roster or a panel produces no visible "saved" state — only a spinner that stops. The user cannot tell whether the click landed.
3. **The instrument editor is one-way.** Questions can be deleted and re-worded but not added or reordered, so a near-right AI draft has to be regenerated from scratch instead of adjusted.
4. **The next action pushes past the problem instead of solving it.** When a stage is incomplete the sticky bar's only forward control reads "Skip ahead to …". The blocker is stated but never actionable — no button does the thing that would clear it.
5. **Backward movement is discouraged and, once closed, impossible.** Back moves one stage at a time; there is no "amend the brief" or "revise the plan" route from a late stage, and `closeProgramme` has no counterpart — a closed programme cannot be reopened to correct a finding.
6. **The rail can lie about being blocked.** Progress is one query; if it errors or is stale after a mutation, stages read as incomplete with no way to retry the read.

## The plan

### 1. A save contract every stage obeys
Add `src/components/personas/field/SaveBar.tsx` — one component carrying the same three states everywhere: **unsaved changes** (amber, names what is dirty), **saving**, **saved · timestamp**. Add a `useDirtyState` hook that owns the local-vs-server diff so a background refetch can never overwrite a dirty editor; when the server copy changes underneath a dirty editor, show "the stored version changed — keep mine / take theirs" rather than silently clobbering.

Wire it into Instruments (title, intro, questions), Fieldwork (transcript, session details, pasted returns) and the Participants manual roster.

### 2. Never lose an edit on navigation
`StageFrame` gains a dirty registry. When any stage reports unsaved work, the stepper links, the back/next controls and the browser unload all route through a small confirm: **Save and continue · Discard · Stay**. Save-and-continue runs the stage's own save before navigating.

### 3. Make the instrument editable rather than regenerable
Add a question, insert after, move up/down, duplicate, change type (from the existing `QUESTION_TYPES`), and edit options. Deleting keeps an inline undo. This turns "the draft is 80% right" into a two-minute edit instead of a re-draft.

### 4. Turn every blocker into a button
Extend each stage spec in `field-stages.ts` with a **resolve action**: the label and target that clears its blocker (Participants → "Research candidates", Instruments → "Draft the instrument", Fieldwork → "Open a collection", Evidence → "Synthesise the finding"). The sticky bar then always shows two controls: the resolve action when incomplete, and the advance action when complete. "Skip ahead" survives only as a quiet secondary link, so moving on is possible but never the loudest option.

### 5. Make going backward legitimate
- The sticky bar gains a persistent **Amend** menu: return to the brief, revise the plan, or jump to any unlocked earlier stage in one move.
- Add a `reopenProgramme` server function (the mirror of `closeProgramme`) plus a **Reopen to revise** control in Evidence, so a filed finding can be corrected and re-filed. Re-closing re-files to the second brain under the same key, so no duplicate memo is created.
- Where an earlier change invalidates later work (a new instrument after returns are in), the affected stage shows a plain-language notice rather than failing quietly.

### 6. Make the rail's state honest
Refetch progress after every stage mutation, show a small "checking…" state while it revalidates, and surface a retry line if the progress read fails instead of leaving the whole rail reading as blocked.

## Technical notes

- New: `src/components/personas/field/SaveBar.tsx`, `src/hooks/useDirtyState.ts`, `reopenProgramme` in `src/lib/personas/field-synthesis.functions.ts`.
- Edited: `field-stages.ts` (resolve actions), `StageFrame.tsx` (dirty guard, two-control bar, amend menu), `InstrumentsStage.tsx`, `FieldworkStage.tsx`, `ParticipantsStage.tsx`, `EvidenceStage.tsx`, the `$step` route (progress invalidation and error surface).
- No schema change is needed except the reopen path, which only moves `persona_projects.status` back off `completed` — done through the existing server-function boundary with `requireSupabaseAuth`.
- New rationales registered in `src/lib/explain/personas-entries.ts` for the save contract and for what reopening a closed programme does to the filed memo.
