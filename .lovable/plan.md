## Goal
Turn the "Data stores" banner on the country onboarding page into a fully inline, tabbed panel that shows Sources / KPIs / Sector dossiers / Ministries / Corpus / Second brain / GDP Visualizations without leaving `/admin/countries/$code/onboard`, plus a collapse control so the whole panel (and each large sub-section) can be reduced back to a compact card.

## Approach

### 1. Extract the tab bodies from `countries.$code.data.tsx` into reusable panels
Currently every tab (`SourcesTab`, `KpisTab`, `DossiersTab`, `MinistriesTab`, `CorpusTab`, `MemoryTab`, plus `GdpVizStudio`) lives inside the `/data` route file. Move each `*Tab` component into its own file under `src/components/country-data/panels/`:

```text
src/components/country-data/panels/
  SourcesPanel.tsx
  KpisPanel.tsx
  DossiersPanel.tsx
  MinistriesPanel.tsx
  CorpusPanel.tsx
  MemoryPanel.tsx
  VizPanel.tsx  (thin wrapper around GdpVizStudio)
```
Each panel takes `{ code }` and owns its own `useSuspenseQuery` calls (unchanged logic). `countries.$code.data.tsx` is refactored to import and render these panels so the standalone `/data` route keeps working exactly as today — no behavior change there.

### 2. Replace `DataStoresBanner` with an inline `DataStoresPanel` on the onboard page
In `src/routes/_authenticated/admin/countries.$code.onboard.tsx`:

- Replace the `<Link>`-based tab bar with `<button>` tabs that update local state (`activeTab`) — no navigation.
- Render the selected panel below the tab bar, wrapped in a Suspense boundary with a lightweight skeleton (so switching tabs doesn't block the whole page while a panel's queries load).
- Keep the existing "Manage data stores →" deep link (line 763) as a secondary "Open in dedicated view" affordance for users who want the full-screen data page.

### 3. Collapse controls
Two levels of collapse, both persisted to `localStorage` per country code so the choice sticks between visits:

- **Panel-level collapse** on the Data stores card itself: a chevron button in the header collapses the entire panel (tab bar + body) back to a one-line summary card ("Data stores · 7 tabs · click to expand"). Storage key: `gdpv:onboard:datastores:collapsed:<code>`.
- **Section-level collapse** inside heavy panels (Sources table, KPIs matrix, Corpus chunks, Second brain constellation): wrap each large sub-section in a small `<CollapsibleSection title=... defaultOpen=... storageKey=...>` component (new, `src/components/ui/CollapsibleSection.tsx`) so the user can hide long tables/visuals independently.

Additionally, add a "Collapse all / Expand all" toggle at the top of the onboard page's right rail that broadcasts to every `CollapsibleSection` on the page (via a tiny React context) so the whole onboarding view can be reduced to compact cards in one click.

### 4. Route + URL behavior
- The onboard page gains an optional `?data=<tabKey>` search param (validated the same way as the `/data` route's `tab` param) so a specific tab can be linked to inline.
- The standalone `/admin/countries/$code/data` route is unchanged; it becomes the "full-screen" version of the same panels.

### 5. Non-goals / out of scope
- No changes to any server functions, queries, or business logic in the panels themselves — this is a pure UI/composition change.
- No changes to the ledger, chambers, or pipeline sections above the Data stores card.

## Files touched
- `src/components/country-data/panels/*.tsx` (new — extracted from data route)
- `src/components/ui/CollapsibleSection.tsx` (new)
- `src/components/country-data/DataStoresPanel.tsx` (new — inline tabbed panel + collapse header)
- `src/routes/_authenticated/admin/countries.$code.onboard.tsx` (swap `DataStoresBanner` for `DataStoresPanel`, add `?data=` search param, add global collapse-all toggle)
- `src/routes/_authenticated/admin/countries.$code.data.tsx` (refactor to import extracted panels; no UX change)
