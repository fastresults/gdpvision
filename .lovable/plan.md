## Where the dossier is called today

In `src/components/viz/SectorProfilingMatrix.tsx`, the row `<button>` only calls `onSelect(r.code)` — that toggles the cross-chart sector highlight (Treemap, KPI small multiples, Ministry heatmap), it does **not** open the McKinsey dossier.

The dossier is only opened by the discreet document icon on the far right of each row, which calls `onOpenDossier(r.code)` → sets `dossierSector` in `GdpVizStudio.tsx` → mounts `<SectorDossierDrawer />`.

So a row click currently just filters other charts; the beautiful dossier never opens from the row itself. That's the mismatch.

## Fix

Make the row click open the dossier, and keep cross-chart highlighting as a secondary affordance.

1. **`SectorProfilingMatrix.tsx`** — on row click, call `onOpenDossier(r.code)` (primary action). Also call `onSelect(r.code)` so the treemap/heatmap/small-multiples stay in sync with what the user is reading.
2. Remove the now-redundant document icon (or keep it as a visual affordance only, non-interactive) so the whole row reads as one target.
3. Add `cursor-pointer` + a subtle hover treatment already present, plus a tooltip/`title="Open sector dossier"` on the row for discoverability.
4. Keep the "Show all sectors ×" reset button behavior unchanged — clicking a sector in the treemap or heatmap still just filters (no dossier auto-open) so users can drill without a modal every time.

No schema, server-function, or dossier-content changes — this is purely wiring the row's primary click to the drawer that already exists.
