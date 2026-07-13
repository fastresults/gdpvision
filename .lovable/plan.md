## Findings from the logs

- Stage 12 did run successfully for ATG:
  - `onboarding_runs.stage = capital_flows`
  - `status = ready`
  - run id `937c9236-b00b-4d85-8c8a-eb03ec02ca23`
- A draft was created:
  - draft id `b9ce186f-ab9e-4c63-a48e-14126af4ee7b`
  - `target_table = country_capital_flows`
  - `needs_review = true`
  - `committed_at = null`
  - payload has 12 flow rows
- Nothing has been committed yet:
  - `country_capital_flows` has 0 rows for ATG
- The Commit button is greyed out because the UI currently disables commit when `draft.citations.length === 0`.
- The draft has source URLs inside every flow row, but `onboarding_citations` has 0 rows for that draft, so the UI blocks commit even though the draft is valid and commit code can still snapshot an empty citation list.
- The “Re-run agent” label is expected by the current UI whenever either a draft or prior run exists, but for this state it is confusing because the next required action is Review/Commit, not rerun.

## Plan

1. **Relax the Stage 12 commit gate**
   - Allow `capital_flows` drafts to be committed when the draft has valid `flows[].source_url` entries, even if `onboarding_citations` is empty.
   - Keep the stricter citation requirement for other stages that depend on `onboarding_citations` for review traceability.

2. **Make the Stage 12 UI state explicit**
   - When an uncommitted capital-flows draft exists, show the primary action as `Commit to country_capital_flows` and keep it enabled.
   - Change the run button label in this state from `Re-run agent` to something less misleading like `Run again` or keep it secondary while the commit action is available.
   - Update the disabled tooltip so it explains the actual blocker only when there is one.

3. **Harden `commitCapitalFlows` error handling**
   - Throw immediately if any flow upsert fails instead of silently continuing.
   - This prevents a failed commit from appearing successful while writing zero rows.

4. **Backfill citation rows for the current ATG draft, if needed**
   - Create `onboarding_citations` rows from the unique `flows[].source_url` values for draft `b9ce186f-ab9e-4c63-a48e-14126af4ee7b`, so the current UI/session can commit even before the code change is deployed.
   - This is a data repair for the existing draft, not a schema change.

5. **Verify the full path**
   - Confirm the Commit button becomes enabled.
   - Commit the draft or verify the commit server function writes rows.
   - Confirm `country_capital_flows` has rows for ATG and Stage 12 switches to committed.