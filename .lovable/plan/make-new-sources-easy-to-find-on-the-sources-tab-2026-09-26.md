# Make new sources easy to find on the Sources tab

## What you'll get
- **Newest first:** the Sources list opens with the most recently added sources at the top, so "eGov Platform" shows first.
- **Sort choice:** a small "Sort" menu above the list with Newest first (default), Highest quality, and Name A–Z.
- **Search box:** type part of a name, organisation or website (e.g. "ab.gov" or "eGov") and the list narrows as you type. The count line reads "3 of 29 sources match".
- A "New" tag next to any source added in the last 7 days.
- The on/off switches, Re-ingest, Read whole site and every other action work exactly as before.

## Technical details
- `src/routes/_authenticated/admin/countries.$code.data.tsx` (`SourcesTab`): add `query` and `sort` state; derive `visible` rows with `useMemo` (case-insensitive match on title, org, url, kind; sort by `created_at` desc / `quality_score` desc then title / title). Render `visible` instead of `rows`; empty-match state row. Search input + sort select placed beside the count line; "Add source" button kept and switched to `btn-primary`.
- Keep the server order in `listSources` unchanged (other callers use it); sorting is done in the page only.
- Verify in the browser on ATG: eGov Platform at the top by default, and a search for "ab.gov" returns it.
