## Goal
Make every Chamber 07 research program a true clean slate. Creating or selecting a program must only load that program. It must not inherit CBI Brand Checkup’s 11 segments, studies, drafts, reports, or auto-run state, and it must never begin processing until the admin explicitly presses Start Auto-run.

## Confirmed current-state findings
- `persona_projects` exists and studies/reports are project-scoped.
- `persona_segments` is not project-scoped: it has no `project_id` column.
- The GRD database currently has 2 programs:
  - `CBI Brand Checkup` / default: 11 studies, 11 completed.
  - `test`: 1 study.
- GRD has exactly 11 `persona_segments`, all stored only at the country level. Because `listSegments` filters by `country_code` only, every program sees the same 11 segments.
- `listProjects` also reports `segments_total` as the total country segment count, so the Programs Index displays 11 segments for every project even when the project is new.
- Stage 02 still composes and generates segments without a `projectId`, then refreshes all country segments and drafts studies against all 11 country segments.

## Root cause
The previous fixes only scoped the studies/report layer. The Group layer was left country-scoped. A new project can be clean at the studies level but still inherits every segment from the previous/default project because segments and segment membership were never connected to `persona_projects`.

## Implementation plan

### 1. Add project scoping to segments
Create a database migration that:
- Adds `project_id` to `persona_segments`, referencing `persona_projects`.
- Adds an index for fast project-scoped segment reads.
- Backfills existing GRD/default-era segments to the correct default project for their country.
- Keeps existing RLS intact, since access is still country-governed.

Technical note: this is an `ALTER TABLE`, not a new table, so no new table grants are required.

### 2. Make segment server functions project-aware
Update `src/lib/personas/generate.functions.ts`:
- `generateSegment` must require `projectId` and insert it into `persona_segments.project_id`.
- `listSegments` must accept `projectId` and return only that program’s segments.
- `deleteSegment` stays segment-id based, but the UI will only show scoped segment IDs.
- Do not fall back to “all country segments” in project workflows.

### 3. Make the segment composer project-aware
Update `src/lib/personas/compose-segments.functions.ts`:
- Require `projectId`.
- Existing-segment duplicate checks must only look at the active program’s segments.
- The active brief/draft lookup must filter by `project_id` so a new program does not inherit the prior program’s brief.

### 4. Repair Stage 02 end-to-end
Update `src/routes/_authenticated/admin/countries.$code.personas.segments.tsx`:
- `segmentsQuery(code, projectId)` must include `projectId` in the query key and server call.
- If no project is selected, show the Research Programs index / clean selection state rather than a country-wide segment list.
- Pass `projectId` into `composeSegments` and `generateSegment`.
- After casting, refresh only the active project’s segments.
- Draft studies only for the active project’s segments.
- Remove any remaining localStorage keys that are country-only; make them project-specific or eliminate them so old runs cannot mark a new project as consumed.
- Keep URL `auto` stripping: a URL flag must never start Stage 02.

### 5. Repair Stage 03 assumptions about segments
Update `src/routes/_authenticated/admin/countries.$code.personas.studies.tsx`:
- `segmentsQuery(code, projectId)` must return only active-project segments.
- Empty new projects should show zero segments and zero studies until the admin starts or creates work.
- Manual study creation should only offer segments from the active project.
- The program synthesis card should not render old project summaries when the new project has no report.

### 6. Fix project index counts
Update `src/lib/personas/projects.functions.ts`:
- Count segments per project using `persona_segments.project_id`, not country-wide count.
- Existing default program should show 11 segments.
- A new program should show 0 segments until it creates its own.

### 7. Stop every accidental auto-run route
Complete a full search and patch for all automatic execution triggers:
- No `?auto=1` route may start work.
- Creating a project must navigate to a clean workspace only.
- Selecting/continuing a project must navigate to a read-only workspace only.
- AI composer approval may create a draft only; it must not run the study unless the admin explicitly clicks a run/start control.
- Global beacon resume must only resume the active project and must not use country-only state.

### 8. Verify against the exact failure case
After implementation:
- Create a new GRD program by pressing Enter in the name field.
- Confirm the workspace opens with 0 segments, 0 studies, no prior report, and no auto-run beacon.
- Confirm Programs Index shows the prior `CBI Brand Checkup` with 11 segments and the new program with 0.
- Select CBI Brand Checkup, then select the new program again; confirm no bleed-through.
- Confirm pressing Start Auto-run is the only action that starts Stage 02/03 processing.

## Expected result
A research program becomes a sealed workspace:

```text
Program A
  segments A
  studies A
  report A

Program B
  segments B
  studies B
  report B
```

No program can inherit another program’s segments, studies, briefs, synthesis reports, or auto-run state.