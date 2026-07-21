## Two things to fix

### 1. UI conflict: "AUTO-RUN COMPLETE · 11 SYNTHESIZED" vs. "0/11 · 11 RUNNING"

Root cause: two counters read from different sources.

- The green banner and "Latest synthesis" card read `study_reports` rows (the durable synthesis artifacts).
- The Studio Status rail counts `studies.status`. That column is only flipped from `running` → `complete` at the tail of `runStudySynthesis`. If synthesis succeeded but the status-update RPC never landed (transient error, tab closed mid-flight, or a Phase B retry that wrote the report but bailed before the update), the row stays `running` forever even though the report exists — exactly what the screenshot shows.
- Compounding it, `studiesQuery` has no `refetchInterval`, so the rail is frozen at the value from initial load and only refreshes on manual invalidation.

Fix (frontend + one server safety net):
- Make **synthesis presence** the single source of truth for "done". In `StudioStatusRail`, treat a study as `synthesized` when either `studies.status ∈ {complete, synthesized}` **or** a `study_reports` row exists for it. Pass the digest ids down to the rail, or compute `doneIds = new Set(digest.map(d => d.id))` in the route and hand a merged `done`/`running`/`drafts` set to the rail. Same merge feeds the `StudyGroup` sections so a synthesized study never appears under "Running".
- Add `refetchInterval: 10_000` to `studiesQuery` while `autoState.phase === "running"` and drop it to `false` otherwise, so the rail can't go stale during an auto-run.
- Server safety net in `runStudySynthesis`: wrap the final `studies.update({status:'complete'})` so that if the report upsert succeeded but the status flip failed, a follow-up idempotent reconciler flips any `studies.status = 'running'` whose `study_reports.summary_md` is non-empty. Call it at the top of `listStudies` (cheap `update … where` scoped to the country) so returning from a broken run auto-heals.

Net effect: the screenshot state ("11 reports written, status still running") self-corrects on next fetch and the rail matches the banner.

### 2. Multiple research projects per country (portfolio of briefs)

Today `persona_study_drafts` is effectively one active brief per country, and `study_program_reports` has `unique(country_code)` — so re-running Chamber 07 for a new topic overwrites the last program memo. The user needs several concurrent **projects** (each = one brief → segments → studies → program memo), all owned by the country, all indexed into the second brain.

#### Data model

New table `persona_projects` (one row = one research project):
- `country_code`, `title`, `slug`, `status` (`active` | `archived`), `visibility` (`public` | `private`), `owner_country_code`, `created_by`, `created_at`, `updated_at`.
- RLS via existing `has_country_access(country_code)`; grants to `authenticated` + `service_role`.

Attach existing tables to a project:
- `persona_study_drafts.project_id uuid references persona_projects(id) on delete cascade` (nullable → backfilled to a per-country "Default project").
- `studies.project_id` (same).
- `study_program_reports`: drop `unique(country_code)`, add `unique(project_id)`; keep `country_code` for scoping/second-brain joins.
- Persona segments (`persona_segments`) inherit the project via their draft; no schema change needed if segments already join through the draft, otherwise add `project_id` there too.

Backfill migration:
- For every country with existing drafts/studies/reports, insert one `persona_projects` row (title: "Default project", status `active`) and set `project_id` on every existing draft, study, and program report to that row.

#### Server functions

`src/lib/personas/projects.functions.ts` (new):
- `listProjects({ countryCode })` — projects with rollup counts (segments, studies, synthesized, latest program report timestamp).
- `createProject({ countryCode, title, visibility })` — creates row + an empty draft scoped to it; returns `projectId`.
- `renameProject`, `archiveProject`, `deleteProject` (soft/cascade behind confirm).
- `getActiveProject({ countryCode })` — resolves the current project id from route param or "most recently updated".

Update existing functions to be **project-scoped**, not country-scoped:
- `listStudies`, `listStudiesWithReports`, `createStudy`, `composeSegments`, `composeStudy`, `synthesizeStudyProgram`, `getStudyProgramReport`, and all auto-run helpers in `study-autorun.ts` accept `{ projectId }` (fallback: resolve default project by country when not supplied — keeps legacy callers alive during rollout).
- Auto-run beacon key changes from `personas:${code}` to `personas:${code}:${projectId}` so parallel projects don't stomp each other.

#### Routes / URLs

- Add `/_authenticated/admin/countries.$code.personas.projects.tsx` — project picker/index (grid of project cards with progress bars, "New project" button).
- Existing stage routes become project-scoped:
  `.../personas/$projectId/brief`, `.../personas/$projectId/segments`, `.../personas/$projectId/studies`, `.../personas/$projectId/studies/$id`.
- Keep the old `/personas/…` paths as thin redirects that resolve to the country's default project id, so shared links don't 404.

#### UI

- `ChamberPanel` for Chamber 07 lands on the projects index instead of jumping straight into Stage 01.
- `StudioStepper` gets a project switcher pill (top-left) with the active project title and a dropdown of siblings + "New project…".
- `ProgramSynthesisCard` header shows the project title; if the country has ≥2 projects, add a "Compare across projects" secondary action (loads a lightweight `country_program_index` view).

#### Second-brain integration

- On every successful `synthesizeStudyProgram`, upsert a memory object of type `research_program`:
  `{ project_id, country_code, title, summary_md, top_recommendations, citations, updated_at }`.
- `study_reports` synthesis writes a `research_study` memory object per study (project-tagged) — dedup key `study_id`, same idempotent upsert contract already used elsewhere.
- Constellation (`BrainConstellation`) gets a new node cluster **"Research"** grouped by project, with each program memo as the anchor and its studies orbiting.
- Global "Ask the ledger" gains a `project` filter so the user can ask against one project's evidence set.

### Files to add / edit

New:
- `supabase/migrations/<ts>_persona_projects.sql` (table, FKs, grants, RLS, unique swap on `study_program_reports`, backfill).
- `src/lib/personas/projects.functions.ts`.
- `src/routes/_authenticated/admin/countries.$code.personas.projects.tsx`.
- `src/routes/_authenticated/admin/countries.$code.personas.$projectId.brief.tsx` (+ segments/studies/studies.$id, moving the current files).
- `src/components/personas/ProjectSwitcher.tsx`.

Edit:
- `src/lib/personas/study.functions.ts`, `wizard.functions.ts`, `compose-segments.functions.ts`, `compose-study.functions.ts`, `study-autorun.ts` — thread `projectId`, add synthesis→status reconciler.
- `src/components/personas/StudioStepper.tsx`, `StudyWizard/StudioStatusRail.tsx`, `StudyWizard/SynthesisDigest.tsx`, `StudyWizard/ProgramSynthesisCard.tsx`.
- `src/components/autorun/AutoRunBeacon.tsx` and `src/lib/autorun/beacon.ts` — project-scoped keys.
- `src/components/country-data/BrainConstellation.tsx` + memory writers to emit `research_program` / `research_study` objects.
- `src/components/country/ChambersLauncher.tsx` — Chamber 07 lands on projects index.

### Out of scope

- Cross-project synthesis (a "country meta-memo" spanning projects) — placeholder only for now.
- Sharing a project across countries.
