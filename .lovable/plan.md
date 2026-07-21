## The problem

When landing on Chamber 07 (or switching from another project), the screen still fills with content from a prior project — its "AI proposes your next study" card, its Latest Synthesis, its Progress bar — even though the URL has no project selected or a different project is chosen.

Root cause (verified in code):
- `src/routes/_authenticated/admin/countries.$code.personas.studies.tsx` reads `?project=` and, when it's missing, passes `projectId: undefined` to server functions.
- The server functions in `src/lib/personas/study.functions.ts` (`listStudies`, `listStudiesWithReports`, `synthesizeStudyProgram`, `getStudyProgramReport`) fall back to `resolveDefaultProjectId(...)` whenever `projectId` is missing — silently picking the most recent project and returning its studies/reports.
- Result: the Chamber 07 "Studies" landing renders whichever project was last used, and the AI composer, right rail, and synthesis card all speak from that ghost project.

## The fix — a clean "no project selected" landing

**1. Make project selection explicit at the Chamber 07 entry point.**
- `personas.index.tsx` (Chamber 07 hub): the "Studies" tile navigates to `/…/personas/studies` with NO `project` param. That's fine — the studies route will then show the Programs Index only.
- `personas.studies.tsx`: when `search.project` is missing, render ONLY the Programs Index card (list of existing programs + "New Program" CTA + "Back to country"). Do NOT render: header stage strip's studies count for a specific project, "AI proposes your next study", the Auto-run banner, the Studio Status rail, the Latest Synthesis card, the wizard steps, or the ProgramSynthesis card. Nothing project-scoped appears until the user clicks a program (or creates one).
- Clicking a program in the index sets `?project=<id>` and the working surface mounts fresh.

**2. Remove the silent default-project fallback on the server.**
- Update `listStudies`, `listStudiesWithReports`, `getStudyProgramReport`, and `synthesizeStudyProgram` in `src/lib/personas/study.functions.ts` so that when `projectId` is not supplied, they return an empty result (`{ studies: [], reports: [] }` etc.) instead of calling `resolveDefaultProjectId`. This closes the leak at the source so no future caller can accidentally show cross-project data.
- Keep `resolveDefaultProjectId` available for the specific places that legitimately need it (e.g. auto-run entry points that create a "default" program on first use), but never invoke it inside read-list handlers.

**3. Reset transient UI state on project change / clear.**
- The `useEffect` reset already added on project change stays. Extend it so that when `activeProjectId` becomes `undefined` (user hits "All programs"), the composer query, wizard fields, and auto-run beacon state for the previous project are cleared from the cache (`qc.removeQueries({ queryKey: ['study-composer', code] })`, same for `['studies', code]`, `['studies-digest', code]`).

**4. Header stage strip.**
- The top strip (91 personas · 11 segments · 19 studies) is country-wide and stays. But the "0/1 STUDIES · 11 SEGMENTS" project sub-header only renders when a project is actually selected.

## Files to change

- `src/routes/_authenticated/admin/countries.$code.personas.studies.tsx` — gate the entire working surface behind `activeProjectId`; render Programs Index as the sole content when none is selected; clear caches when the project param clears.
- `src/lib/personas/study.functions.ts` — drop `resolveDefaultProjectId` fallback in `listStudies`, `listStudiesWithReports`, `getStudyProgramReport`, `synthesizeStudyProgram`; return empty payloads when `projectId` is absent.
- `src/components/personas/StudyWizard/ProjectSwitcher.tsx` — verify "All programs" / clear-selection navigates to `/…/personas/studies` with no `project` param and does not preserve the previous one.

## Acceptance

- Landing on `/admin/countries/GRD/personas/studies` (no `?project=`) shows only the Programs Index and "New Program" CTA. No prior study titles, no synthesis text, no composer card anywhere on screen.
- Selecting a program from the index navigates with `?project=<id>` and the studies surface mounts with ONLY that project's data.
- Creating a new program routes to `?project=<newId>` with the working surface empty until studies are drafted for that program.
- Switching from Project A → "All programs" → Project B never shows Project A content on Project B's screen or on the index.