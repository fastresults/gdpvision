# Persona Lab Studio — Guidance Review

I walked the rebuilt Stage 01 → 02 → 03 → Study Detail path end-to-end and cross-checked it against the sidebar rail, journey board, composer, and Auto-run CTA. The bones are right; the guidance breaks in six specific places. Below is what breaks, why the user gets lost, and the minimal, presentation-only fixes.

## Where the guidance breaks

### 1. Two competing "start here" surfaces on Stage 01
Stage 01 (`personas.index.tsx`) shows, in order: header → Journey Board (3 cards) → **black Auto-run CTA** → SessionsHub (in-flight drafts) → **Manual "Generate one persona" form** → persona library.

A first-time user sees three equally-emphatic entry points ("Journey card #1 Generate personas", "Launch Research Studio", "Manual · Generate one persona") and cannot tell which one is the recommended path. The sidebar already promotes Research Studio at the top; putting a second identical black CTA halfway down the page competes with it. The manual generator is a power-user escape hatch but sits above the library as if it were the main action.

### 2. Journey card #1 "Generate personas" links to the page you're already on
On Stage 01 the first `JourneyCard` (`to="/admin/countries/$code/personas"`) links back to itself. It reads as a broken next-step. The card should either be marked as "You are here" or should scroll to the manual generator / open the wizard — not repeat the URL.

### 3. Stage 02 (Segments) has no stepper, no preview, no coach — it's the pre-rebuild UI
`personas.segments.tsx` is a flat "prompt + size + Generate" form. After the guided rail on Stage 01 and the 3-step composer on Stage 03, Stage 02 feels like a different product. It also never tells the user what a "segment" is versus a "persona", why size matters, or what happens next. There is no "→ Design a study with this segment" CTA at the end of a successful generation — the user has to guess.

### 4. Stage 03 has TWO steppers stacked on top of each other
The composer renders:
- `ThreatStepper`-style "How this works" 4-beat strip (`Pick segment · Choose method · Frame question · AI synthesizes`), then
- the `StepBlock` 1/2/3 numbered composer sections below.

Same numbers, same labels, different visual language, 6 inches apart. The 4-beat strip is redundant with the sidebar rail (which already says "03 · Rehearse the conversation") and with the numbered `StepBlock`s. It should be removed.

### 5. Sticky preview does not scroll the user to the active step
When the user completes step 1 the composer doesn't autoscroll or focus step 2, and the preview panel doesn't say "Next: choose a method". `currentStep` is computed but never surfaced except in a single 10px "Complete step N to continue" line under the CTA. On a tall screen users lose their place.

### 6. Study Detail hides the primary action behind the phase ribbon
`studies.$id.tsx` shows: back link → header → phase ribbon + coach copy → **action buttons (Draft / Run)** → questions → synthesis.

In phase `drafted` the coach copy says "Start by AI-drafting 8 questions", but the button is a secondary outline style (`border-line-200 bg-paper-0`) while "Run study" (disabled at this phase) is the filled black primary. The user sees a disabled primary button and an unstyled secondary — the wrong action looks like the intended one. Primary emphasis must swap based on `phase`.

Additionally, the phase ribbon flips to `running` only while the mutation is pending in this browser tab. If the user reloads mid-run, phase falls back to `questions` even though the study is actually executing — the ribbon lies. It should read `study.status` as the source of truth.

## Fixes (presentation-only, no business logic changes)

### `src/routes/_authenticated/admin/countries.$code.personas.index.tsx`
- Remove the standalone "Auto-run" black CTA card (lines 117–137). The sidebar Research Studio tile already owns that CTA — one launch point, not two.
- Collapse the "Manual · Generate one persona" block into a `<details>` disclosure labeled "Advanced · Hand-craft a single persona" placed **below** the library, not above it. Default collapsed.
- Change Journey card #1 into a "You are here" state: render it as non-linked, add a subtle "Current step" chip, and make its CTA anchor-scroll to the SessionsHub / advanced generator.
- Reorder the page: header → Journey Board → SessionsHub → Library → (collapsed) Advanced generator.

### `src/routes/_authenticated/admin/countries.$code.personas.segments.tsx`
- Add the same `header` pattern used on Stage 03 (`Stage 02 · Group your public` + one-line coach).
- Wrap the form in a single `StepBlock`-style card titled "Describe the audience" with helper copy explaining what a segment is and how `size` shapes divergence.
- On successful generation, render an inline success strip with a primary CTA: `Design a study with "{segment.label}" →` linking to `/personas/studies?segmentId=…`.
- Add an empty-state that mirrors Stage 03's `EmptyStart` when `segments.length === 0`, pointing at the prompt textarea.

### `src/routes/_authenticated/admin/countries.$code.personas.studies.tsx`
- Delete the 4-beat "How this works" `<ol>` (lines 145–163). The sidebar rail + numbered `StepBlock`s already communicate order.
- When a step becomes `done`, scroll its successor into view and focus its first control (`useEffect` on `currentStep`).
- Move the "Complete step N" hint out of 10px muted text into the sticky preview header ("Next: choose a method") with a clear arrow icon.
- In the sticky preview, when `ready === true`, add a green check strip above the CTA ("Ready to create") so completion is visually rewarded.

### `src/routes/_authenticated/admin/countries.$code.personas.studies.$id.tsx`
- Derive `phase` from `study.status` first, and only fall back to local mutation state — so a reload during a run still shows `running`.
- Swap button emphasis by phase:
  - `drafted` → "AI-draft questions" is primary (filled black); "Run study" is disabled ghost.
  - `questions` → "Run study" is primary; "Re-draft" becomes secondary.
  - `running` → both disabled with a live "Personas responding…" pill.
  - `synthesized` → add a tertiary "Start a follow-up study" link that pre-fills the composer with the same segment.
- Move the action buttons **above** the phase ribbon so the primary action is the first thing on screen after the header.

## Out of scope for this pass
Server functions, DB schema, wizard modal internals (`WizardModal.tsx`), auto-run pipeline, and citation rendering are untouched. This plan is strictly guidance/UX polish on the four route files and their shared primitives.
