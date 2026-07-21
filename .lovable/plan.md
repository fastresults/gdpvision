## Mission restatement

You are saying: Chamber 07 must behave like a program-scoped research workspace, not a country-wide dumping ground.

When an admin enters the Persona Lab / Studies screen for a country, they should not immediately see counts or content from a prior research program. They should see an index of programs and choose one, or create a new program. A newly created program must show zero inherited cast, segment, or study state until the admin explicitly starts work inside that program.

## What I verified

- The top stage bar is still showing `91 personas` because `StudioStepper` calls `listPersonas({ countryCode })` without a `projectId`.
- `listPersonas` currently queries every persona for the country, not personas attached to the active program.
- The database confirms Grenada has `91` total personas, and all `91` are reachable through the old `CBI Brand Checkup` program's segments.
- The newer `test` program has `0` personas reachable through its own segments, `0` segments, but `1` study.
- That means the screenshot is not just a visual bug: the UI still has a country-scoped Stage 01 count and is presenting prior-program cast data as if it belongs to the current/blank workspace.

## Exact problem

The system is partially program-scoped and partially country-scoped:

```text
Program index        -> program-scoped
Segments             -> mostly program-scoped
Studies              -> mostly program-scoped
Stage 01 personas    -> still country-scoped
Stage status bar     -> mixes current program state with all-country persona state
```

So even after the prior fix, the app can still show legacy data because personas were never fully assigned to a `project_id`; they are linked indirectly through `persona_segment_members`, while the Stage 01 fetch ignores that relationship.

## Plan

1. **Make persona reads program-aware**
   - Update the persona listing server function to accept an optional `projectId`.
   - When `projectId` is present, return only personas connected to segments in that program through `persona_segment_members`.
   - When no `projectId` is present, only use country-wide personas on truly country-wide surfaces, not inside a selected/blank program workspace.

2. **Fix the StudioStepper counts**
   - Pass `activeProjectId` into the persona query.
   - If no program is explicitly open, show `0 personas`, `0 segments`, and `0 studies`, or render the stage bar in a neutral “select a program” state.
   - Do not mark Cast/Group/Rehearse complete based on old country-level data.

3. **Fix the Segments screen count leak**
   - Update the Segments route where it currently calls `listPersonas({ countryCode })`.
   - That count should come from the active program only.
   - If there is no active program, it should stay at zero and show the Programs Index only.

4. **Clean up invalid/incomplete program state**
   - The `test` program currently has one study attached to a segment from the old program, but no program-owned segments/personas.
   - Add a guard so creating or running a study can only use a segment whose `project_id` matches the active program.
   - Add a one-time data correction to either move that stray study to the correct original program or remove it from the new `test` program, depending on safest ownership.

5. **Prevent future cross-program contamination**
   - Add server-side validation in `createStudy`, auto-run study drafting, and any segment/study composition helper:
     - if `projectId` is provided, the selected `segmentId` must belong to that same project.
     - fail closed with a clear message instead of creating mixed-program records.

6. **Verify the actual admin flow**
   - Open `/admin/countries/GRD/personas/studies` without a project and confirm it shows only the Programs Index and no old counts.
   - Create a new program and confirm the stage bar starts blank.
   - Open `CBI Brand Checkup` and confirm its 91 personas / 11 segments / 11 studies appear only there.
   - Confirm selecting or creating a study cannot attach an old segment to a new program.

## Success criteria

- A first-time entry into Chamber 07 never shows old program data.
- A new program is visibly empty until work is started inside that program.
- Stage counts are scoped to the selected program.
- Old programs still retain their own historical cast/segments/studies.
- No new study can be created against a segment from another program.