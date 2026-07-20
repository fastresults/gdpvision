# Stage 03 · Studies — AI-First Auto-Compose

## Problem
`/admin/countries/$code/personas/studies` (route file `countries.$code.personas.studies.tsx`) is currently a purely manual 3-step form:

1. Pick segment
2. Pick method (survey / focus group / creative test)
3. Frame title + objective

This contradicts the AI-first mandate. Stages 01 (Brief) and 02 (Blueprint) already have "Auto-run", and Chamber 07's Studio Wizard runs Brief → Outcome → Cast → Commit → Synthesis end-to-end. Stage 03, however, forces the operator to hand-pick everything before a study can be created.

## Objective
When the operator lands on Stage 03, an AI Composer picks the highest-value segment, chooses the appropriate method, and drafts a title + objective grounded in the country's brief/blueprint context. The operator sees a **filled-in preview** they can approve, edit, or auto-run into synthesis. Manual mode remains available as a disclosure.

## Design

### Default state = Auto-composed
- On page open (segments.length ≥ 1), immediately fire `composeStudy` (new server function) which returns `{ segmentId, kind, title, objective, rationale, evidence }`.
- Preview sidebar renders the composed study with a `AI · composed` chip and a "Why this pick" popover (rationale + 2-3 citations from corpus / brief scope).
- Primary CTA becomes **"Create & run synthesis"** (one click → create study → navigate to `/studies/$id` with `autoRun=1`).
- Secondary CTAs: **"Edit before creating"** (unlocks the 3-step form pre-filled) · **"Recompose"** (regenerates with a fresh seed) · **"Manual mode"** (collapses AI card, current form is exposed).

### Manual mode = Opt-in
- Existing 3-step composer stays intact, but rendered inside a `<details>` block ("Compose manually") that is closed by default when AI compose succeeds.
- If `composeStudy` fails (no segments, model error, quota), the manual form auto-expands with an inline notice.

### Auto-run into synthesis
- `createStudy` today navigates to `/studies/$id`. When invoked from the AI Composer's primary CTA, we pass a `?auto=1` query param and the study detail page kicks off synthesis automatically (uses existing synth trigger, same pattern used elsewhere).

## Technical Details

### New server fn: `src/lib/personas/compose-study.functions.ts`
- Input: `{ countryCode }`
- Loads: segments (via `listSegments`), latest brief_scope + outcome_blueprint from most recent `persona_study_drafts` for country, prior studies (to avoid duplication).
- Calls Lovable AI Gateway (`openai/gpt-5.4-mini`, 45s timeout, JSON mode) with a compact prompt:
  - "Given these segments, prior studies, and country brief, pick the single segment + one method (`survey`/`focus_group`/`creative_test`) that best advances an open decision. Return `{segment_id, kind, title, objective, rationale, evidence:[{quote,source}]}`."
- Server validates: `segment_id` exists in country, `kind ∈ METHODS`, title 6–90 chars, objective 20–240 chars. On validation failure → single retry with corrective feedback, then return `{ ok:false, reason }`.
- Persist last composition on `persona_composer_cache` (optional; skip if scope creep) — for v1, just return fresh.

### UI changes: `countries.$code.personas.studies.tsx`
- Add `AiComposerCard` component at top of the composer column (above `StepBlock 1`).
- New `useQuery(["study-composer", code])` calling `composeStudy` — runs on mount.
- Wire "Create & run synthesis" to `createStudy` + navigate with `?auto=1`.
- Wrap existing `StepBlock` chain in `<details>` with summary "Compose manually · pick segment, method, title".
- When user clicks "Edit before creating", set local state to pre-fill `segmentId`, `kind`, `title`, `objective` from the AI proposal AND open the details block.

### Study detail auto-run
- Read `useSearch` for `auto=1` on `personas.studies.$id.tsx`; if present and study is `draft`, trigger existing synthesis mutation once and clear the flag from URL.

### Fallbacks & errors
- No segments → keep current `EmptyStart` (unchanged).
- AI failure → show inline "AI composer unavailable — compose manually" and expand manual form.
- Rate-limit (429) / credits (402) → surface exact message per gateway rules.

## Out of Scope
- Changing the Studio Wizard (already AI-driven).
- Rewriting synthesis logic on the study detail page.
- Segment auto-generation (Stage 02 owns that).

## Files Touched
- **New**: `src/lib/personas/compose-study.functions.ts`
- **Edit**: `src/routes/_authenticated/admin/countries.$code.personas.studies.tsx` (add AI card, wrap manual form in `<details>`, wire auto=1 nav)
- **Edit**: `src/routes/_authenticated/admin/countries.$code.personas.studies.$id.tsx` (respect `?auto=1`)
