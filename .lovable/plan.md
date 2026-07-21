# Chamber 07 — Mandatory Program Brief before research starts

## The problem

Today, creating a new program in `ProgramsIndex.tsx` does this:

1. `createProject` → row inserted.
2. Immediately `navigate(...studies?project=…&open=1)`.
3. The user lands on the Studies stage with **no brief captured**.

The `StudyWizardModal` does have a rich `StepBrief` (text + `MultimodalInput` for dictation + upload → `parseUpload`), but it is only reachable from the legacy `SessionsHub` — the new Programs flow bypasses it entirely. So the AI has nothing to ground personas / segments / studies on except the program *title*. That is exactly the gap you're seeing: research kicks off with no objectives, no source docs, no context.

This is an academic / survey process. It needs a proper intake before anything runs.

## What we'll build

A **Program Brief** is now a first-class, required artifact on every `persona_projects` row. No segments, studies, or auto-run are allowed until it exists.

### 1. Data — brief on the program (not the draft)

Migration on `persona_projects`:

- `brief_raw text` — verbatim brief (typed + dictated transcript + upload excerpts concatenated).
- `brief_scope jsonb` — AI-enriched structured scope (objectives, hypotheses, decisions, stakeholders, timeframe, geography, sensitivities, success_criteria) — same shape `enrichBrief` already returns.
- `brief_uploads jsonb` — array of `WizardUpload` ({name, path, mime, size, excerpt}).
- `brief_committed_at timestamptz` — set when user confirms the brief. This is the gate.
- Reuse existing RLS on `persona_projects`; add `GRANT` deltas only if needed.

### 2. New UI — `ProgramBriefIntake` (required first screen)

New component `src/components/personas/StudyWizard/ProgramBriefIntake.tsx`, rendered as the entire workspace for any program where `brief_committed_at is null`. It replaces (not overlays) the Cast/Group/Rehearse UI for that program.

Layout, McKinsey-plain, matches existing wizard styling:

- Header: program title + "Step 0 · Capture the brief" chip. Explains this is required — nothing runs until we know what to research.
- **Left column — Intake rail** using the existing `MultimodalInput`:
  - Type the brief (rich `textarea`).
  - Dictate (existing `useVoiceRecorder` + `transcribeAudio` — appends to textarea).
  - Upload documents (existing `parseUpload` → `study-artifacts` bucket → excerpt shown in chip list).
  - Autosave every 800ms to `persona_projects.brief_raw` / `brief_uploads`.
- **Right column — Guided prompts** (checklist the AI will look for), plain text hints, not required fields:
  - What decision does this research inform?
  - Who is affected / who are we listening to?
  - What hypotheses or fears are we testing?
  - Timeframe, geography, sensitivities.
  - Attach the RFP, prior report, or source document if any.
- **Bottom action bar:**
  - `Enrich into Research Scope` (primary, dark) → calls `enrichProjectBrief` server fn (see §3).
  - After enrichment, show the structured `brief_scope` via `<PrettyJson>` with an "Edit brief" button that returns to intake.
  - `Confirm brief & open workspace` (final commit) — sets `brief_committed_at`. Disabled until `brief_raw + uploads` combined ≥ 40 chars **and** `brief_scope` exists.
- No "auto-run" button here. Auto-run is only offered after commit, from the Studies stage.

### 3. Server functions — `src/lib/personas/project-brief.functions.ts`

All `requireSupabaseAuth`, all scoped by `projectId` + country access via `has_country_access`:

- `saveProjectBrief({ projectId, brief_raw?, brief_uploads? })` — patch autosave.
- `enrichProjectBrief({ projectId })` — reads `brief_raw` + upload excerpts, calls existing `enrichBrief` logic (extracted into a shared helper so we don't duplicate), writes `brief_scope`.
- `commitProjectBrief({ projectId })` — requires `brief_raw >= 40` and `brief_scope` non-null; sets `brief_committed_at`.
- `getProjectBrief({ projectId })` — returns all four brief fields for the intake screen.

### 4. Gating — the brief is the door to everything

- `src/routes/_authenticated/admin/countries.$code.personas.index.tsx`: when `activeProjectId` is set and the project has no `brief_committed_at`, render `<ProgramBriefIntake />` in place of the Cast/Group/Rehearse UI and Studio stepper (only the stepper's Stage 0 lights up).
- Same gate in `.../personas.segments.tsx` and `.../personas.studies.tsx`: redirect (or render the intake screen inline) whenever a program is selected but not committed. This closes the workaround where a user could deep-link past the intake.
- `StudioStepper.tsx`: add **Stage 00 · Brief** as the first node, dim Stages 01-03 until committed.
- Server-side hardening: `generateSegment`, `composeSegments`, `composeStudy`, `startAutorun`, and any wizard endpoint that mutates a program throw `"Program brief not committed"` when `brief_committed_at is null`. This makes the gate real, not just UI-level.

### 5. Programs list — reflect the new state

`ProgramsIndex.tsx`:

- After `createProject` success, navigate to `.../personas?project=<id>` (not `.../studies`) so the user lands on the intake screen. Remove `open=1` for fresh programs.
- Add a `Draft brief` status pill (amber) alongside existing `Draft / In progress / Synthesized`. "Continue" button links to the intake for uncommitted programs.
- Empty-form helper copy updated: *"Name the program to open its brief intake. Nothing runs until you've captured what to research."*

### 6. Legacy `StudyWizardModal` alignment

- `StudyWizardModal` still exists for one-off ad-hoc drafts from `SessionsHub`, but on entry it now pre-fills `brief_raw` from the active program's committed brief when a `projectId` is in the URL. If no program is active, it behaves as today.
- `AutoRunConsole.onNeedBrief` now routes to `ProgramBriefIntake` when triggered inside a program context.

## Out of scope (for this pass)

- Backfilling `brief_committed_at = now()` on existing programs so they don't get locked out — we'll add a one-shot SQL update in the same migration marking every existing project as committed (with `brief_raw = title` placeholder) so no in-flight work is blocked. New programs go through the new door.
- Multilingual dictation and OCR of scanned PDFs — already handled by existing `transcribeAudio` / `parseUpload`; no change.
- Redesigning the Cast/Group/Rehearse stages themselves.

## Files touched

- New: `src/components/personas/StudyWizard/ProgramBriefIntake.tsx`
- New: `src/lib/personas/project-brief.functions.ts`
- New: migration adding `brief_raw / brief_scope / brief_uploads / brief_committed_at` to `persona_projects` + backfill.
- Edit: `src/components/personas/StudyWizard/ProgramsIndex.tsx` (navigation target, status pill, copy).
- Edit: `src/components/personas/StudioStepper.tsx` (add Stage 00, gate downstream).
- Edit: routes `personas.index.tsx`, `personas.segments.tsx`, `personas.studies.tsx` (render intake when uncommitted).
- Edit: `src/lib/personas/generate.functions.ts`, `study.functions.ts`, `autorun.functions.ts`, `study-autorun.ts` — add `assertProgramBriefCommitted(projectId)` guard.
- Edit: `src/components/personas/StudyWizard/WizardModal.tsx` — pre-fill from program brief; adjust `onNeedBrief`.

## Result

The moment an admin names a new program, they land on a required intake screen: type, dictate, or upload the brief; enrich into a structured Research Scope; confirm. Only then does the workspace unlock. Every downstream server function refuses to run without a committed brief, so no AI ever fires without knowing what it's researching.
