## Repurpose right-rail as a live Persona Lab status panel

Replace the always-empty "Study preview" aside on Stage 03 with a persistent status rail that's genuinely useful whether the user is idle, mid auto-run, or reviewing finished work. The manual-composer preview moves inside the "Compose manually" disclosure where it belongs.

### What the new right rail shows

Sticky right column (`lg:sticky lg:top-4`), same width as today (~320px). Sections stack top-to-bottom:

1. **Pipeline status** — one-line health chip
   - `Auto-run in progress · 5/11` (with a thin shimmer bar) when `autoState.phase !== "idle"`.
   - `All studies synthesized` (emerald) when every study has a report.
   - `N drafts pending · M running` when idle but incomplete.
   - `No studies yet` empty state with a "Start auto-run" button (mirrors the header CTA).

2. **Counts strip** — 3 tiny stat tiles: Drafts / Running / Synthesized. Uses the same `studies` array already in memory, no new query.

3. **Latest synthesized** — the most recent study with a report: title, segment, 1-line summary excerpt, and a "Open →" deep link to its detail page. Uses the existing `digest` data already fetched by `listStudiesWithReports`.

4. **Quick actions**
   - `Resume incomplete` — runs `completeIncompleteStudies` (already imported). Disabled when nothing is incomplete or auto-run is active.
   - `Open Second Brain` — link back to the country brain.
   - `Compose manually` — scrolls to and opens the manual `<details>` disclosure.

5. **Failed items** (only if any) — compact list of studies whose last run errored, with a per-item retry button calling `runStudyResponses`/`runStudySynthesis` via the existing helpers.

### Manual composer preview

Move the current `<aside>` block (title / segment / method / objective / "Create this study" button) **inside** the `<details>` for "Compose manually", rendered as a right column of a nested 2-col grid there. It only appears when the user explicitly opens manual mode, so it's never empty on screen.

### Files to edit

- `src/routes/_authenticated/admin/countries.$code.personas.studies.tsx`
  - Extract the current sticky `<aside>` (lines ~614–655) and relocate it inside the manual `<details>` panel.
  - Add a new `<StudioStatusRail />` component in the same file (or a sibling under `src/components/personas/StudyWizard/`) rendered as the right column of the outer grid at all times.
  - Wire it to existing state: `studies`, `digest`, `autoState`, `startAutoRun`, `cancelAutoRun`, plus a new `resumeIncomplete` handler that calls `completeIncompleteStudies` (already imported via `study-autorun.ts`) and publishes to the auto-run beacon.

No server, schema, or data-model changes. No new dependencies. Purely a right-rail UX repurpose.

### Out of scope

- No changes to the auto-run engine, beacon, or synthesis pipeline.
- No changes to Stage 01 / Stage 02 rails (can be a follow-up if useful).
- No new backend queries — reuses `studiesQuery` and `studiesWithReportsQuery` already on the page.
