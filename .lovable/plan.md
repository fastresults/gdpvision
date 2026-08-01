# Chamber 07 project index and resume experience

## Confirmed problem

The projects exist; they are not missing from the database. Grenada currently has **five** Chamber 07 projects: **three synthetic** and **two field**. The existing `ProgramsIndex` already reads them, but the Chamber entrance hides it inside a collapsed **“Or resume an existing programme”** disclosure beneath the new-project intake. With no `?project=` parameter, the UI prioritizes starting another project instead of showing the existing portfolio. Active selection also depends entirely on that URL parameter.

## Implementation plan

1. **Make “Research projects” the Chamber 07 landing experience**
   - Replace the collapsed resume disclosure with a permanent, first-class portfolio index.
   - Show a concise header with project totals and prominent actions for **New synthetic project** and **New field project**.
   - Do not auto-open one project when several exist; let the administrator intentionally select the correct engagement.

2. **Create a clean, scannable project portfolio**
   - Add filters for **All**, **Field research**, **Synthetic research**, **In progress**, and **Completed**.
   - Sort by most recently updated by default, with search by project title.
   - Each project row/card will show:
     - project title;
     - Field or Synthetic track;
     - current status;
     - current stage and meaningful completion progress;
     - last activity date;
     - counts relevant to the track, such as studies, participants/segments, instruments, sessions, and reports;
     - one clear primary action: **Resume project** or **View results**.
   - Keep rename, archive, and delete as secondary menu actions so the main workflow stays uncluttered.

3. **Derive a trustworthy resume destination**
   - Use the persisted project state to determine the next valid screen:
     - track not selected → track selection;
     - brief incomplete → Brief;
     - programme incomplete → Programme;
     - participants incomplete → Participants;
     - instruments incomplete → Instruments;
     - fieldwork/evidence underway → the latest active stage;
     - completed → results/report.
   - Preserve the existing `?project=<id>` contract so every resumed screen remains scoped to the selected country and project.

4. **Keep switching available after entry**
   - Add the existing project switcher to the Chamber 07 shell so an administrator can move between engagements without returning to the country dashboard.
   - Include a clear **All projects** option that returns to the portfolio index.
   - Ensure every Chamber 07 sub-route carries the selected project ID rather than silently dropping it.

5. **Separate project creation from project retrieval**
   - Move the current AI intake/new-project gate behind the two creation actions instead of making it the default landing screen.
   - Reuse one creation/navigation hook for both the portfolio and project switcher so all new projects land consistently in the Brief stage.

6. **Validate against real Grenada projects**
   - Confirm all five existing projects appear in the correct Field/Synthetic filters.
   - Verify resume routing for the active field programme, the incomplete field programme, the completed synthetic studies, and the two early synthetic projects.
   - Test direct links, returning to **All projects**, switching projects, archive visibility, responsive layout, and country isolation.

## Technical scope

- Refactor the Chamber 07 index route and the existing `ProgramsIndex`/`ProjectSwitcher` components rather than creating a parallel project system.
- Extend the existing authenticated project-list read to return aggregate progress/count data needed by the index.
- No new project table is required; existing `persona_projects`, `studies`, segments, instruments, sessions, drafts, and reports already provide the portfolio data.
- Preserve existing country-scoped access controls and project URL conventions.