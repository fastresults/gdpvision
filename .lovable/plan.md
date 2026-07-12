# Visual Second Brain — Constellation view

A cinematic, animated visualization of the second brain that lives under the existing **Second brain** tab at `/admin/countries/$code/data`, with a super-admin **All countries** mode that aggregates every country's brain into one constellation.

## Where it lives

- **Per-country**: new sub-view toggle inside `MemoryTab` → `List | Visual | Constellation`. The current `MemoryVisual` (matrix + bars) stays; **Constellation** is the new default for super-admins.
- **Cross-country (super-admin only)**: new route `/admin/brain` (top-level, accessible from the countries index and the admin nav) that renders the same constellation with the country layer added — every bound country becomes a node in an outer ring around a central *System* core.

Gating: the cross-country view checks `has_role(auth.uid(), 'admin')` server-side; country-scoped admins only see their own country.

## The visual metaphor

A living diagram, not a chart. Flat/mono aesthetic consistent with the site (paper + ink tokens, `font-mono` eyebrows, thin 1px lines), but with restrained motion.

```text
                     ┌──────────────────────────────┐
                     │           LEGEND             │
                     │  ● country   ○ sector        │
                     │  ◆ kind      · memory        │
                     │  → citation  ⟳ recent update │
                     └──────────────────────────────┘

                        outlet ◆         audience ◆
                              ╲          ╱
                    position ◆──○ Tourism ○──◆ statement
                              ╱     │      ╲
                             ·      │       ·
                                    │
                     ○ Health ─── ● LCA ─── ○ Finance ○
                                    │
                              ╱     │      ╲
                    fact ◆──○ Climate ○──◆ risk
                              ╲          ╱
                              precedent ◆
```

**Layers, from center out:**
1. **Core** — the country crest/code (or *System* in super-admin mode). Slowly pulsing ring whose radius encodes total memory volume.
2. **Sector ring** — one orb per sector, angular position stable (hashed from `sector_code`), size = memory count, ink shade = summed weight. Verified-heavy sectors get a thin emerald halo.
3. **Kind satellites** — around each sector orb, up to 7 small diamonds (one per kind: audience, position, statement, outlet, precedent, fact, risk). Filled = has data, hollow = gap.
4. **Memory dust** — individual memory objects as 2px dots orbiting their (sector, kind) satellite. Density = count; opacity = verified.
5. **Citation threads** — thin lines from a memory dot back to its source (when hovered), fading into the corpus panel edge.

**Super-admin cross-country mode** adds one outer ring: each country is a core, and the *System* center connects to each with a thin thread whose thickness = total memory count. Zooming into a country expands its sector/kind rings; the others dim to 20% opacity.

## Motion (restrained, purposeful)

- **Pulse**: core rings pulse at 4s intervals. Amplitude tied to `activity in last 24h` — quiet brains barely breathe, active ones visibly throb.
- **Travelling dots**: when a new memory was upserted in the last 5 minutes (from `updated_at`), a bright dot travels the citation thread from source → sector → core once. This is the "data moving" motion the user asked for.
- **Verification sweep**: verifying a memory triggers a one-time emerald ripple from that dot outward.
- **Hover**: sector orb → highlights its kind satellites and dims the rest; kind diamond → surfaces its memory dots as a small floating list; memory dot → shows title + citation thread.
- **Idle**: after 10s with no interaction, dots drift 1–2px on a slow noise field so the diagram feels alive without being distracting.

All motion respects `prefers-reduced-motion` (falls back to static positions with a "Play" button).

## Legend & controls

Fixed strip along the top of the canvas:

- **Legend chips**: country ●, sector ○, kind ◆, memory ·, verified halo, recent-activity dot. Click a chip to toggle that layer.
- **Scope switch**: `Country | Regional | All countries` (last option only for global admin).
- **Kind filter**: 7 diamond chips, click to isolate one kind across all sectors.
- **Verified toggle**: `All | Verified only | Unverified only`.
- **Time window**: `All time | 30d | 7d | 24h` — filters motion + dust.
- **Search**: fuzzy-matches memory titles; matched dots enlarge and pull toward the center briefly.

Right-hand **inspector panel** (slides in on click):
- Header: `sector · kind · N objects`
- Weight/verification stacked bar for the selection
- List of memory rows (reuses `MemoryTab`'s row component with verify/delete)
- Citations list with jumps to `SourceDetailSheet`

Bottom **activity ticker**: last 10 upserts with author + time, matching each travelling dot on the canvas. Clicking a ticker row flies the camera to that dot.

## Layout across the screen

```text
┌─────────────────────────────────────────────────────────┐
│ Legend chips · Scope · Kind filter · Verified · Time    │
├───────────────────────────────────────────┬─────────────┤
│                                           │             │
│                                           │  Inspector  │
│              Constellation canvas         │  (context)  │
│                                           │             │
│                                           │             │
├───────────────────────────────────────────┴─────────────┤
│  Activity ticker  ····································  │
└─────────────────────────────────────────────────────────┘
```

Empty state: if the brain is empty for the current scope, the canvas shows only the pulsing core with a single sentence ("No memory objects yet — seed via /admin/countries/$code/onboard").

## Super-admin cross-country specifics

- New file `src/routes/_authenticated/admin/brain.tsx` — global constellation.
- Data: one aggregate server function `listAllMemory` returning `{ country_code, sector_code, kind, weight, verified, updated_at, title, id }[]` across all bound countries (respects `has_role('admin')`).
- Countries laid out on an outer ring, sorted by total memory count. Clicking a country zooms into that country's sub-constellation (same component, filtered `country_code`), with a breadcrumb `System ▸ LCA` and an "Back to system" pill.
- KPIs strip above the canvas: total countries, total sectors covered, total memory objects, verified %, upserts last 24h.

## Technical approach

- **Rendering**: SVG for structural elements (rings, threads, orbs, diamonds) — sharp at any zoom and matches the site's flat aesthetic. Canvas overlay only for the memory-dust particle field (thousands of dots) using `requestAnimationFrame`. No chart library, no D3 force layout (deterministic angular hash keeps positions stable across renders).
- **Layout math**: pure functions in `src/components/country-data/brain-constellation/layout.ts` — `sectorAngle(sector_code)`, `kindOffset(kind)`, `orbitRadius(count)`. Deterministic → same brain always renders identically.
- **Components**:
  - `src/components/country-data/brain-constellation/BrainConstellation.tsx` — canvas + SVG root
  - `.../Legend.tsx`, `.../Inspector.tsx`, `.../ActivityTicker.tsx`, `.../ControlsBar.tsx`
  - `.../particles.ts` — memory-dust animation
  - `.../motion.ts` — pulse / travelling-dot / ripple primitives, all `prefers-reduced-motion` aware
- **Data**: reuses `listMemory({ scopeKey })` for per-country. Adds:
  - `listAllMemory()` in `src/lib/country-data/manage.functions.ts` — aggregate, admin-only via `requireSupabaseAuth` + `has_role`
  - `listRecentMemoryActivity({ scopeKey, sinceMinutes })` — powers ticker + travelling dots
- **Wiring**:
  - `MemoryTab` in `countries.$code.data.tsx` gains `view: "constellation" | "visual" | "list"`; constellation becomes default.
  - New route `src/routes/_authenticated/admin/brain.tsx`; add link in `SuperAdminShell` and on `countries.index.tsx`.
- **Perf**: memoize layout by `rows.length + max(updated_at)`; particle field caps at 2000 dots (sample beyond that, show "+N more" in inspector). Cross-country view uses per-country counts only for the overview and lazy-loads full memory rows when a country is zoomed.

## Out of scope

- Editing memory schema, weights, or the seed agent.
- 3D / WebGL rendering — flat SVG + canvas is enough and matches the site.
- Changing `/narrative/brain` (operator view) or the existing `MemoryVisual` matrix (kept as the `Visual` sub-view).
- Real-time streaming (Supabase subscriptions) — v1 refetches every 30s while the tab is focused; live subscriptions are a follow-up.
