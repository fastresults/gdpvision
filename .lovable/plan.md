# Stage 02 · AI-first Segment Composer

## Problem
Stage 02 currently forces the user to hand-write a segment prompt, pick a size, and click Generate. That breaks the auto-run spirit that Stages 01 (Cast) and 03 (Rehearse) already follow — the user is intervened in the middle of a Cast → Group → Rehearse journey that should flow on its own.

The two existing segments on GRD ("Domestic Grassroots & Community Advocates", "Skeptical Local Public") were created manually; nothing today proposes them.

## What to build

**1. New server fn `composeSegments` in `src/lib/personas/compose-segments.functions.ts`**
- Mirrors the shape of `compose-study.functions.ts`.
- Inputs: `countryCode`, optional `count` (default 3).
- Context pulled server-side: active brief (`persona_study_drafts.brief_raw` / `brief_scope`), existing personas (`listPersonas`), existing segments (to avoid duplicates), country pack.
- Calls Lovable AI Gateway (`google/gemini-2.5-flash`, JSON mode, 2-try self-correction like compose-study) to propose N segments, each with `{ label, prompt, size (3–20), rationale, evidence[] }`.
- Validates: label 4–80 chars, prompt 20–400 chars, size clamped, no duplicate labels vs. existing segments.
- Returns `{ ok, proposals[] } | { ok: false, reason }`. Does NOT write to DB — proposals are staged for one-click accept.

**2. New client component `AiSegmentComposer` (in the segments route file, matching `AiComposerCard` pattern)**
- Auto-fires `composeSegments` on mount when `segments.length === 0` OR when user opens the "Propose more" disclosure.
- Renders each proposal as a card: label, rationale, evidence chips, size, and two buttons: **Accept & generate personas** (calls existing `generateSegment` with the proposed prompt/size/visibility=public) and **Dismiss**.
- "Accept all" button runs `generateSegment` sequentially for every proposal, updating the segments list live.
- Loading, error, and rate-limit states surfaced inline.

**3. Demote the manual form**
- The existing "Describe the audience" panel moves into a collapsed `<details>` disclosure labeled "Compose a segment manually", consistent with how Stage 03 handles manual mode.
- Empty-state coach copy updated to say "AI is drafting segment proposals from your brief and personas…".

**4. Auto-run linkage (no orchestrator change needed yet)**
- The Cast → Group hand-off in `SessionsHub` / auto-run console gets a note: once personas exist, Stage 02 auto-proposes segments on visit. Full orchestrator auto-execution of `generateSegment` per proposal is out of scope for this pass — one-click acceptance keeps a human sign-off for grouping, matching the "AI proposes, cabinet ratifies" pattern used in Stage 03's AI Composer.

## Files touched
- `src/lib/personas/compose-segments.functions.ts` — new
- `src/routes/_authenticated/admin/countries.$code.personas.segments.tsx` — mount `AiSegmentComposer`, collapse manual form, refresh empty state

## Out of scope
- Changing the durable auto-run orchestrator (`autorun.functions.ts`) to fire segment creation without any click. Can be a follow-up once one-click acceptance is validated.
- Schema changes.
