## Problem

Today's synthesized brief is a ~250-word blob. It doesn't say what instrument was used, what questions were asked, which segment/how many personas responded, how it ties back to the original scope, and there is no cross-study rollup. It also carries a "FROM: McKinsey & Company" line that must never appear.

## Fixes

### 1. Ban the FROM line (global)

- Strip any `FROM:` / `FROM —` header line during synthesis output and when rendering `summary_md` (defensive on both sides). No branded byline anywhere in the app.
- Update `runStudySynthesis` prompt: memo header is `TO / RE / DATE` only — never a FROM line, never "McKinsey & Company".

### 2. Per-study brief becomes decision-ready

Rewrite `runStudySynthesis` in `src/lib/personas/study.functions.ts` so the synthesized artifact carries the full research context, always grounded in the original brief scope.

New `study_reports` row shape (JSON payload extends existing columns — no destructive schema change, just richer `summary_md` + a new `context` jsonb block):

- `context` (new column, jsonb, nullable): `{ instrument, question_count, questions:[{ord,prompt,kind}], segment_label, persona_count, respondent_count, brief_title, brief_objectives[], deliverables[] }`
- `summary_md`: expanded to a structured memo:
  - `## TO` — Decision Committee
  - `## RE` — <study title>
  - `## Scope link` — 1-2 lines that quote/reference the original brief objectives this study answers
  - `## Instrument` — method, N personas, N questions, verbatim of the 3 most decisive questions
  - `## What we heard` — 4-6 bullets with `[N]` citations
  - `## Segment truths` — themes with prevalence
  - `## Tensions & disagreements` (focus_group) / `## Distribution` (survey) / `## Message read` (creative_test)
  - `## So-what for the brand exercise` — brand-ethos framing tied back to brief
  - `## Recommendations` — 3-5 numbered, decision-oriented
  - `## Risks & watch-outs`
- `themes[]` unchanged shape, but require `evidence_quote` verbatim from responses/transcript.

The synthesis prompt receives:
- Full `brief_scope` + `outcome_blueprint` (currently only loaded during compose).
- The full question list (prompt + kind).
- All responses or full transcript (existing).
- Segment label + persona roster count.

### 3. New: Program Synthesis (portfolio rollup)

A single McKinsey-grade "Program Report" that consolidates every completed study for a country back to the original scope.

New server fn `synthesizeStudyProgram({ countryCode })` in `src/lib/personas/study.functions.ts`:
- Loads `persona_study_drafts` (brief_scope, outcome_blueprint, brief_raw).
- Loads all `study_reports` + parent `studies` + segment labels + question counts.
- Calls Gemini 2.5 Pro with the brief + every study's summary + themes + top quotes.
- Writes to a new table `study_program_reports (id, country_code, brief_snapshot jsonb, summary_md, sections jsonb, citations jsonb, created_at, updated_at)` — one active row per country (upsert on country_code, `updated_at` refreshed on rerun).
- Output structure:
  - `## Brief we were answering` (verbatim scope objectives)
  - `## Studies run` (table: instrument · segment · N personas · key finding)
  - `## Cross-cutting truths` (themes recurring across ≥2 studies with prevalence)
  - `## Brand ethos read` (dedicated section — this is a brand exercise)
  - `## Strategic recommendation` (single top-line recommendation, then 3-5 numbered plays)
  - `## Sequencing & owners`
  - `## Open questions / next studies`
- Never emits a FROM line.

Trigger points:
- Auto-fires at the end of Stage-03 auto-run once all studies are `complete` (append to `completeIncompleteStudies` in `src/lib/personas/study-autorun.ts`, and to the end-of-pipeline in `draftStudiesForSegments` when `fullPipeline=true`).
- Manual "Regenerate program synthesis" button in the new UI card.

### 4. UI

`src/components/personas/StudyWizard/SynthesisDigest.tsx`:
- Show the new fields per study: instrument chip · N personas · N questions · segment; expandable "Questions asked" disclosure listing the actual prompts.
- Render new memo headings.
- Add a header banner **Program Synthesis** at the top of the digest surfacing the portfolio-level `summary_md` (top recommendation + numbered plays), with links into each study.

New `src/components/personas/StudyWizard/ProgramSynthesisCard.tsx` for the portfolio memo (McKinsey-style typography, prints/exports cleanly). Fed by a new `getStudyProgramReport({countryCode})` server fn.

Stage-03 route (`src/routes/_authenticated/admin/countries.$code/personas/studies.tsx`) mounts `ProgramSynthesisCard` above `SynthesisDigest`, with a "Regenerate" action that also runs when auto-run completes.

### 5. Auto-run integration

`src/lib/personas/study-autorun.ts`:
- After the last study reaches `complete` in `completeIncompleteStudies` and in `draftStudiesForSegments`, call `synthesizeStudyProgram({countryCode})` (transient-retry-guarded, same pattern as phase B).
- The global `AutoRunBeacon` gets one more phase label: `program` ("Consolidating program brief…").

## Technical notes

- Migration: `alter table study_reports add column context jsonb;` and new table `study_program_reports` (with GRANTs to `authenticated` + `service_role`, RLS via existing `has_country_access(country_code)` helper, unique index on `country_code`).
- Model: keep `google/gemini-2.5-pro` for synthesis (already used); Program synthesis uses same model with 8k data-block cap per study (top themes + 6 quote lines) to stay under limits.
- Citations: reuse `refsFromTextAndModel` + `fullCitationsForRefs` from context pack — program citations union across all included studies.
- FROM-line strip: shared helper `stripBrandedByline(md)` used by both `runStudySynthesis` and `synthesizeStudyProgram`, and applied server-side in `listStudiesWithReports` for the existing rows so old reports render clean without a rerun.

### Files to add/edit

- edit `src/lib/personas/study.functions.ts` — expanded synthesis prompt/shape, `stripBrandedByline`, new `synthesizeStudyProgram`, `getStudyProgramReport`, digest hydration.
- edit `src/lib/personas/study-autorun.ts` — trigger program synthesis at end of pipeline.
- add `src/components/personas/StudyWizard/ProgramSynthesisCard.tsx`.
- edit `src/components/personas/StudyWizard/SynthesisDigest.tsx` — richer per-study block, questions disclosure.
- edit `src/routes/_authenticated/admin/countries.$code.personas.studies.tsx` — mount program card, wire regenerate.
- edit `src/components/autorun/AutoRunBeacon.tsx` — `program` phase label.
- new migration for `study_reports.context` + `study_program_reports` table with grants + RLS.

## Out of scope

Backfilling existing brief-less countries with a synthesized brief scope — program report will render "no brief captured" section and still consolidate studies.
