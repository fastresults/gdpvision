
# Chamber 07 · Guided Field Wizard (with navigation-clarity pass)

## What's actually wrong today

The rail (`FIELD_STAGES`: brief → plan → participants → instruments → fieldwork → evidence) is honest but coarse. Each stage is **one dense workbench page**:

- `StageFrame` gives a masthead, a "done when" test, one blocker line and a sticky bar — good, but it describes the *whole* stage, not the next click.
- `ParticipantsStage` shows AI recruitment, a paste-roster box, a contact table and panel building all at once — four unrelated decisions on one screen.
- `InstrumentsStage` (671 lines) puts drafting, editing, coverage and deploy together.
- `FieldworkStage` lists every wave at once; `EvidenceStage` offers synthesis with no preparation ritual.
- Guidance is a single sentence per stage. A novice can't tell why the stage exists, what "good" looks like, or which control to touch first.
- No memory of where *inside* a stage you stopped — only which stage you're on.

The rail is a wizard; the stages are not. That's the confusion.

## The fix: a two-level wizard

Level 1 stays the six-stage rail. Level 2 becomes an explicit **sub-step wizard inside every stage**, driven by one shared primitive so all six behave identically.

```text
Rail:   Brief → Programme → Participants → Instruments → Fieldwork → Evidence
                                  |
Wizard:  2.1 Who ──> 2.2 Find ──> 2.3 Review ──> 2.4 Panel ──> 2.5 Consent
         (one decision per screen, AI drafts the answer first)
```

### Principles applied to every sub-step
1. **One decision per screen.** Nothing else visible.
2. **AI does it first.** Each sub-step opens with a proposal drafted from the brief + corpus; the user approves or adjusts, never starts blank.
3. **Say why before what.** A fixed "Why this matters / What good looks like / What happens next" panel in the same position every time.
4. **Never dead-ended.** Exactly one primary action, plus Back and "Do this for me".
5. **Resumable.** The exact sub-step is persisted; reopening a project lands you there.

## Sub-step maps

**01 Brief** — 1 Question · 2 Context & uploads · 3 Success criteria · 4 Confirm & commit
**02 Programme** — 1 Read the brief back · 2 AI method mix · 3 Dates & waves · 4 Deliverables · 5 Approve
**03 Participants** — 1 Who we need to hear from · 2 AI candidate research · 3 Review & accept · 4 Build the panel · 5 Consent & contactability
**04 Instruments** — 1 Objectives→questions coverage · 2 AI draft per instrument · 3 Edit + mandatory frontline-insight block · 4 Preview as a participant · 5 Deploy readiness
**05 Fieldwork** — 1 Field plan read-out · 2 Wave by wave (invite → monitor → close, one wave per screen) · 3 Returns check · 4 Close the field
**06 Evidence** — 1 What landed (coverage & sufficiency) · 2 AI synthesis · 3 Review findings & innovation signals · 4 Confidence & limitations · 5 File to the second brain and close

---

## Navigation-clarity pass (second pass)

The wizard only helps if moving around it is obvious. These rules apply globally.

**One breadcrumb sentence, always in the same place.** Under the rail: `Field programme · Stage 03 Participants · Step 2 of 5 — Find candidates`. Never more than that line; it replaces the current mix of headers competing for attention.

**Two navigation surfaces only — and they never disagree.**
- *Rail (top)* = stages. Gains a `2/5` micro-counter and a thin fill bar per node, reading the same sub-step progress. Locked nodes state the unlock condition in one clause.
- *Wizard chips (inside the stage)* = sub-steps. Done ticks, current highlighted, future greyed but reachable. No third navigation control anywhere on the page.

**One footer grammar on every screen, in fixed positions.**
`← Back` (left) · quiet "Do this for me" (centre-right) · **one** primary Continue (far right). The primary button always names the *outcome*, never "Next": "Accept these 12 candidates", "Approve the plan", "Close the field". Same shape, same place, every screen — muscle memory after two steps.

**Say what happens on click, before the click.** A one-line consequence under the primary button: "This creates the panel and unlocks Instruments." Removes the fear that stops novices.

**No silent locks.** A locked step never just greys out — it shows the sentence that unlocks it plus a button that jumps straight to the blocking screen.

**A visible way back without losing work.** The existing dirty-state gate stays; the "Amend" menu becomes plain-language jumps ("Change who we're hearing from", "Revise the dates") instead of stage names.

**Resume is one click, everywhere.** Portfolio cards, project switcher and the chamber door all deep-link to `stage + sub-step`, labelled with the human sentence ("Resume · Review candidates").

**Progress you can feel.** A single programme-level line under the breadcrumb: `9 of 29 steps complete` — one number, no percentages competing with per-stage counters.

**Language discipline.** Every label is a verb the user performs ("Choose who to hear from"), not a noun of the system ("Panel configuration"). Instrument/CRM/fieldcraft jargon moves into the guidance panel, never the button.

**Quiet by default.** Advanced surfaces (raw contact table, JSON, coverage matrix, deploy internals) collapse behind a single "Show the detail" disclosure per screen, closed on first visit and remembered thereafter.

---

## Technical plan

**New: `src/lib/personas/field-substeps.ts`** — single source of truth beside `field-stages.ts`. Per stage, an ordered list of sub-steps with `key`, `verbLabel`, `why`, `goodLooksLike`, `nextHappens`, `primaryLabel`, `consequence`, `aiActionLabel`, and a pure `isDone(progress, stageData)` predicate. Nothing renders a label not declared here — rail, wizard, breadcrumb, portfolio and resume links all read it.

**New: `src/components/personas/field/StageWizard.tsx`** — the level-2 shell rendered inside `StageFrame`'s children slot: breadcrumb line, sub-step chip rail, guidance card, body slot, and the fixed footer grammar. Consumes the existing `stage-bus` (`useResolveAction`, `useDirtyRegistration`, `guardedGo`), so save-and-navigate guarding is unchanged, just finer-grained.

**Refactor each stage into sub-step components** (logic moved, not rewritten):
- `field/participants/{AudienceSpec,Research,ReviewCandidates,BuildPanel,Consent}.tsx` from `ParticipantsStage` + `RecruitmentBoard`
- `field/instruments/{Coverage,Draft,Edit,Preview,Deploy}.tsx` from `InstrumentsStage` + `DeployPanel`
- `field/fieldwork/*` — keep `CollectionWave`/`SessionWave`, add plan read-out, one-wave paging, close-the-field
- `field/evidence/{WhatLanded,Synthesise,Review,Confidence,File}.tsx` from `EvidenceStage`
- Brief and Programme sub-steps wrap the existing `ProgrammeIngest` / derive-and-approve surfaces

**Progress** — extend `computeFieldProgress` (`field-progress.server.ts`) to return per-stage completed sub-step keys, the current one, and a programme-level `stepsDone / stepsTotal`. Derived from data already queried; no new tables.

**Routing & resume** — add `?sub=<key>` to the field route; persist last stage+sub-step per project so every "Resume" entry point deep-links precisely.

**Rail** — `FieldStepper` gains the micro-counter, fill bar and unlock sentences.

**Standards** — `btn-*` utilities only; all derived figures wrapped in `<Explain>`; first-visit coach lines reuse the `CoachTip` pattern.

## Order of work
1. `field-substeps.ts` + `StageWizard.tsx` + progress extension (the spine).
2. Participants and Instruments (worst offenders).
3. Fieldwork and Evidence.
4. Brief and Programme.
5. Navigation pass: breadcrumb, rail counters, footer grammar, unlock sentences, resume deep-links, "Show the detail" disclosures.
6. Browser-drive an end-to-end pass on the GRD project: every sub-step advances, guards unsaved work, resumes correctly, and no screen offers two competing primaries.

## Out of scope
No changes to the synthetic track, no schema changes to instruments/panels/waves, no changes to the client dossier, deck, share links or tracker.
