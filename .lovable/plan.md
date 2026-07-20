## Goal

Every "Launch Research Studio" session already persists to `persona_study_drafts` (per user + country, private-visibility). Today the wizard modal always spins up a **new** draft and there's no visible library — so past work is invisible and non-resumable. Build a **Studio Assets Hub** on the Personas page that lists, resumes, renames, duplicates, and deletes those sessions.

## Scope

Frontend + light server-fn additions only. No schema change — `persona_study_drafts` already stores title, step, brief_raw, brief_scope, outcome_raw, outcome_blueprint, cast_draft, uploads, updated_at, and RLS scopes to owner/country.

## Changes

1. **New section on `/admin/countries/$code/personas`** — "Research Studio · Sessions" placed above the existing Persona Library.
   - Table/grid of drafts from `listDrafts` (already exists) showing: title (or "Untitled brief"), current step badge (Brief/Outcome/Cast/Preview/Launch), last updated (relative), brief snippet, committed-study link if any.
   - Row actions: **Resume** (opens `StudyWizardModal` with that `draftId`), **Rename**, **Duplicate**, **Delete**.
   - Empty state with a "Start your first study" CTA that mirrors the existing Launch button.

2. **Wizard modal opens against a specific draft**
   - `StudyWizardModal` already accepts `draftId`; wire the hub's Resume action to pass it and refresh the list on close.
   - Add a small "Save & close" affordance so a session can be paused mid-step and appear in the hub. (Autosave on step transitions already exists; add explicit close = persist current step.)

3. **Server functions (add to `wizard.functions.ts`)**
   - `renameDraft({ id, title })` — updates `title` only.
   - `duplicateDraft({ id })` — deep-copies row (new id, `step="brief"` or preserve step — preserve, so user can fork a cast), scoped to same country/owner.
   - `listDrafts` already returns id/title/step/updated_at/brief_raw — extend to also include `outcome_blueprint` deliverable count and `cast_draft` persona count for richer cards.

4. **Resume-safe wizard init**
   - When `draftId` is provided, skip the `createDraft` effect (already conditional) and jump to the persisted `step`.
   - Ensure `saveDraft` is called on every "Next" and on modal close so no work is lost.

## Out of scope

- No changes to committed personas/segments/studies surfaces.
- No new tables, no visibility changes, no shared-across-users draft sharing (drafts stay owner-private per existing RLS).
- No search/filter UI beyond sort-by-updated (can be added later if the list grows).

## Files

- `src/lib/personas/wizard.functions.ts` — add `renameDraft`, `duplicateDraft`; enrich `listDrafts` payload.
- `src/components/personas/StudyWizard/SessionsHub.tsx` — new component (list + row actions + confirm dialogs).
- `src/components/personas/StudyWizard/WizardModal.tsx` — persist step on close; small "Save & close" button.
- `src/routes/_authenticated/admin/countries.$code.personas.index.tsx` — mount `<SessionsHub />` above the Library; wire Resume → modal with `draftId`.
