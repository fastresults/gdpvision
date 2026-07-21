# AI-First Program Setup — Brief → Blueprint

## Problem

Today, after committing the brief the admin still has to manually walk Stage 02 (Segments), Stage 03 (Studies), and set persona counts before anything runs. That contradicts the AI-first promise: the brief already has enough context for the model to propose the entire research design.

## Target flow (3 screens instead of 4+ stages)

```text
1. BRIEF INTAKE         2. AI BLUEPRINT (auto)         3. REHEARSE / RUN
   ─────────────           ──────────────────             ───────────────
   Type / dictate /   →    Segments (proposed)      →    Auto-run all
   upload sources          Personas/segment (proposed)   studies, watch
   → Commit                Studies (proposed)            live progress
                           → Approve or Refine
```

The user's only mandatory intervention is (a) capturing the brief and (b) approving the blueprint. Everything else is a refinement, not a step.

## What changes

### 1. New server fn `composeBlueprint` (`src/lib/personas/blueprint.functions.ts`)
Runs immediately after `commitProjectBrief`. One AI call (Lovable AI Gateway, `google/gemini-2.5-pro`, `response_format: json_object`) returns a full research blueprint from `brief_scope` + `brief_raw`:

```json
{
  "segments": [
    { "name": "…", "rationale": "…", "recommended_personas": 8, "priority": "primary|secondary" }
  ],
  "studies": [
    { "title": "…", "method": "qual|quant|mixed", "segment_names": ["…"], "objectives": ["…"], "instruments": ["interview_guide","survey"] }
  ],
  "notes": "assumptions / trade-offs"
}
```

Guardrails: 3–8 segments, 2–6 studies, persona counts clamped 4–12. Persists the raw proposal as `persona_projects.blueprint_proposal` (jsonb) + `blueprint_generated_at`.

### 2. New `approveBlueprint` server fn
Takes the (possibly edited) blueprint and fans it out atomically:
- Creates `persona_segments` rows scoped to `project_id` (reusing existing `generateSegment` internals, but batched).
- Writes `recommended_personas` onto each segment (`persona_segments.persona_target_count int`).
- Creates `studies` rows via `createStudy` (already project-scoped), pre-linked to their segments.
- Flips `persona_projects.blueprint_committed_at`.
- Enqueues auto-run for persona generation → study composition → rehearse — reuses the existing autorun pipeline, no new engine.

### 3. New screen: `BlueprintReview.tsx` (`src/components/personas/StudyWizard/`)
Renders the proposal as an editable canvas — not a form wall:
- Segment cards with inline rename, priority toggle, slider for persona count, "remove", "add".
- Study cards with inline title/method/segment picker, "remove", "add".
- Two primary actions: **Approve & Run** (default) and **Refine with AI** (free-text delta → re-runs `composeBlueprint` with the delta as extra instruction).
- Header shows the source brief scope inline so the user sees what the AI heard.

### 4. Router / stepper collapse
- `ProgramBriefIntake` on commit → navigate directly to `personas/blueprint` (new route) instead of `personas/index` (Cast).
- Old `Stage 02 · Segments` and `Stage 03 · Studies` routes stay reachable as "Refine" deep-links but are removed from the primary stepper.
- `StudioStepper` reduces to three chips: **Brief · Blueprint · Rehearse**. The old cast/group/rehearse split becomes internal phases of Rehearse's autorun console.
- `ProgramsIndex` "Continue" button routes to the earliest incomplete of {brief, blueprint, rehearse}.

### 5. Auto-kickoff after approval
`approveBlueprint` publishes the autorun beacon so `AutoRunConsole` starts immediately without a second click. If the run stalls, the console's existing self-heal/resume path handles it — no new plumbing.

### 6. Schema additions (single migration)
- `persona_projects.blueprint_proposal jsonb`
- `persona_projects.blueprint_generated_at timestamptz`
- `persona_projects.blueprint_committed_at timestamptz`
- `persona_segments.persona_target_count int` (default 8, check 1–20)

RLS unchanged (inherits project scoping). No GRANT changes needed (existing tables).

### 7. Backwards compatibility
- Existing programs without a blueprint (all current ones) treat the blueprint as satisfied when they already have ≥1 segment AND ≥1 study — the stepper skips straight to Rehearse. No forced replays.
- The old `composeSegments` / `composeStudy` fns stay; `composeBlueprint` calls into `composeSegments`-style prompt logic once instead of twice, then hands off to `approveBlueprint` for persistence.

## Files touched

- **New**: `src/lib/personas/blueprint.functions.ts`, `src/components/personas/StudyWizard/BlueprintReview.tsx`, `src/routes/_authenticated/admin/countries.$code.personas.blueprint.tsx`, one migration.
- **Edit**: `ProgramBriefIntake.tsx` (redirect target on commit), `StudioStepper.tsx` (collapse to 3 chips), `ProgramsIndex.tsx` ("Continue" routing), `src/hooks/useProgramBriefGate.ts` (add `blueprintCommitted`), `study-autorun.ts` (accept pre-linked segment/study ids from blueprint, skip re-composition when present).
- **Unchanged**: `compose-segments.functions.ts`, `compose-study.functions.ts`, `autorun.functions.ts`, `generate.functions.ts` — reused as building blocks.

## Out of scope

- Chamber 01–06 workflows.
- The public marketing site.
- Rewriting the autorun engine — this plan feeds it, not replaces it.

## Success criteria

1. From a fresh program, admin captures the brief once and sees a fully populated blueprint (segments + persona counts + studies) with zero extra clicks.
2. "Approve & Run" moves straight to the live Rehearse console.
3. Any pane can be refined via inline edits or a free-text "Refine with AI" delta.
4. No existing in-flight program is broken (compat rule above).
