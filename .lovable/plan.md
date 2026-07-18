## Diagnosis (verified in code)

I read `src/components/country-data/DataStoresPanel.tsx` and the tab source in `src/routes/_authenticated/admin/countries.$code.data.tsx`. Three concrete defects explain what you saw — I'm not guessing:

1. **White flash on every tab click.** The panel wraps *all seven* tab bodies in a single `<Suspense fallback="Loading…">`. Every tab component calls `useSuspenseQuery(...)` on mount (SourcesTab L185, KpisTab L328–330, DossiersTab L784, MinistriesTab L841, CorpusTab L1377–1378, MemoryTab L1676, plus GdpVizStudio). Because I re-render tabs with `{tab === "x" && <Tab />}`, switching tabs **unmounts** the old one and **mounts** a fresh one that suspends → the shared Suspense boundary blanks the entire panel to the fallback string until the new query resolves. That is the white flash. Scroll position, filters, dialogs, and cached DOM are all lost each switch.

2. **Tabs "pop me out to another page."** Some tab bodies contain `<Link to="/admin/countries/$code/onboard">` or `to="/admin/countries/$code/data"` (e.g. MemoryTab L1733, header L142). The header `<Link to="/admin/countries/$code/data">Open full view →`" also sits right next to the tab strip and is easy to hit. MinistriesTab / DossiersTab cards contain child navigations too. Any of these takes the user off the onboard page.

3. **State loss between switches.** Because tabs unmount, dialogs (`showAdd`), selected rows (`openId`), scroll, and inline editors reset every time — reinforcing the "not fluid" feel.

## Plan

### 1. Keep every tab mounted; only hide the inactive ones
Replace the `{tab === "x" && ...}` switch with all seven tabs rendered simultaneously, wrapped in `<div hidden={tab !== "x"}>` (or `className={tab === "x" ? "" : "hidden"}`). Each tab keeps its own React state, its query cache stays warm, and switching becomes an instant CSS toggle — no unmount, no suspend, no flash.

Trade-off: first visit to the panel does 7 initial fetches. Mitigate by:
- Rendering the active tab immediately and mounting the other six lazily on first `requestIdleCallback` (or on first hover of their tab button).
- Alternatively: mount a tab the first time it becomes active, then keep it alive after that (a `mountedTabs: Set<DataTabKey>` in state). This gives instant re-switch after the first visit without paying for tabs the user never opens. **This is the approach I'll ship** — it fixes the flash without upfront cost.

### 2. Per-tab Suspense boundary with a stable skeleton
Give each tab its own `<Suspense>` with a compact skeleton (rows/blocks matching the tab, `bg-paper-100 animate-pulse`) instead of the shared "Loading tab…" text. Only the tab being visited for the first time shows a skeleton; already-mounted tabs re-appear instantly.

### 3. Smooth switching with `useTransition`
Wrap `setTab` in `startTransition`. React keeps the previous tab visible while the new one prepares, so even a first-visit fetch shows the old content until ready — no white gap.

### 4. Stop tabs from routing away when embedded
- Add an optional `embedded?: boolean` prop to `SourcesTab / KpisTab / DossiersTab / MinistriesTab / CorpusTab / MemoryTab`.
- In embedded mode: suppress or replace any `<Link to="/admin/countries/$code/onboard">` / `to="/admin/countries/$code/data">` inside the tab body with in-panel actions (e.g. MemoryTab empty state's "Run the seed agent" becomes a scroll-to-onboarding-stage-N action or a plain instruction; CorpusTab's "Go to Sources" already correctly uses `onGoToSources`, keep that pattern).
- Pass `embedded` from `DataStoresPanel`.
- Remove the "Open full view →" `<Link>` from the panel header, or turn it into `target="_blank" rel="noreferrer"` so an accidental click can't yank the user off the onboard page.

### 5. Verify
Drive Playwright headlessly against `http://localhost:8080/admin/countries/ATG/onboard`:
- Restore the Supabase session per the browser-use rules.
- Click each of the 7 tabs in order and screenshot after each; assert URL stays on `/onboard` and no full-white frame is captured (compare a mid-transition screenshot's average pixel to the surrounding frames).
- Click a tab twice and confirm second visit is instant (no skeleton).
- Confirm dialogs/filters set on one tab survive a round-trip to another tab and back.

## Files touched
- `src/components/country-data/DataStoresPanel.tsx` — mounted-tabs set, per-tab Suspense, `startTransition`, drop or externalize the "Open full view" link, pass `embedded` down.
- `src/routes/_authenticated/admin/countries.$code.data.tsx` — add `embedded?: boolean` to the six tab exports; gate the in-tab `<Link>`s that leave the page (MemoryTab L1733, and audit each tab's card/row navigations the same way).

No backend or data changes.