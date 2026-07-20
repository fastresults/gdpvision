
## Problem

Chamber 07 (Persona Lab) presents three peer tabs — Personas, Segments, Studies — with no visible ordering, prerequisites, or "what do I do next?" cues. On the Studies screen the user lands on a generic form ("Rehearse the conversation") that assumes they already know they need a segment, a study kind, a title, and an objective. For a Head‑of‑Government audience this reads as tooling, not an instrument.

## Design principles

1. One primary path, always visible. Every screen answers: *where am I, what just happened, what should I do next*.
2. Guided rail over form. Replace naked forms with numbered stages and inline coaching copy.
3. Auto‑run is the default; manual is the escape hatch. The Research Studio (auto‑run) should be the front door, not a secondary button.
4. Never dead‑end. If prerequisites are missing, show a one‑click remedy inline (generate personas, draft a segment).
5. McKinsey restraint: serif headings, mono eyebrows, generous whitespace, semantic tokens only.

## Scope of changes (UI/presentation only)

### 1. Persona Lab shell — `countries.$code.personas.tsx`
- Replace the flat 3‑item sidebar with a **numbered guided rail**:
  `01 Personas → 02 Segments → 03 Studies`, each showing a live count (e.g. "12 personas · ready"), a state dot (empty / draft / ready), and a subtle connector line.
- Add a persistent top strip: *"Your workflow: build a synthetic public → group them → rehearse the conversation."* One sentence, always visible.
- Promote **✨ Launch Research Studio** to a full‑width primary CTA at the top of the rail with the sub‑label "AI runs the full study end‑to‑end". Keep manual entry to each stage below it.

### 2. New "Studio overview" landing — `personas/index.tsx`
- When the tab loads, show a **3‑card journey board** above the existing library:
  - Card 1: *Cast the room* (personas) — count, "Generate more" link.
  - Card 2: *Group them* (segments) — count, "Draft a segment" link, disabled state if 0 personas with inline remedy.
  - Card 3: *Rehearse* (studies) — count, "Start a study" link, disabled if 0 segments.
- Each card carries a one‑line "why this exists" and a next‑step CTA. This becomes the map users return to between actions.

### 3. Studies page — `countries.$code.personas.studies.tsx` (the attached screen)
Rebuild as a **3‑step guided composer**, not a form:

```text
Step 1  Pick a segment      → radio cards with persona count + short trait line
Step 2  Choose the method   → Survey / Focus group / Creative test
                              each card shows: what it produces, time, best for
Step 3  Frame the question  → title + objective with inline example chips
                              live "Ready to launch" summary panel on the right
```

- Left column: numbered stepper with completed/active/locked states.
- Right column: sticky "Study preview" card that fills in as the user answers (segment name, method, title, objective) and enables **Create study** only when all required inputs pass.
- Empty‑state (no segments): a single centered "Start here" panel with a "Draft your first segment" primary button and a "Why segments?" explainer — no half‑disabled form.
- Prepend a "**How this works**" strip: 4‑beat micro‑explainer (Pick → Method → Frame → Synthesize) with icons.
- Replace the flat "All studies · N" list with a card grid grouped by status (Running / Complete / Draft), each card showing method icon, segment, last activity, and a clear "Open synthesis →" or "Resume".

### 4. Study detail — `countries.$code.personas.studies.$id.tsx`
- Add a status ribbon at top: *Drafted → Questions ready → Running → Synthesized*, with the current phase highlighted and the next action as the only primary button.
- Coach copy per phase (one sentence) so a first‑time user knows what "run" will do and how long it takes.

### 5. Segments page — `countries.$code.personas.segments.tsx`
- Same guided treatment: numbered stepper (Choose personas → Name the segment → Confirm), sticky preview, empty‑state remedy that offers "Generate personas first".

### 6. Global microcopy pass
- Every eyebrow becomes an action verb (e.g. "STEP 02 · GROUP YOUR PUBLIC" rather than "SEGMENTS").
- Every primary button restates the outcome ("Create this study", "Generate 8 personas", "Draft segment from 12 personas").
- Add inline "Why am I doing this?" popovers (reuse existing `HoverCard`) on each step header.

## Out of scope

- No changes to server functions, DB schema, or AI pipelines.
- No changes to the Research Studio wizard/auto‑run internals (already landed).
- No new design tokens; reuse existing `ink/paper/line` palette and serif/mono type.

## Files to edit

- `src/routes/_authenticated/admin/countries.$code/personas.tsx` — numbered guided rail + top strip + promoted CTA.
- `src/routes/_authenticated/admin/countries.$code.personas.index.tsx` — journey board above library.
- `src/routes/_authenticated/admin/countries.$code.personas.studies.tsx` — 3‑step composer, sticky preview, grouped list, empty state.
- `src/routes/_authenticated/admin/countries.$code.personas.studies.$id.tsx` — phase ribbon + coach copy.
- `src/routes/_authenticated/admin/countries.$code.personas.segments.tsx` — matching guided treatment.
- New: `src/components/personas/GuidedStepper.tsx`, `src/components/personas/JourneyCard.tsx`, `src/components/personas/StudyPreviewCard.tsx` (small presentational primitives shared across the above).

## Acceptance

- A first‑time user landing on Studies with no segments sees exactly one primary action.
- Every Studio screen shows: stage number, what this stage produces, and the single next action.
- Auto‑run remains one click away from every entry point.
- No functional regressions to existing draft/segment/study data or auto‑run runs.
