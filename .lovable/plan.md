Make Stage 02 (Group) auto-run the full pipeline: propose segments, cast them, and then draft studies for every segment before handing off to Stage 03 (Rehearse). Stage 03 becomes a review surface, not the drafting surface.

Current state
- Stage 02 auto-runs segments and ends with `navigate({ to: "/admin/countries/$code/personas/studies", search: { auto: 1 } })`.
- Stage 03 auto-runs `composeStudyForSegment` + `createStudy` for each uncovered segment.
- `createStudy` is idempotent on `(country_code, segment_id)` where `status='draft'`, and `AUTO_STUDIES_LOCK` prevents duplicate runs.
- The global auto-run beacon is already published from both stages.

What will change

1. Extend the Stage 02 auto-run state machine
   - Add new phases after `advancing`:
     - `drafting_studies` — running `composeStudyForSegment` + `createStudy` for every segment
     - `study_complete` — finished drafting
     - `study_error` — per-item failures collected
   - Reuse the same loop pattern already in Stage 03: for each segment, call `composeStudyForSegment`, then `createStudy`. Track `handled` set, publish progress, and honor `cancelRef`.

2. Move the study-drafting helper to a shared, client-safe path
   - Extract a single `draftStudiesForSegments` function (or keep logic in the route but share the same `composeStudyForSegment` + `createStudy` calls) so both Stage 02 and Stage 03 can use the same loop.
   - Do not duplicate AI/gateway code; the existing `composeStudyForSegment` server function in `src/lib/personas/compose-study.functions.ts` stays the canonical source.

3. Stage 03 becomes idempotent review
   - When Stage 03 mounts and `uncoveredSegments.length === 0` (because Stage 02 already drafted them), it should show the review list, not attempt another run.
   - Keep the "Start Auto-run" / "Draft missing studies" button available in Stage 03 for any future segments that appear later, but default to idle when everything is already covered.

4. Update global beacon messaging
   - While Stage 02 is drafting studies, publish one combined beacon:
     - `scope: Chamber 07 · Stage 02–03 · ${code}`
     - `title: Drafting studies for every segment`
     - `detail: Drafting 3/5 — Coastal tourism operators`
   - Clear the beacon when Stage 02 completes and navigates to Stage 03, unless there are errors to review.

5. UI changes in Stage 02
   - The auto-run banner must show the new phases:
     - `Casting segments 2/3`
     - `Drafting studies 3/5`
     - `Handing off to Rehearse`
   - `StudioStepper` `autoStatus` should reflect `AUTO · drafting studies 3/5` during the new phase.
   - Keep the same `Cancel Auto-run`, `Stay here`, and `Resume` controls.

6. Handoff behavior
   - After all studies are drafted, wait the same 3-second countdown, then navigate to `/admin/countries/$code/personas/studies` **without** `?auto=1` (or with a different `reviewed=0` flag) so Stage 03 opens in review mode.
   - If the user cancels during drafting, they stay on Stage 02 with a "Resume Auto-run" CTA that picks up from the next un-drafted segment.

7. Safety / idempotency
   - Reuse `AUTO_STUDIES_LOCK` keyed by country code so the same browser tab cannot fan out.
   - Reuse `createStudy` idempotency so re-running or resuming never creates duplicate drafts.
   - Keep per-item error collection: failed segments are recorded, and the loop continues with the rest; the final banner shows `Drafted 4/5 · 1 needs review`.

8. Optional: remove the separate `?auto=1` handoff
   - The `auto=1` search param becomes unnecessary for the happy path because Stage 02 now drafts studies directly. Keep it as a legacy flag so existing links still work, but Stage 03 will treat it as a "draft missing only" trigger rather than a full re-run.

Files to touch
- `src/routes/_authenticated/admin/countries.$code.personas.segments.tsx` — extend state machine and auto-run loop to draft studies.
- `src/routes/_authenticated/admin/countries.$code.personas.studies.tsx` — adjust mount logic so auto-run is defensive and idempotent; show review UI when all segments are covered.
- `src/components/personas/StudioStepper.tsx` — already accepts `autoStatus`; ensure it can render the new combined status strings.
- `src/lib/personas/study.functions.ts` — no change unless new helper needed (already idempotent).
- `src/lib/autorun/beacon.ts` — no change (already supports progress + status).

Technical details
- The loop will run client-side sequential `createServerFn` calls, same as today, with a 250ms UI paint delay between items and 1.5s backoff on errors.
- Use the existing `composeStudyForSegment` and `createStudy` server functions; no new AI model calls needed.
- `AUTO_STUDIES_LOCK` will be acquired in Stage 02 before the study loop and released on completion/cancel/error.
- The localStorage flag `stage02:autorun-consumed:${code}` will be set after the entire pipeline (segments + studies) completes, not after segments alone.

Validation
- After the change, pressing "Start Auto-run" on Stage 02 should:
  1. Propose segments.
  2. Cast each segment.
  3. Draft a study for each segment.
  4. Navigate to Stage 03 showing the review list with no new auto-run triggered.
- Cancelling mid-study should leave a resumeable state on Stage 02.
- No duplicate drafts should be created on re-run or page refresh.