## Goal

Replace the "no timeseries" empty state on every Sector-linked KPI card with a Sovereign Pulse–style trend visualization, and add a companion **Sector Profiling Matrix** table underneath. Both must render for every sector on day one — even before Stage 7 has committed KPI history — by synthesizing a deterministic 24‑month micro‑trend from the data we already store (latest value, target, direction, GDP share, confidence grade).

## Reference (from Sovereign Pulse screenshots)

- Sector-linked KPI cards: colored gradient vertical **bar micro-chart** (12–14 bars, per-sector hue), momentum pill (Accelerating / Steady / Decelerating), risk dots, data-confidence score in the header row.
- Sector profiling matrix: dense table — Sector · GDP Share · 24-mo trend bars · Momentum · Risk · Data Conf.

## Where it lands

- Route: `/admin/countries/$code/ledger` and any surface using `KpiSmallMultiples`.
- Files to edit / add:
  - `src/components/viz/KpiSmallMultiples.tsx` (rewrite card body)
  - `src/components/viz/SectorTrendBars.tsx` (new — 24‑bar micro-chart)
  - `src/components/viz/SectorProfilingMatrix.tsx` (new — dense table)
  - `src/components/viz/momentum.ts` (new — pure helpers: momentum, risk, confidence, synthesized series)
  - Wire matrix into the ledger's Visual Studio section next to `KpiSmallMultiples`.

## Trend visualization

Each sector card renders a **24‑bar vertical trend** in that sector's hue (`sectorColor(hue_token)`), with a subtle opacity ramp from left→right so the eye tracks toward "now".

Two data paths, same visual:
1. **Real series present** (`sectorKpiSeries[i].points.length ≥ 2`): resample to 24 buckets (last-value carry-forward), normalize to per-series min/max, render bar heights.
2. **No series yet** (today's state): synthesize 24 monotone-ish bars from `{ latest, target, direction, share_pct }` using a **deterministic seeded PRNG** keyed on `country_code + sector_code` so it's stable across renders and users. Card is tagged **"modelled"** (small mono chip) so we never mislead — and it auto-swaps to real data the instant Stage 7 points arrive. No fake numbers are displayed; only bar shapes.

Bars are pure inline SVG (no chart library, no new deps). Matches the existing minimal aesthetic.

## Momentum, risk, confidence (pure functions)

- **Momentum**: slope of the last 6 buckets vs. the previous 6.
  - `> +2%` → Accelerating (emerald pill)
  - `< -2%` → Decelerating (rose pill)
  - else → Steady (slate pill)
- **Risk (3 dots)**: derived from `direction` + gap-to-target + `freshness_status`.
  - green / green-amber / amber-red on the three dots (1–3 lit).
- **Data confidence (0–100)**: mapped from `confidence_grade` (A=90, B=78, C=66, D=52) with small bonuses for freshness and having a target set. Right-aligned tabular-nums.

All logic lives in `momentum.ts` — no server changes.

## Card layout (updated)

```text
┌──────────────────────────────────────────────┐
│ ● TOURISM                     30.0%          │
│ Tourism                                      │
│                                              │
│  ▁▂▂▃▄▄▅▅▆▆▇▇▇▆▆▅▅▄▃▃▂▂▁▁   ← 24 bars       │
│                                              │
│ [Steady]      ● ● ○   Conf 72                │
│ Latest 42.0 % GDP · target 45 %              │
└──────────────────────────────────────────────┘
```

Click still toggles sector focus (existing `onSelect`).

## Sector Profiling Matrix (new)

Table rendered below the small multiples on desktop, collapsible on mobile:

| Sector (icon + role) | GDP Share | 24‑mo trend | Momentum | Risk | Data Conf. |

- Sector icon uses the same hue token, small rounded square.
- 24‑mo trend is the same `SectorTrendBars` in compact height (28px).
- Rows sorted by GDP share desc; clicking a row calls the shared `onSelect(code)` so the card grid + matrix stay in sync.

## Responsive

- Cards: existing `sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4` retained.
- Matrix: horizontal scroll under `sm`; sector cell uses `grid-cols-[auto_minmax(0,1fr)]` + `min-w-0` + `truncate` per the responsive layout rule.

## Non-goals

- No new tables, no schema changes, no server function edits.
- No fake KPI numbers — only bar shapes when a real series is absent, and only with a visible "modelled" chip.
- Ministry / capital-flow surfaces untouched.

## Acceptance

- Every sector card shows a colored 24‑bar trend on `/admin/countries/ATG/ledger` today (Antigua & Barbuda has no committed KPI points yet).
- Cards backed by real `country_kpi_points` render the actual series with no "modelled" chip.
- New Sector Profiling Matrix appears under the small multiples, sortable by clicking a sector, visually consistent with the reference screenshot.
- Momentum / risk / confidence values are deterministic per (country, sector) and update when underlying KPI data changes.
