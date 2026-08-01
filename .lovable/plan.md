## What's wrong

Stage 03 (Instruments) is the one stage in the field rail that is *not* AI-first. Everything before it — brief read, programme plan, phase naming, participant recruitment — runs itself and presents a result for approval. Instruments does the opposite: you arrive at an empty panel that says "No instrument yet" and asks you to press one of two buttons and guess which one. Nothing about the brief, the plan's method mix, or the questions it should be asking is on screen.

Three concrete defects behind that:

1. **No auto-derivation.** `InstrumentsStage` only drafts on a button click. The AI already has the source brief, the supporting context and the approved plan — it should have drafted before you got there.
2. **The method is a coin toss put to the user.** The plan already declares a method mix (survey / focus groups / depth interviews). The stage ignores it and offers "Draft a survey" and "Draft a discussion guide" as equal, unexplained options.
3. **One instrument per programme, silently.** `getInstrument` returns only the highest `version` row for the study. If the plan calls for a survey *and* a discussion guide, drafting the second one makes the first disappear from the UI even though it still exists in the database. A blended programme cannot be represented.

There is also no visible reasoning: no statement of what the draft was derived from, why each section exists, or how coverage maps back to the plan's objectives.

## What to build

### 1. Derive on arrival, not on demand

When the stage opens with an active plan and no instrument, it drafts immediately — no button press. While it works, show a narrated progress read-out in the house style ("Reading the source brief… mapping the plan's objectives… drafting the survey…"), matching the recruitment agent's behaviour rather than a bare spinner.

### 2. Draft the set the plan calls for

Read `programme_plans.method_mix` and derive **one instrument per planned method** — a survey if the mix contains a survey, a discussion guide if it contains focus groups or depth interviews, both when blended. Present them as a tabbed set ("Survey · 14 questions" / "Discussion guide · 9 prompts") instead of a single mystery document.

### 3. Show the derivation

Above the document, a provenance strip that states plainly what it was built from — source brief title, number of supporting context items, plan phase the fieldwork sits in, method taken from the mix — and a coverage rail mapping the plan's objectives to the questions that serve them, flagging any objective with no question against it. Both interrogable via `<Explain>`.

### 4. Reframe the manual controls

The two draft buttons become a single quiet "Re-draft with a steer" affordance under the existing steering box, plus per-instrument "Add the missing method" when the plan asks for something not yet drafted. Editing stays exactly as it is — a near-right draft is adjusted, never regenerated.

### 5. Stage completion follows the plan

`computeFieldProgress` currently marks Instruments done at `instrumentCount > 0`. Change it to: every method in the plan's mix has an instrument, and each has at least one question. Blocker copy names the missing method.

## Technical notes

- `src/lib/personas/field-instrument.functions.ts` — add `getInstruments` (latest version per `kind`, not per study) and `ensureInstruments` (idempotent: derive only the missing methods for the plan's mix; safe to call on every stage mount). Keep `draftInstrument` for explicit re-drafts. Add a `deriveMethodsFromPlan` helper shared with progress.
- `src/lib/personas/field-progress.server.ts` — instruments stage counts distinct `kind` values against the planned methods.
- `src/components/personas/field/InstrumentsStage.tsx` — auto-derive effect guarded so it fires once per study, method tabs, provenance strip, coverage rail; keep `useDirtyState` / `SaveBar` / `useDirtyRegistration` per active tab so Continue still auto-saves.
- `src/lib/explain/personas-entries.ts` — rationales for `personas.instrument.derivation` and `personas.instrument.coverage`.
- Corpus: file each derived instrument to the second brain via the existing `fileProgrammeMaterial` path with a `role:instrument` tag, so the questionnaire is citable alongside the brief.
- No schema change needed — `field_instruments` already carries `kind` and `version`.
