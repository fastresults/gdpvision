# Second Brain in the super-admin UI

## Where it currently lives

There is **one** super-admin surface for the second brain today:

- Route: `/admin/countries/$code/data`
- File: `src/routes/_authenticated/admin/countries.$code.data.tsx`
- Tab: **"Second brain"** (the `MemoryTab` component, lines ~1620–1695)
- Shape: a flat list of memory objects with title, kind, sector, scope, weight, verify/delete buttons, and an "Add memory" form.

The client/operator-facing version at `/narrative/brain` (`src/routes/_authenticated/narrative/brain.tsx`) is also just a table with filter chips.

So today there is **no visual view of the second brain** — only two text tables. That is what needs fixing.

## What "visual" should mean here

The second brain is a graph-like store: sectors × kinds (audience, position, statement, outlet, precedent, fact, risk) × weight × verified × scope (country vs regional), with links back to source citations. The admin needs to see coverage and gaps at a glance, not scroll a list.

## Plan

Add a **"Visual"** sub-view inside the existing Second brain tab (toggle: `List | Visual`) so the current list stays available and no route changes are needed.

The Visual view has four stacked panels:

1. **Coverage matrix** — sectors (rows) × kinds (columns) heatmap. Each cell shows the count of memory objects; cell shade = sum of weights; a small dot marks verified coverage. Click a cell to filter the list below to that (sector, kind).
2. **Weight & verification bar** — per-kind stacked bar: verified vs unverified, split by weight 1–5. Makes "we have lots of unverified positions" obvious.
3. **Sector coverage rail** — one row per sector: dot per kind sized by count, greyed if 0. Reveals sectors with holes (e.g. sector has audiences but no outlets).
4. **Recent activity** — last 10 upserts / verifications with author + timestamp (from `updated_at`), each linking into the row in the list.

Selecting a cell/segment scrolls to and filters the existing list rendering (reuse `MemoryTab`'s current row component), so drilling from visual → detail is one click.

Scope toggle (`Country | Regional`) sits above the panels and rewrites the query key, mirroring `/narrative/brain`.

Empty-state: if the brain has zero rows, render a single explainer card ("Second brain seed hasn't been committed for this country yet") with a link to `/admin/countries/$code/onboard#second_brain_seed`.

## Technical notes

- New file: `src/components/country-data/MemoryVisual.tsx` — pure presentation, receives the `rows` already fetched by `memoryQuery(code)`. No new server functions; all aggregation is client-side over the existing list.
- Edit: `src/routes/_authenticated/admin/countries.$code.data.tsx` — add `view: "list" | "visual"` state inside `MemoryTab`, render the toggle, mount `<MemoryVisual rows={rows} onSelect={setFilter} />` above the list, pass a `filter` down to the existing list rows.
- Styling: reuse existing tokens (`border-line-200`, `bg-ink-950`, mono eyebrow type). No new deps, no chart library — the matrix and bars are CSS grids + `div` fills to stay consistent with the site's flat/mono aesthetic.
- Data already fetched by `listMemory` (`src/lib/country-data/manage.functions.ts`) is sufficient — no schema or server changes.

## Out of scope

- Changing `/narrative/brain` (operator view).
- Editing memory schema, weights logic, or the seed agent.
- Graph/force-layout visualisations — deferred until the matrix proves insufficient.
