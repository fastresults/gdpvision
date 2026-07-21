## Problem

The Chamber 07 landing (`/admin/countries/$code/personas`) hides the multi-project reality of the studio. There is no index of past synthesized reports and no obvious way to start a new one. The `ProjectSwitcher` (a compact dropdown) only appears deep inside Stage 03 (`/personas/studies`), so from the Stage 01 landing an admin has no signal that "projects" even exist, how many reports have been produced, or how to launch another program.

## Goal

Turn the Chamber 07 landing into a clear **Research Programs index** — a first-class list of every project (past + in-flight), each row showing the finished synthesis status, with a prominent **New research program** action.

## Changes (frontend only)

### 1. New component: `src/components/personas/StudyWizard/ProgramsIndex.tsx`

A McKinsey-grade index card, rendered above the Studio Journey on the personas landing.

Contents:
- Header row: "Research programs" · count · primary CTA **New program** (opens inline title form; reuses `createProject` from `projects.functions.ts`).
- Table/list of every project from `listProjects`:
  - Title (link → Stage 03 with `?project=<id>`)
  - Status chip: **Synthesized** (has_program_memo), **In progress** (studies_total > studies_done), **Draft** (0 studies), **Archived**
  - `studies_done / studies_total` studies · `segments_total` segments
  - Updated timestamp (relative)
  - Row actions: **Open report** (→ Stage 03, scrolls to `ProgramSynthesisCard`), **Continue** (→ Stage 03), overflow → Rename / Archive (uses existing `renameProject`, `archiveProject`)
- Empty state: single centered CTA "Start your first research program" with the same inline title form.

### 2. Update `src/routes/_authenticated/admin/countries.$code.personas.index.tsx`

- Mount `<ProgramsIndex code={code} />` immediately below `StudioStepper` and above the existing header/Studio Journey.
- Keep the existing Journey board, personas library, and advanced generator untouched (they operate on the currently active/most-recent program).
- Journey cards' counts (segments, studies) continue to reflect the country-wide totals as today; the Programs index is the surface for per-program reports.

### 3. Small polish

- On the Stage 03 page, keep the existing `ProjectSwitcher` but add a subtle "← All programs" link back to `/personas` so navigation between the index and a specific program is a single click.
- Ensure `New program` in `ProgramsIndex` navigates the user directly into Stage 03 with `?project=<new-id>` (matching `ProjectSwitcher`'s existing behavior) so auto-run picks it up.

## Out of scope

- No schema changes; `persona_projects` + `study_program_reports` already back this.
- No changes to synthesis logic, auto-run, or report content.
- No changes to Stages 02/03 workflows beyond the "All programs" back-link.

## Acceptance

- From the Chamber 07 landing, an admin sees every past program with a Synthesized/In-progress badge and can open the finished report in one click.
- A **New program** CTA is visible on the landing (both when programs exist and in the empty state) and creating one drops the admin straight into Stage 03 for that program.
