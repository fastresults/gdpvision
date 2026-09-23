# PRD · Sovereign Eye layer registry and legend

**Product:** GDPVision (gdpvision.com)
**Surface:** Sovereign Eye — `admin/countries/$code/godseye`, `s/$token`
**Goal:** carry the platform's existing public data on the map, honestly labelled
**Type:** refactor + phased build. Audited against `6866d400` ("Redesigned Sovereign Eye map").
**Status:** proposed
**Date:** 23 September 2026
**Reference audit:** https://claude.ai/code/artifact/cd5a623f-53f2-473f-9746-8a143d4314f3

This PRD specifies the "layer registry pattern" and "provider registry" that
`.lovable/plan/integrate-a-gdpvision-native-sovereign-eye-experience-2026-09-23.md`
already calls for. It supersedes nothing in that plan.

---

## Problem

The Sovereign Eye borrowed God's Eye View's visual language and left behind its architecture.

GEV runs 27 layers through three decoupled registries. The Sovereign Eye runs 6 layers through one
array literal at `src/lib/sovereign-eye.functions.ts:533-612` and a chain of six JSX branches keyed
on `kind` in `RegionMap.tsx`.

The legend is not the problem — it is derived from `visibleKinds` at `RegionMap.tsx:36-48` and
explains every mark the map draws. The problem is that the map draws almost nothing.

The schema holds **157 tables**. The Sovereign Eye reads **eleven**.

| | God's Eye View | Sovereign Eye |
|---|---|---|
| Layers registered | 27 (24 in panel) | 6 |
| Panel groups | 6 | none — flat rail |
| Feed states per layer | 7 | 3 (`ready` / `partial` / `missing`) |
| Backing data domains | 44 credited sources | 11 of 157 tables |

---

## Phase 0 — Correctness (blocking; no new layers until these land)

These mislead a reader of the map. Every later phase inherits them.

### 0.1 Six of 22 countries render as St. Kitts

`GEO` (`sovereign-eye.functions.ts:170-193`) has all 22 registry codes. `POINTS`
(`RegionMap.tsx:9-18`) has 16. `CYM`, `TCA`, `VGB`, `MSR`, `MTQ`, `GLP` fall through the `??`
fallback at line 31 to `KNA`. The map centres on St. Kitts and labels it "Selected country".
No error, no warning.

**Fix:** add the six missing `POINTS`. Replace the `??` fallback with an explicit
"outside mapped bounds" state — never a silent substitution of a different country.

### 0.2 The public share route renders an empty map

`src/routes/s.$token.tsx:43-50` passes `RegionMap` only `code`, `countryName`, `layers`,
`focusedLayerId`, `pinnedFeature`, `onPin`. No `flows`, `kpis`, `sectors`, `evidence`, `live` —
all default to empty, so every layer falls into the empty-summary-ring branch at
`RegionMap.tsx:73-84`.

**Anyone opening a shared link sees hollow dots, never the map its author saw.** The scene's
`layers` jsonb carries counts, not rows, so there is nothing to restore from.

**Fix:** either persist the mark rows into the scene at save time, or have the public route
re-run `loadWorkspaceData` for the scene's country under an anonymous read path, filtered to
`visibility = 'public'`. Prefer the latter — it keeps shared scenes current and cannot leak
private rows that were public-safe at save time but are not now.

### 0.3 Sector-to-ministry links are fabricated

`sovereign-eye.functions.ts:473-480` attaches *the first five ministries of the country* to
*every* sector with `weight: 1`. `ministry_sectors` — the real weighted matrix, read correctly by
`country-viz/viz.functions.ts:206` — is never queried.

Two consequences: the hover string `"Confidence grade X · N ministry links"` is meaningless, and
because the ministry layer derives from `sectors.flatMap(s => s.ministers)`, it renders nothing
when `country_sectors` is empty even if `ministries` is fully populated.

**Fix:** query `ministry_sectors`. Derive the ministry layer from `ministries` directly.

### 0.4 `HEADLINE_KPIS` is dead code

The whitelist at `sovereign-eye.functions.ts:195-206` shares exactly one code
(`tourism_arrivals`) with the canonical registry in `country-onboarding/kpi-registry.ts`. The
filter falls through to "has a value", so it degrades to "the 12 most recently updated KPIs".
The four dots on the map are arbitrary. The same stale list is duplicated at
`country-viz/viz.functions.ts:77-81`.

**Fix:** delete both copies. Read the headline set from `kpi-registry.ts` — one source of truth.

### 0.5 Grade F ranks above grade D

`gradeStrength` (line 230) returns A=92, B=76, C=58, D=38, and **52 for anything else**.
`country-onboarding/seeds.server.ts:71` writes `'F'` for "Provisional small-state default — no
primary source available". That scores 52, above an analyst reconstruction.

The `series_grade_downgrade_alert` trigger
(`supabase/migrations/20260714142707_*.sql:31-58`) uses the opposite ordering — unknown ranks worst.

**Fix:** one ordering, shared. Unknown ranks worst. Add a CHECK constraint on
`confidence_grade` or stop writing `'F'`.

### 0.6 `memory_objects` matches on a bare substring

`sovereign-eye.functions.ts:421` uses `ilike` with the country code wrapped in percent signs and
no prefix. The convention everywhere else is the `country:CODE` prefix form
(`viz.functions.ts:368`). A three-letter code embedded in an unrelated scope key will match.

### 0.7 `ICONS[layer.kind]` has no fallback

`LayerRail.tsx:8`. A layer whose kind is absent renders `undefined` as a component and crashes
the rail. Live hazard the moment a saved scene carries a retired kind.

### 0.8 `country_sectors` has no `visibility` column

The migration that added `visibility` to twelve tables
(`supabase/migrations/20260716141140_*.sql`) skipped it, which is why line 520 hardcodes
`{ public: count, private: 0 }`. The sector layer is *asserted* fully public, so the publish gate
at line 721 cannot see sector data at all.

**Decision needed:** add the column, or document that sector composition is public by definition.

### 0.9 The live feed blocks every workspace load

`loadWorkspaceData` awaits `loadLiveFeed(geo)` — two external HTTP calls to Open-Meteo and USGS —
on the critical path of eleven parallel Supabase reads. An Open-Meteo outage delays the chamber.

**Fix:** resolve the live layer client-side after first paint, in its own `loading` feed state.

### 0.10 `useMemo` deps

`RegionMap.tsx:48` lists `[layers, visibleKinds]` while the body closes over `flows`. Inert today
because `visibleKinds` is a fresh `Set` each render. Wrong as soon as it matters.

---

## Phase 1 — The registry

### 1.1 The contract

`SovereignEyeLayer` is already uniform and correct —
`{id, label, kind, status, strength, evidenceCount, visibility, updatedAt, narrative}`.
Keep it. Everything *downstream* of it is a hand-written branch; that is what changes.

Adding a seventh layer today touches six sites:

| # | File | Hand-edit required |
|---|---|---|
| 1 | `sovereign-eye.functions.ts:54` | Widen the closed `SovereignEyeLayerKind` union |
| 2 | `sovereign-eye.functions.ts:377-443` | Add a query to `Promise.all` + an entry to `firstError` |
| 3 | `sovereign-eye.functions.ts:454-497` | New row type and mapping block |
| 4 | `sovereign-eye.functions.ts:533-612` | Hand-write status, strength, evidenceCount, visibility, updatedAt, narrative |
| 5 | `RegionMap.tsx` | Props, a JSX render block with its own ring radius, empty-state filter, legend rows, `LegendMark` branch |
| 6 | `LayerRail.tsx:8` | Add to `ICONS` |

Six sites × fifteen new layers is not a large job; it is an infeasible one.

### 1.2 The `LayerSpec` record

```ts
type LayerSpec = {
  id: string;
  label: string;
  group: "flows" | "structure" | "exposure" | "conditions" | "evidence" | "instruments";
  icon: LucideIcon;
  narrative: string;

  // provenance, per the data-governance requirement in the Lovable plan
  sourceLabel: string;          // "World Bank WDI", "country corpus", "Open-Meteo"
  licenseNote?: string;         // shown in attribution
  ageToleranceDays: number;     // GEV's maxGapMs — drives `stale`
  expectedCount: number;        // drives `partial`

  load: (ctx: LayerContext) => Promise<Row[]>;
  toMarks: (rows: Row[], origin: Point) => Mark[];
  legend: (rows: Row[]) => LegendEntry[];
};
```

Then:

- `RegionMap` = `specs.filter(visible).flatMap(s => s.toMarks(rows, origin))`
- Legend = `specs.filter(visible).flatMap(s => s.legend(rows))`
- Rail = `specs.map(row)`, grouped by `group`

Adding a layer becomes one file.

### 1.3 Three GEV decisions to copy

**Presentation order is independent of registration order.** GEV's `PANEL_GROUPS`
(`src/ui/layerPanel.js:19-64`) is explicitly decoupled, and anything unlisted sorts to the end
under "Other layers". A new layer is never invisible, only unsorted.

**Validate at import.** `createLayerCatalog()` throws on any duplicate or unmatched id;
`validateLayerStateRegistry()` runs at module load. Drift is made impossible rather than tested for.

**A saved scene asserts only about the layers it names.** GEV's `sceneLayerPlan`
(`src/scenes/scenePolicy.js`): *"A shot's layer map is an assertion about the layers it NAMES, not
a claim of authority over every layer that will ever exist."* Their shipped recipes, authored when
there were four layers, walked the live registry and forced everything else off — silently tearing
down layers that nothing put back, because playback has no restore pass.

GDPVision has the same trap waiting. `SceneLayerInput` takes `kind: z.string()`, so persisted
scenes accept new kinds without migration, but an old scene replayed through `RegionMap` renders
nothing for a kind the renderer does not know. **Decide now: a saved scene names its layers and
says nothing about the rest.**

Also raise `SaveSceneInput.layers` `.max(12)` (line 31) and `BriefInput.selectedLayerIds`
`.max(12)` (line 39) before Phase 2.

### 1.4 First four layers on the new registry

All read data that already exists. They exist to prove the registry, not to add scope.

| id | Label | Source | Mark |
|---|---|---|---|
| `regional-standing` | Regional standing | `caricom-registry.ts`, `countries.is_caricom/is_oecs/is_cbi_state` | Ring style on comparator dots. Zero queries — `isCbiState` is already computed at line 622 and discarded. |
| `exposure-index` | Exposure index | `exposure_index` (`period`, `value` 0–100, `decomposition`) | Gauge arc around the country node |
| `peer-comparators` | Peer comparators | `fdi_posture_snapshots.peer_country_codes[]` | Ties to the 16 neighbour dots already drawn |
| `series-freshness` | Series freshness | `series_freshness` view (`age_days`) | Age as opacity on every mark — an encoding, not a mark of its own |

---

## Phase 2 — Feed state, legend blocks, structural layers

### 2.1 Port `layerFeedState`

GEV's `src/data/feedState.js` is 55 lines that normalise heterogeneous per-layer stats into seven
states. The rules that matter:

- An error **with no prior data** is `unavailable`. An error **with** prior data is `degraded` —
  the row keeps showing what it has, honestly labelled.
- Guidance statuses (`empty`, `idle`) are user prompts, **not faults**. They return `nominal`. But
  a genuinely stale cache still reads `stale` through a guidance state.
- `partial` is spelled out numerically: `"N of M records accepted"`.

Sovereign mapping:

| State | Trigger |
|---|---|
| `nominal` | Rows present, newest point inside this layer's `ageToleranceDays` |
| `loading` | Query in flight |
| `stale` | `series_freshness.age_days` past tolerance; `getCapitalFlows` already flags >365d |
| `partial` | Rows returned < `expectedCount` — "9 of 12 indicators carry a value" |
| `fallback` | `method ∈ modelled \| residual`; `provenance` inferred rather than verified |
| `degraded` | `source_health_checks.ok = false` or `corpus_fetch_attempts.outcome ∈ error \| throttled`, prior data still shown |
| `unavailable` | No rows **and** the source failed |

The last row is the point. Today `missing` conflates *we could not reach the source* with *this
country has no such data*. For a sovereign instrument those are opposite conclusions.

The toggle button becomes the status chip, as in GEV — one control, seven words.

### 2.2 Move the legend into the rail rows

The single floating legend card fits at six layers and does not at twenty. GEV's model: a layer
declares `getRowControls()` returning `{chips, legend, info, infoTitle}`; the block is hidden when
the layer is off — *"so a quiet row stays quiet."*

**The swatch rule, non-negotiable:** the legend swatch is set from the *same token* as the mark it
explains, not a hand-picked approximation. GEV's CSS comment states the intent: *"The swatch IS the
datum."* This is what makes a legend structurally incapable of drifting from the map.

### 2.3 Fix the confidence encoding

`Dashed = confidence B–D` conflates two things and misstates both. The code dashes anything where
`confidence !== "A"`, and `confidence_grade` has no CHECK constraint anywhere, so a seeded `'F'`
dashes while the legend calls it B–D.

Split:

- **Dash = method.** Solid where `method = reported`. Dashed where `modelled` or `residual`. The
  honest statement is *this line was calculated, not observed* — GEV's "RECONSTRUCTED ESTIMATE"
  convention.
- **Grade = a four-step pattern**, shown once in a grade key. `codex-entries.ts` already commits to
  this: *"Grades pair with pattern in the design system so hue is never load-bearing."* The map does
  not honour that commitment today.

### 2.4 Structural layers

| id | Label | Source | Why it matters |
|---|---|---|---|
| `sector-linkage` | Sector linkage | `sector_edges` (`from_sector`, `to_sector`, `weight`, `order_rank`) | A real graph, already used by `ripple.functions.ts`. Stops the economy looking like isolated spokes off a hub. |
| `portfolio-weight` | Portfolio weight | `ministry_sectors` | The real weighted ministry↔sector matrix (see 0.3) |
| `threat-vectors` | Threat vectors | `fdi_threats` (`target_sector_codes[]`, `severity_pct`, `horizon_years`) | Nine preset types already sector-targeted. Near-free. |
| `press-signals` | Press signals | `narrative_feed_items` by `narrative_feeds.scope` | First genuinely live sovereign layer. Polled by `api/public/hooks/press-tick.ts`. |
| `source-health` | Source health | `source_health_checks`, `corpus_fetch_attempts` | Where the map cannot see |

---

## Phase 3 — Time and projection

### 3.1 The union timeline

This is the highest-value item on the whole list: it turns a frozen instant into an instrument of
state.

GEV's weather clock (`src/layers/weather/clock.js`) builds a **union timeline** across all
registered products and, per product, selects the newest frame at-or-before the target *within that
product's own max gap* — radar tolerates 30 minutes, global infrared 3 hours. Products with
different cadences never fake alignment.

The sovereign equivalent: `country_kpi_points` is annual, `series_points` quarterly or monthly,
`narrative_feed_items` hourly, `exposure_index` periodic. A scrub to "Q2 2026" shows each layer's
newest point at-or-before that date and **greys out any layer whose newest point exceeds its own
`ageToleranceDays`**.

GEV's rule applies verbatim: **no nowcast is synthesized.**

`country_kpi_points` is already batch-loaded by `viz.functions.ts:283`.

### 3.2 Remaining layers

`scenario-ghost` (`engine/v1_macro.ts` emits `{p10,p50,p90}` + `sectorImpacts[].delta_pp` — hollow
ghost ring at projected p50, whisker to the band), `mandate-delivery` (`compact_pledges`,
`compact_deliverables`), `cabinet-load` (`commitments.due_at`, `status`), `opposition-heat`
(`opposition_items.severity × amplification`), `trade-balance`, `remittance-corridors`.

---

## Proposed taxonomy

GEV groups by domain of the world. The sovereign equivalent groups by what a head of government is
looking at.

| GEV group | Sovereign group | Question it answers |
|---|---|---|
| Movement | **Flows** | What is moving through the economy |
| Infrastructure | **Structure** | What the economy is made of and who owns it |
| Events | **Exposure** | What could break it |
| Weather | **Conditions** | What is happening outside our control |
| Cameras | **Evidence** | What we can actually prove |
| Utilities | **Instruments** | What we can do about it |

Target: 21 layers against GEV's 24 in-panel. Six ship today.

---

## Encoding vocabulary

Sovereign Eye uses three visual channels today: position (ring radius per layer), size (sector
radius = GDP share), one binary (dashed = not grade A). GEV uses eleven.

| Channel | Sovereign use |
|---|---|
| Mark shape = entity class | One shape per group — already half-done (dot / circle / square / diamond) |
| Colour = class, never status | One hue per sector from the `CANONICAL_SECTORS` `--sector-NN` tokens already in `caricom-registry.ts` |
| Size = magnitude | Area = GDP share (ships); commitment count on ministry |
| Line width = relative value | Capital flow value (ships); `sector_edges.weight` |
| Dash = estimate, not measurement | `method ∈ modelled \| residual` |
| Opacity = age | `series_freshness.age_days` against each layer's tolerance |
| Sequential ramp | Exposure index 0–100; opposition severity |
| Halo / heat | Press signal volume; opposition amplification |
| Chord / arc | `sector_edges`; peer comparator ties |
| Ghost mark | Scenario p50 over current state |
| De-emphasis on focus | Focused layer at full weight, others dimmed — **never hidden** |

**The de-emphasis floor is a requirement, not a preference.** GEV dims ambient marks to 0.25,
never to zero (`src/data/focusDeemphasis.js`), because a mark that vanishes reads as *absence of
data* rather than *absence of focus*. For a head of government reading an economic map, that
distinction is the product.

---

## Provenance: four models where there should be one

| Model | Where | On the map today |
|---|---|---|
| `confidence_grade` CHAR(1) | 9+ tables, default `'C'`, **no CHECK constraint** | One binary: dashed or not |
| `provenance` + `confidence` + `inference_*` | `country_kpis`, `country_capital_flows` | `provenance` in a hover string; nothing else read |
| `freshness_status` + `series_freshness.age_days` | `country_kpis`, the view | Not read at all |
| `method` CHECK | `country_capital_flows` | Not encoded |

Plus `quality_score` 1–5, `source_health_checks`, `corpus_fetch_attempts.outcome`, `grade_alerts`,
`reconciliation_notes.residual_pct`, `country_authorized_domains.tier` with demotion.

A head of government looking at this map cannot currently tell which part of the picture is real.

### Sourcing reality

**Fetched over HTTP:** World Bank WDI, IMF WEO DataMapper (together ~11 of 18 registry KPIs, both
keyless), Open-Meteo, USGS, Google News RSS, Firecrawl.

**Named as preferred sources, never fetched:** UNWTO, CTO, ECCB, UNCTAD, KNOMAD, OECD DAC, FAO,
CDB, World Bank IDS, WHO, IEA, UN Comtrade. Seeded into `capital_flow_nodes.preferred_sources`,
handed to Perplexity and Gemini as prompt hints, accepted through a regex plausibility gate at
`country-onboarding/capital-flows.server.ts:153`.

**The entire capital-flow ledger — the Inbound/Outbound ribbons — is LLM-sourced with a string
match on the claimed publisher, not an API pull.** `method` records which.
`SovereignSankey.tsx:532-552` surfaces `modelled` rows in an Assumptions block. The Sovereign Eye
does not.

`country_source_connections` (`kind ∈ api|mcp`, `endpoint_url`, `last_polled_at`) is scaffolding
for real ingestion with no poller. Nothing ever writes `last_polled_at`.

The legend can be honest about either state. It has to say which.

---

## Open decisions

1. Does `country_sectors` get a `visibility` column, or is sector composition public by definition?
   Blocks the publish gate from being meaningful (0.8).
2. Is the schematic projection permanent? Twenty layers on concentric rings around one origin will
   collide. GEV's answer is a label arbiter with per-layer cohort caps
   (`src/data/labelArbiter.js`, 32px cell grid, minimum label lifetime, per-layer caps). If the
   rings stay, that machinery is needed by Phase 2.
3. Do any of UNWTO, ECCB, UN Comtrade or CDB get a real API client, or does the capital-flow ledger
   stay LLM-sourced?

---

## Acceptance

- [ ] All 22 registry countries centre correctly; out-of-bounds is an explicit state
- [ ] A shared scene link renders the marks its author saw, with private rows excluded
- [ ] Ministry links come from `ministry_sectors`; the ministry layer survives an empty `country_sectors`
- [ ] One grade ordering across `gradeStrength` and the downgrade trigger; unknown ranks worst
- [ ] Adding a layer touches one file
- [ ] Every layer declares source, license note, age tolerance and expected count
- [ ] Seven feed states; `unavailable` is distinguishable from "no such data"
- [ ] Legend swatches are computed from the same token as their marks
- [ ] Dash means method, not grade; grade is a four-step pattern
- [ ] Focus dims to a floor, never to zero
- [ ] A saved scene asserts only about the layers it names
