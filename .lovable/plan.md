## What's actually wrong

The AI **is** naming the phases. I queried this GRD programme and the four phases are already stored as:

1. Inception & Instrument Design
2. Fieldwork & Data Collection
3. Analysis & Synthesis
4. Reporting & Strategic Advisory

…each with an intent line. The screen shows "Untitled phase" because the plan view reads `phase.title` / `phase.purpose`, while the table stores `name` / `intent` (`src/routes/_authenticated/admin/countries.$code.personas.field.$step.tsx`, `PhaseList`). A display bug, not a research bug — so this instance is fixed the moment the keys are corrected, with no redraft needed.

## The fix

**1. Render the derived names (root cause)**
- `PhaseList` reads `name` (fallback `title`) and `intent` (fallback `purpose`).
- Never print a generic placeholder: if a name is genuinely absent, fall back to the phase intent, then to a numbered label — an unnamed phase should be visibly flagged, not silently anonymised.

**2. Make "named" a contract, not a hope** (`src/lib/personas/programme-plan.functions.ts`)
- Tighten `isProposal` to require every phase to carry a non-empty, non-generic `name` (rejecting "Phase 1", "Untitled", "TBD") and a non-empty `intent`; same for milestone titles. Failing validation already triggers the fallback model in `deriveJson`, so a nameless draft is retried rather than persisted.
- Add one repair pass: if the second model also returns a thin/duplicate name, a short naming-only call re-titles those phases from the brief before insert. Nothing generic ever reaches the database.
- Strengthen the planner prompt: phase names must be specific to this brief's subject and the client's language (e.g. "Diaspora Trust Baseline"), never lifecycle boilerplate, and must not repeat.

**3. Feed the AI everything it has** (context-first naming)
- `briefText()` currently concatenates the raw brief plus upload excerpts. Label the governing **Source Brief** and each **Supporting Context** item distinctly in the prompt so naming is brief-led and context-qualified, matching the Stage 00 split already persisted on `brief_source` / `brief_uploads`.

**4. Read the plan like a document, not a dump**
- Phase cards show name, intent, dates and the milestones/deliverables that belong to that phase, instead of the current collapsed `PrettyJson` blob for all of them.
- Surface the plan `summary` and the duration rationale via `<Explain>` per the Explain contract, rather than a raw rationale JSON panel.

**5. Archive to the second brain**
- On approval (`commitProgrammePlan`), file the approved programme — summary, phases, milestones, deliverables, method mix, audience, risks — into the country corpus through the existing `fileProgrammeMaterial` / corpus gateway path, idempotent on a normalized key so a re-approval upserts rather than duplicates. Today only the raw proposal sits in `programme_plans`; nothing reaches the corpus.

## Technical notes

- Files: `src/routes/_authenticated/admin/countries.$code.personas.field.$step.tsx`, `src/lib/personas/programme-plan.functions.ts`, `src/lib/personas/field-corpus.server.ts` (corpus filing).
- No migration required — `programme_phases.name` / `.intent` already exist and are populated.
- No data backfill required for the current GRD programme; the names are already in the database.
