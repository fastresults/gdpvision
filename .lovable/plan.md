# Sector Profiling: Distinct Viz + McKinsey Dossier Drawer

Two problems, one plan:
1. The 24-mo trend bars in **Sector profiling** are visually identical to the bars in **Sector-linked KPI trends** (both render `SectorTrendBars` off the same `sectorKpiSeries`). We need a different visual language for the matrix row.
2. Clicking a sector should open a **beautiful McKinsey-style sector analysis** grounded in the second brain (KPIs, ministries, capital flows, corpus, citations).

---

## Part 1 — New visualization for the matrix row

Replace the row's `SectorTrendBars` (mini bar chart) with a **Momentum Sparkstrip**: a compact, information-dense composite that is visually distinct from the tall bar chart used by the linked-KPI panel.

Composition per row (single ~28px strip):
- **Sparkline** of the linked KPI's 24-mo series (thin line, gradient area fill in the sector hue) — replaces bars.
- **Latest / 6-mo / 24-mo delta chips** rendered inline as small tabular-nums pills (▲ +4.2%  •  ▲ +11.0%) — this is the "different method" the row communicates at a glance.
- **Sector share micro-bar** as a 4px stacked track behind the label showing this sector's share of GDP relative to the top sector (context the current UI lacks).
- Preserve momentum chip, risk dots, and data-confidence columns.

Result: matrix row = *sparkline + deltas + share track* (analytical). Linked-KPI panel keeps its *tall bar histogram* (temporal shape). No overlap in visual language.

Files:
- New `src/components/viz/SectorSparkstrip.tsx` (SVG sparkline + gradient + delta chips).
- New `src/components/viz/ShareTrack.tsx` (share-of-max micro bar).
- Edit `src/components/viz/SectorProfilingMatrix.tsx` — swap `SectorTrendBars` for `SectorSparkstrip`, add `ShareTrack` behind sector label. Leave `KpiSmallMultiples` untouched.

## Part 2 — McKinsey sector dossier drawer

Clicking any sector row opens a right-side **Dossier Drawer** (not a route change — keeps context). Editorial, serif headings, generous whitespace, matching the ledger/artifact panel aesthetic already established.

### Drawer structure (McKinsey-grade)
1. **Executive summary** — 3-sentence situation → complication → resolution, AI-generated, with superscript citations (`CitedMarkdown`).
2. **Situation at a glance** — 4-up stat strip: GDP share, 24-mo CAGR, momentum, data confidence.
3. **The pyramid** — one headline claim + three supporting pillars (growth drivers, risks, policy levers), each with 2-3 evidence bullets and citations.
4. **KPI panel** — all linked KPIs for this sector (from `sectorKpiSeries`) rendered as small multiples, latest vs target with delta.
5. **Ministry & mandate** — owning ministry, current minister (from `ministry_profiles.minister_profile`), mandate excerpt, links into the ministry dossier route.
6. **Capital flows footprint** — inbound/outbound flows tagged to this sector from `capital_flow_nodes`, top 5 by magnitude.
7. **Sources** — deduped citation list (URL + publisher + date), same clickable superscript system used elsewhere.

All prose passes through the global citation hygiene layer — no dead `[N]` markers, no citations without valid URLs.

### Data + AI plumbing
- New server fn `src/lib/sector-dossier/build.functions.ts` — `buildSectorDossier({ countryCode, sectorCode })`:
  - Reads: `sector_dossiers` (existing, has `citations` snapshot), `sectorKpiSeries`, `ministry_profiles` (via `ministry_sectors`), `capital_flow_nodes` filtered by sector tag, top corpus chunks from `country_source_chunks` scoped by sector keywords.
  - Assembles a **context pack** (bounded token budget, mirrors `personas/context-pack.server.ts` pattern).
  - Calls Gemini 1.5 Pro through the Lovable AI gateway with a McKinsey pyramid prompt returning JSON `{ executive, pyramid: { headline, pillars: [...] }, outlook }`.
  - Runs citation hygiene, hydrates URLs, caches result in a new `sector_dossier_briefs` table keyed by `(country_code, sector_code, corpus_version)` with 24h TTL so re-opens are instant.
- New TanStack Query hook `useSectorDossier(countryCode, sectorCode)` with `ensureQueryData` in the drawer.

### UI files
- New `src/components/sector/SectorDossierDrawer.tsx` — Sheet from shadcn, editorial layout, `CitedMarkdown` for all prose, `CopyButton` on each section (per global rule), loading skeleton, error boundary, "Refresh brief" action for admins.
- New `src/components/sector/SectorPyramid.tsx` — the headline + 3-pillar visual (McKinsey pyramid).
- New `src/components/sector/SectorStatStrip.tsx` — 4-up KPI tiles (reuses existing `StatStrip` styling).
- Edit `SectorProfilingMatrix.tsx` — `onSelect` also opens the drawer (drawer state lifted into `GdpVizStudio`).
- Edit `GdpVizStudio.tsx` — mount `<SectorDossierDrawer />` with open state; existing `selected`/`setSector` stays as filter driver for the KPI panel.

### Database
Migration `sector_dossier_briefs`:
- `country_code text`, `sector_code text`, `corpus_version bigint`, `brief jsonb`, `citations jsonb`, `generated_at timestamptz`, PK `(country_code, sector_code)`.
- Grants: `SELECT/INSERT/UPDATE` to `authenticated` (country access via `has_country_access`), `ALL` to `service_role`.
- RLS enabled with `has_country_access(country_code)` policy.
- Public data → visible to all users of that country; no private-data leak (dossier only reads public corpus + committed sector data).

### Guardrails
- If the AI call fails or context is thin, drawer degrades gracefully to the raw KPI/ministry/flows panels with an "AI brief unavailable — refresh to retry" banner.
- No citation without a valid URL (global hygiene rule).
- All Markdown renders through `CitedMarkdown` (global rule).

---

## Out of scope
- No changes to `KpiSmallMultiples` visualization.
- No changes to the underlying `sectorKpiSeries` loader.
- No new routes — dossier is a drawer, back button and deep-link via `?sector=CODE` search param handled by existing `validateSearch`.
