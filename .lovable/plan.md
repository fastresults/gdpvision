## What is actually happening

This is not because the drafts failed to synthesize. The backend shows, for GRD:

- 11 total studies
- 11 studies have completed synthesis reports with non-empty summaries
- 0 studies are marked `complete`
- 11 studies are still marked `running`

So the finished work product exists, but the status rail is reading stale `studies.status` values instead of treating the presence of a completed `study_reports` row as the source of truth.

## Root cause

The synthesis step wrote all 11 reports successfully, but the final status update that should flip each study from `running` to `complete` did not persist for those rows. The UI then showed contradictory truth sources:

- The digest / completed work product reads `study_reports`, so it knows the work exists.
- The right-side status rail reads only `studies.status`, so it incorrectly says `0/11 synthesized` and `11 running`.

## Plan to fix this permanently

1. **Make completed reports the canonical UI signal**
   - Update the status rail and Stage 03 grouping logic so a study counts as synthesized when a non-empty report exists, even if `studies.status` is stale.
   - The UI should never again show `0 synthesized` when 11 reports exist.

2. **Return report presence with study rows**
   - Extend the study list response so every study includes whether it has a completed report.
   - Use this derived field consistently for counts, progress bars, complete banners, and grouping.

3. **Strengthen server-side self-healing**
   - Keep the existing reconciliation, but make it project-aware and ensure the returned rows reflect the reconciled status immediately.
   - If a row has a report, the server should either persist `complete` or return it as synthesized for that read.

4. **Remove ambiguous “running” language when reports exist**
   - If all reports exist but some status rows are stale, show a recovery state such as “Reports complete · status syncing” only briefly, not “Incomplete studies.”
   - Prefer “All studies synthesized” once the completed reports are present.

5. **Add a visible work-product entry point**
   - Ensure the completed synthesis digest and consolidated program report are visible above the study library.
   - Add a clear CTA like “Open completed synthesis” so the user does not have to infer where the work product is.

6. **Verify against GRD data**
   - After implementation, verify the GRD Stage 03 page shows `11/11 synthesized`, `0 running`, and exposes the completed reports.
   - Confirm the database still contains 11 non-empty reports and the UI reflects that exact count.

## Technical notes

- Files to update:
  - `src/lib/personas/study.functions.ts`
  - `src/routes/_authenticated/admin/countries.$code.personas.studies.tsx`
  - `src/components/personas/StudyWizard/StudioStatusRail.tsx`
- The safest fix is to derive `is_synthesized = status in ('complete','synthesized') OR report_summary_chars > 0` and use that everywhere the UI computes completion.