## Goal
Let admins refresh Ministry deep-dive data (minister identity, party, contact, bio, portrait, mandate, programmes) for the current country from the Ministries tab in one click — without leaving the page or going back to the onboarding wizard.

## UX

Add a **"Refresh from AI"** button in the Ministries tab header (top-right, next to the tab). Clicking it:

1. Calls the existing `runMinistryDeepDiveAgent` server function for this country.
2. Shows a small inline status: "Researching ministries…" → "Ready to review · N ministries · M citations".
3. Opens a **Review dialog** listing every returned ministry entry side-by-side with the current stored value (name, title, party, appointed, programmes count) so the admin sees exactly what will change.
4. Admin clicks **Commit** → calls existing `commitMinistryDeepDive` with the returned `draftId`, which upserts `minister_profile`, `citations`, `mandate`, `programmes` for every ministry in one shot. Cancel discards the draft (leaves it uncommitted; no destructive change).
5. On commit, invalidate the ministries query so the cards re-render with the new data.

Errors from either call surface in the dialog with the raw message (Perplexity failures, quota, etc.).

## No backend changes required

Both server functions already exist and do the right thing:
- `runMinistryDeepDiveAgent` (in `corpus.functions.ts`) — already returns `{ runId, draftId, count, citations }` and uses the enriched schema/prompt shipped in the previous change.
- `commitMinistryDeepDive` (same file) — already snapshots `citations` and writes `minister_profile` per the updated commit path.

I'll re-export both from the manage barrel so the Ministries tab can import them cleanly (or import from `country-onboarding/corpus.functions` directly — same pattern the KPI tab already uses).

## Files

- Edit `src/routes/_authenticated/admin/countries.$code.data.tsx`:
  - Add imports for `runMinistryDeepDiveAgent`, `commitMinistryDeepDive`.
  - Add a `RefreshMinistriesButton` + `MinistryReviewDialog` at the top of `MinistriesTab`.
  - Loading, error, and success states inline; dialog uses the same lightweight overlay pattern as `MinisterEditDialog` to stay consistent.

## Out of scope

- No per-ministry refresh (the Perplexity call is already batched across all ministries in one request; per-ministry would be more expensive and less accurate).
- No auto-commit — admins always review the draft before writes land.
- No changes to the onboarding wizard flow.
- No new tables, no new server functions.
