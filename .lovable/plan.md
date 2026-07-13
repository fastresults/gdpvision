# Why the treemap and heatmap look grey

## The data is already correct

For Antigua & Barbuda (ATG) the visualizations are backed by real, committed data — nothing is missing:

- `country_sectors` — **11 rows, sum = 100.0%** (Tourism 30%, Other services 14%, Real estate 11%, Financial 10%, Construction 9%, Public admin 8%, Transport 7%, Digital 4%, Manufacturing 3%, Agriculture 2%, plus one more). This is exactly what the treemap already shows in your screenshot.
- `ministry_sectors` — **40 ministry↔sector weight rows** across the 10 cabinet ministries. This is what feeds the heatmap.
- `sectors` — 12-row canonical registry with `hue_token` values `--sector-01` … `--sector-12`.

The server function `getCountryVizOverview` in `src/lib/country-viz/viz.functions.ts` reads all three tables and returns them to `GdpVizStudio`. The tiles, rows, and hover tooltip in your screenshots prove the numbers arrive on the client.

## The actual bug: color tokens are double-prefixed

`public.sectors.hue_token` stores values **with** the CSS custom-property prefix:

```
--sector-01, --sector-02, … --sector-12
```

But `src/components/viz/sector-color.ts` assumes the token is bare and wraps it again:

```ts
if (t) return `var(--${t})`;   // becomes var(----sector-01) — invalid
```

Result: every `fill`/`background` resolves to an invalid CSS value, the browser falls back to the default paint (grey), and both the treemap tiles and the heatmap dots render as grey. The data path is fine; only the color mapping is broken.

## Fix

Normalize the token in `sectorColor()` so it works whether the DB stores `--sector-01` or `sector-01`:

```ts
export function sectorColor(hueToken: string | null | undefined, fallbackIndex = 0): string {
  const raw = (hueToken ?? "").trim().replace(/^--/, "");
  if (raw) return `var(--${raw})`;
  const n = ((fallbackIndex % 12) + 1).toString().padStart(2, "0");
  return `var(--sector-${n})`;
}
```

That single change re-colors:
- `GdpTreemap` tiles (fill + stroke)
- `MinistrySectorHeatmap` column dots and cell fills
- Any other consumer of `sectorColor` (e.g. `SovereignSankey`, `KpiSmallMultiples`) that reads `hue_token`

No schema change, no re-ingest, no new server function needed.

## Verification

1. Reload `/admin/countries/ATG/viz`.
2. Treemap: each sector tile paints in its brand hue (Tourism deep teal, Agriculture green, Financial navy, etc.) per the palette already defined in `src/styles.css` (`--sector-01`…`--sector-12`).
3. Heatmap: column headers show colored dots; occupied cells shade from light to saturated by ministry weight; empty cells stay blank.
4. Spot-check LCA (also has data) to confirm the fix isn't ATG-specific.

## Out of scope

- Re-running any onboarding stage
- Editing the `sectors` registry or migrating `hue_token` values
- Any change to `GdpVizStudio` layout, the Sankey, or KPI panels