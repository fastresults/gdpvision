# GDP Vision — Visualization Studio Plan

Add a **GDP Visualizations** tab to the country admin — a McKinsey-style, executive-grade "situation room" that renders the entire economy at a glance and drills into every sector. It is **read-only over live data**: sectors, KPIs, ministries, dossiers, corpus chunks and second-brain memories all flow in and update the visuals automatically.

## 1. Where it lives

- New tab **"GDP Visualizations"** appended to the country data nav (`countries.$code.data.tsx`) after *Second brain*.
- Also surfaced as a top-level card on `countries.$code.onboard.tsx` (once stage 3 Sectors + stage 7 KPIs are committed) so the PM/cabinet view is one click away.
- A single new route file `countries.$code.viz.tsx` for a full-screen "Studio" mode (dark, presentation-grade) linked from the tab header — same charts, bigger canvas.

## 2. Data spine (all live)

Every chart is a `useSuspenseQuery` against **existing** committed tables — no new schema, no new agent runs required:

| Signal | Source |
|---|---|
| Sector shares, sub-verticals | `country_sectors` + optional `sectors.children` metadata |
| KPI latest / target / trend | `country_kpis` + `country_kpi_points` |
| Ministry portfolios & weights | `ministry_profiles`, `ministry_sectors` |
| Dossier narrative snippets, benchmarks | `sector_dossiers` |
| Evidence / citations for tooltips | `onboarding_citations`, `country_source_chunks` |
| Risks, audiences, positions | `memory_objects` (second brain) |

New server functions (all `.functions.ts`, RLS as user):

- `getVizOverview({ countryCode })` — macro card (GDP, growth, debt/GDP, inflation, unemployment, poverty from KPI seed) + sector array + minister-per-sector join.
- `getSectorDetail({ countryCode, sectorCode })` — KPIs scoped to sector, dossier, top 5 corpus chunks, top 5 memory items, ministers.
- `getFlowsGraph({ countryCode })` — nodes/edges for Sankey (ministries → sectors weighted by `ministry_sectors.weight × sector.share_pct`).

Cache with a 60s `staleTime`; invalidate on any commit action from the onboarding page (`router.invalidate()` already fires there).

## 3. Visualization set (borrowed & re-skinned from Sovereign Pulse)

Grid layout — one screen, McKinsey information density, semantic tokens only (no hard-coded colors), tabular-nums for every number.

```text
┌─────────────────────────────────────────────────────────────┐
│  A. Macro headline strip (6 KPI gauges)                     │
├───────────────────────────┬─────────────────────────────────┤
│  B. GDP Complexity        │  C. Sector Radar                │
│     Treemap (sectors +    │     (5 axes: growth, jobs,      │
│     sub-verticals)        │      fiscal, exposure, ESG)     │
├───────────────────────────┼─────────────────────────────────┤
│  D. Sovereign Capital     │  E. Ministry × Sector           │
│     Sankey (Revenue →     │     Heatmap (weights matrix)    │
│     Treasury → Sectors)   │                                 │
├───────────────────────────┴─────────────────────────────────┤
│  F. Sector KPI Small-Multiples (sparkline per sector)       │
├─────────────────────────────────────────────────────────────┤
│  G. Debt / GDP Horizon + Fiscal Balance dual-axis           │
├─────────────────────────────────────────────────────────────┤
│  H. Evidence Rail — citations + memory chips for selected   │
│     sector (click-through to source modal)                  │
└─────────────────────────────────────────────────────────────┘
```

Clicking any tile filters the whole page to that sector (URL search param `?sector=CODE` via `validateSearch`).

### Components (new, under `src/components/viz/`)
- `MacroStrip.tsx` — 6 metric gauges (reuse Sovereign Pulse `metric-gauge` pattern, tokens-only).
- `GdpTreemap.tsx` — squarified layout ported from Sovereign Pulse `treemap.tsx`, driven by `country_sectors`.
- `SectorRadar.tsx` — recharts `RadarChart` per sector; axes computed from KPI subset.
- `SankeyFlows.tsx` — hand-rolled SVG Sankey (port from Sovereign Pulse `sankey.tsx`), nodes from ministries + sectors.
- `MinistrySectorHeatmap.tsx` — CSS-grid heatmap of `ministry_sectors.weight`.
- `KpiSmallMultiples.tsx` — one sparkline per sector using `country_kpi_points`.
- `DebtHorizon.tsx` — dual-axis area/line from `country_kpi_points` for debt/GDP + fiscal balance, with ECCB-style ceiling line if applicable.
- `EvidenceRail.tsx` — chips linking to `country_sources` / memory items, opens existing source modal.
- `VizStudioShell.tsx` — shared dark presentation shell for the `/viz` full-screen mode.

Reused: recharts is already a dep; Sankey and Treemap stay dependency-free SVG. No new npm packages required.

## 4. Interaction & UX
- **Filter by sector**: click a treemap tile or radar → URL `?sector=TOU` scopes radar, sparklines, evidence rail, ministers list.
- **Time range**: `?range=1y|5y|10y` search param feeds sparklines and horizon.
- **Empty states**: each chart renders a skeleton + a "Missing: KPI seed / Sector composition — go to onboarding →" link when a dependency isn't committed. No silent zeros (consistent with existing pipeline-health pattern).
- **Presentation mode** button opens `/admin/countries/$code/viz` full-screen dark shell for cabinet meetings.
- **Export** button: PNG via `html-to-image` (small dep, already Worker-safe) for a one-click briefing snapshot.

## 5. Reliability & correctness
- Server functions authorized via `requireSupabaseAuth` + `has_country_role` (admin or country editor).
- Zero writes — pure read layer.
- Handles missing sectors, missing KPI points, missing ministry weights with explicit diagnostic tiles instead of blank charts.
- Freshness badge per chart: "Updated Xh ago" from underlying table's `updated_at`.

## 6. Delivery order
1. Server fns: `getVizOverview`, `getSectorDetail`, `getFlowsGraph`.
2. Route + tab wiring (`countries.$code.data.tsx`, new `viz.tsx`).
3. Ship charts in this order (each independently useful):  MacroStrip → GdpTreemap → SectorRadar → KpiSmallMultiples → SankeyFlows → MinistrySectorHeatmap → DebtHorizon → EvidenceRail.
4. Presentation mode + PNG export.
5. Onboarding page: add "Open GDP Visualizations" CTA once stages 3+7 are green.

## 7. Out of scope (call out for a follow-up)
- Scenario levers (what-if sliders) — Sovereign Pulse has these; here they'd need a scenarios table. Not built in this pass.
- Cross-country comparison view — separate route later.
- Auto-generated cabinet narrative — reuse existing dossier text for now; AI-written executive summary is a v2 add-on.
