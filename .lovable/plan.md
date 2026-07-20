## The problem

Stage 02 today only fires Auto-run silently on first mount when: personas exist, segments = 0, and the `stage02:autorun-consumed` localStorage flag is unset. Once any of those change (as on Grenada now — 5 segments, flag set), there is **no button anywhere** to start it. The header says "Auto-run casts them" but the only action visible is `PROPOSE`, which drafts proposals without casting or advancing. That is the unintuitive gap you're seeing.

## What to change (UI-only)

1. **Add a primary "Start Auto-run" button** in `countries.$code.personas.segments.tsx`, placed in the page header (right-aligned, next to the H2) so it's the first thing the eye lands on. It calls the existing `runAuto()` and clears the consumed flag. Label shifts with state:
   - idle / consumed → **`▶ Start Auto-run`** (primary, filled ink-950)
   - active (proposing/casting/advancing) → **`⏸ Cancel Auto-run`**
   - paused / error → **`▶ Resume Auto-run`**
   - complete → **`↻ Run again`** (ghost)

2. **Promote the same control into the AI Proposals panel header**, replacing today's ambiguous `PROPOSE` button. `PROPOSE` becomes a secondary "Draft only (no cast)" action under a small overflow, so the primary path is unmistakably Auto-run.

3. **Persistent status chip in `StudioStepper`** — a small right-aligned pill on the Group step showing `AUTO · idle | running · casting 2/3 | paused | done`, clickable to jump to the banner. This makes Auto-run legible across Cast / Group / Rehearse, addressing the same confusion if it recurs on other stages.

4. **First-run coach line** under the H2 when segments already exist and the consumed flag is set: *"Auto-run already handed off once. Press Start Auto-run to draft a fresh set and cast them."* Removes the "why is nothing happening?" moment.

5. **Empty-state copy fix** in the proposals panel: replace *"No proposals pending — Regenerate to have the AI draft a new set."* with *"Press Start Auto-run above to draft and cast segments, or Draft only to preview proposals without casting."*

No changes to `compose-segments.functions.ts`, `runAuto` logic, casting, or the state machine — only surfacing the existing capability.

## Files touched

- `src/routes/_authenticated/admin/countries.$code.personas.segments.tsx` — header CTA, panel header rewire, copy.
- `src/components/personas/StudioStepper.tsx` — optional `autoStatus` prop + pill rendering; wired from the segments route (and later Stage 01/03 in the same shape).

## Out of scope

Stage 01 and Stage 03 Auto-run controls follow the same pattern but are not in this plan — call them out in a follow-up if you want them harmonized in the same pass.
