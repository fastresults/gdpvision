## Goal

Turn the portfolio memo in Chamber 07 Stage 03 into a full methodology-rich report: cast (personas + descriptions), groups (segments + rationale), instruments (every question per study), and an expanded "why this design" narrative — alongside the existing synthesis.

## Current gap

`synthesizeStudyProgram` only feeds the AI the first 5 question prompts per study and a segment label. The rendered `ProgramSynthesisCard` shows only the AI markdown + a small recommendations rail. There is:
- No cast roster (personas, archetypes, OCEAN, descriptions).
- No segment gallery (label, prompt, size, why chosen).
- No complete instruments list (all questions, kinds, options, per study).
- No methodology narrative (why survey vs. focus group, sample sizing rationale, coverage vs. brief).

## Plan

### 1. Server: enrich the program report payload
File: `src/lib/personas/study.functions.ts` (`synthesizeStudyProgram`)

- Pull, in one batch scoped to the active project:
  - All `persona_segments` for the country/project (id, label, prompt, size, created_at).
  - All `persona_segment_members` → `personas` (id, name, archetype, summary, attributes, ocean, segment_id) so we can render the full cast grouped by segment.
  - All `study_questions` for every study in scope (study_id, ord, prompt, kind, options).
  - `persona_study_drafts` active brief (already loaded via `loadCountryBrief`) — keep the raw scope excerpt.
- Build a `methodology_snapshot` object stored on `study_program_reports` (extend `studies_snapshot`/add fields via `sections.methodology`) containing:
  - `brief`: title, objectives, raw excerpt.
  - `segments[]`: { id, label, prompt, persona_count, personas: [{id, name, archetype, summary, ocean, attributes}] }.
  - `studies[]`: { id, title, kind, objective, segment_id, segment_label, persona_count, questions: [{ord, prompt, kind, options}] }.
- Extend the AI prompt with an explicit "## Methodology & design rationale" section requirement: why each method was chosen, why segment coverage is adequate, sampling logic, coverage-vs-brief matrix. Keep the existing sections; raise memo target to ~900–1200 words.
- Persist the enriched snapshot into `study_program_reports.sections.methodology` (no schema migration needed — `sections` is jsonb). Also store on `memory_objects` payload so Second Brain reflects it.

### 2. Client: methodology dossier UI
File: `src/components/personas/StudyWizard/ProgramSynthesisCard.tsx`

Add three new collapsible sections below the memo, before the right rail, all rendered from `sections.methodology`:

1. **Cast** — grid of persona cards grouped by segment: name · archetype · 2-line summary · OCEAN chips.
2. **Groups (segments)** — segment cards: label, prompt, persona count, which studies used it.
3. **Instruments** — per-study accordion: kind badge, objective, "N personas · M questions", full ordered question list with kind tag and options for choice/scale.

Also surface a "Methodology & design rationale" heading inside the CitedMarkdown when present.

Keep the current right-rail (scope link, recommendations, unanswered) unchanged.

### 3. Regeneration UX

- No changes to the existing "Regenerate" button; it already re-runs `synthesizeStudyProgram`, which now embeds full methodology.
- After deploy, user clicks Regenerate once per country/project to hydrate `sections.methodology` for existing reports.

## Out of scope

- No schema migration (leveraging existing jsonb `sections`).
- No changes to per-study `runStudySynthesis`; the per-study `SynthesisDigest` already shows instrument + questions.
- No changes to auto-run orchestration.

## Technical notes

- Payload size: cap personas to ~12 per segment in the AI prompt (keep all in the stored snapshot for UI).
- Keep questions verbatim; do not truncate in the stored snapshot (UI truncates for display).
- Preserve `stripBrandedByline` + citation sanitizers on any new markdown.
