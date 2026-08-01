## What the log actually shows

You approved the plan and the programme went `active` — the backend did its job. Then the UI stopped. Stages 02–05 of the field rail (`countries.$code.personas.field.$step.tsx`) render `StagePlaceholder`: an icon, a sentence, and the line *"Server engine ready · workspace lands next."* There is no next step, no handoff, no instruction.

That placeholder is a lie about the state of the system. The engines are all built and unused:

| Stage | Backend already shipped | UI today |
| --- | --- | --- |
| 02 Participants | `crm.functions.ts` (contacts, import, panels, consent, opt-out), `comms.functions.ts` (templates, send, log) | placeholder |
| 03 Instruments | `field-instrument.functions.ts` (AI draft, save, versions) | placeholder |
| 04 Fieldwork | `field-sessions.functions.ts`, `field-collection.functions.ts` (open/close, invite, responses, ingest), `transcribe.functions.ts` | placeholder |
| 05 Evidence | `field-synthesis.functions.ts` (synthesise, compare-to-synthetic, close), `field-corpus.server.ts` | placeholder |

So the flaw is not one screen. Four of six stages are unbuilt fronts on finished backs, and nothing in the product tells the user what to do next at any point.

## The fix, in two parts

### Part 1 — A guided rail contract (applies to every stage)

Every field stage gets the same three-part frame, so the user is never guessing:

```text
┌ Stage masthead ── Stage 02 · Participants ───────────────┐
│ What this stage decides · what "done" means here         │
├ The work surface ────────────────────────────────────────┤
│ (the actual stage UI)                                    │
├ Decision bar (sticky) ───────────────────────────────────┤
│  ← Programme plan      [ Recruit the panel → ]  3 of 6   │
└──────────────────────────────────────────────────────────┘
```

- **Exit criteria, stated up front.** Each stage declares its own "done" test (e.g. Participants: *a panel exists, consented, with no unresolved opt-outs*). Shown at the top, evaluated live.
- **One primary next action, always.** The sticky bar carries the single highest-value action — never a bare page. When the stage is incomplete the button says what is missing; when it is complete it advances to the next stage.
- **The stepper reflects truth.** `FieldStepper` currently only knows `briefCommitted` / `planCommitted`, so stages 02–05 all look identical forever. It gets per-stage completion from a new `getFieldProgress` server function so ticks, locks and the "you are here" state are real.
- **On approval, move the user.** Approving the plan currently leaves you on the plan page. It will advance straight to Stage 02 with a short confirmation of what was just fixed (window, phases, deliverables) — the log shows this is exactly the moment the journey died.

### Part 2 — Build the four missing workspaces

Thin, decisive surfaces over the existing server functions. No new backend except the progress read.

**Stage 02 · Participants** — contact table with CSV/paste import, consent + opt-out state, panel builder (name, criteria, members), and an invitation composer that uses `draftTemplate` to write the approach message from the brief. Done when a panel is populated and consented.

**Stage 03 · Instruments** — AI drafts the questionnaire or discussion guide from the brief and the approved plan (`draftInstrument`), then an editable question list (type, prompt, options, routing) with versioning on save. Done when at least one instrument is saved against a phase.

**Stage 04 · Fieldwork** — sessions calendar bound to plan phases, attendee assignment from the panel, attendance marking, recording/transcript attach (`attachSessionTranscript`, `transcribeAudio`), plus collections: open, invite, track returns, import responses. Done when a collection is closed with returns in.

**Stage 05 · Evidence** — run `synthesiseField`, show findings with citations back to returns, `compareToSynthetic` when a synthetic pass exists on the same project, then `closeProgramme`, which files the whole evidence set to the country's second brain. Done when the programme is closed and filed.

### Cross-cutting

- **Empty states are instructions, not decoration.** Every empty surface names the one action that fills it and links to it.
- **Explain this** on each stage's exit criteria and on any AI-derived recommendation (instrument length, sample size, phase fit), per the global contract.
- **Everything files to the second brain** — instruments, transcripts, returns and synthesis all route through the corpus writers with the project's `visibility`, deduped on their normalized keys.
- **Buttons** use `btn-primary` / `btn-secondary` / `btn-ghost`; JSON renders through `<PrettyJson>`; illustrations only via `<Illustration>`.

## Technical notes

- New: `src/lib/personas/field-progress.functions.ts` → `getFieldProgress({ projectId })` returns per-stage `{ complete, blocker, counts }` in one round trip; used by both `FieldStepper` and the decision bar.
- New: `src/components/personas/field/StageFrame.tsx` (masthead + exit criteria + sticky decision bar) plus `ParticipantsStage.tsx`, `InstrumentsStage.tsx`, `FieldworkStage.tsx`, `EvidenceStage.tsx`.
- `countries.$code.personas.field.$step.tsx` becomes a thin router over `StageFrame`; `StagePlaceholder` is deleted.
- `FieldStepper` takes a `progress` prop; locks derive from progress rather than two booleans.
- Stage order and exit criteria live in one module (`src/lib/personas/field-stages.ts`) so the stepper, the frame and the progress function cannot drift.
- Docs: update `docs/map/chambers.md` for Chamber 07, run `bun run headers && bun run map`.
