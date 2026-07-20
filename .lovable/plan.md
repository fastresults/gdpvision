## Problem
Chamber 07 has a linear "Studio journey" (Stage 01 Cast → 02 Group → 03 Rehearse), but the UI hard-gates movement:
- `JourneyCard` on Stage 01 renders Stages 02/03 as `disabled` (no `<Link>`) when prereqs are empty.
- The sidebar in `countries.$code.personas.tsx` shows a `locked` dot for downstream stages; there is no top-of-page stepper on Stage 02/03 to jump sideways.
- Study detail (`studies.$id`) has no stepper at all — you can only leave via the crumb.

Users must be able to move freely between Stage 01 ↔ 02 ↔ 03 (and Study detail) from anywhere, at any time, regardless of whether prior stages have content.

## Approach
Treat prerequisites as *coaching*, not *gates*. Every stage is always reachable via a persistent, clickable stepper; empty downstream stages render an inline "you need X first" empty state with a one-click link back — but the navigation itself is never blocked.

## Changes

1. **New `StudioStepper` component** (`src/components/personas/StudioStepper.tsx`)
   - Sticky, top-of-content, 3-node stepper: Cast / Group / Rehearse.
   - Each node is always a `<Link>` (never disabled). Active node uses `activeProps`.
   - Visual state per node: `complete` (has rows), `active` (current route), `empty` (no rows, not active). No `locked` state.
   - Small count badge per node ("20 personas", "2 segments", "1 study").
   - Reads counts via `useQuery` on the same query keys already used by the layout, so it's cheap and reactive.

2. **`countries.$code.personas.tsx` (layout)**
   - Keep the left rail as narrative context, but drop the "locked" semantics: all three sidebar links become always-clickable; the amber/green dot stays as informational status only.
   - Remove the `unlocked` prop from `stages[]` and the conditional connector styling that implied gating.

3. **`countries.$code.personas.index.tsx` (Stage 01)**
   - Replace `disabled` + `disabledHint` on the Stage 02/03 `JourneyCard`s with an always-live link. Cards keep their status chip ("empty" / "ready") but click through unconditionally.
   - Mount `<StudioStepper>` above the Journey board for consistency across stages.

4. **`JourneyCard.tsx`**
   - Deprecate the hard-disabled branch: when `count === 0`, still render the `<Link>` and swap the CTA to a soft "Set up" label with a subtle hint. Keep the `disabled` prop but treat it as visual-only (no `pointer-events-none`, no missing anchor). This preserves callers while unblocking navigation.

5. **`countries.$code.personas.segments.tsx` (Stage 02)**
   - Mount `<StudioStepper>` at the top.
   - When `personas.length === 0`, show an inline empty-state card ("Cast a public first — segments group personas you already have") with a primary link back to Stage 01. Do not block the page shell.

6. **`countries.$code.personas.studies.tsx` (Stage 03)**
   - Mount `<StudioStepper>` at the top.
   - When `segments.length === 0`, show inline empty-state coach linking back to Stage 02; AI Composer and manual composer are hidden until a segment exists, but the stepper and navigation remain fully live.

7. **`countries.$code.personas.studies.$id.tsx` (Study detail)**
   - Mount `<StudioStepper>` at the top with Stage 03 marked active so users can jump back to Cast/Group in one click without hunting through breadcrumbs.

## Out of scope
- No changes to server functions, AI composer logic, autorun orchestration, or data model.
- No visual redesign beyond adding the stepper and softening gated states.
