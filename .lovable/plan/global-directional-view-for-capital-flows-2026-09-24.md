# Global directional view for capital flows

## Current state (confirmed by code reads)

- The Sovereign Eye map is a Caribbean-only schematic: hardcoded bounds (lon −92…−54, lat 4…34) and a 16-island point list in `RegionMap.tsx`.
- Capital flows are drawn as abstract spokes around the selected country. The data (`country_capital_flows`) carries `node_key` (FDI_NET, REMITTANCES, …), `value_usd_m`, `side` (input/output), period, confidence — **but no partner country or origin/destination geography**.
- The research pipeline (`flow.server.ts`, Perplexity → Gemini → infer) only asks for per-node values, so no bilateral geography exists anywhere in the corpus today.

Consequence: a "global view" cannot be honest with current data. Drawing flows from invented origins would violate the platform's no-fabrication rule. The real work is adding partner geography to the data, then the visual.

## Recommended approach: two stages

### Stage 1 — Partner geography in the data (the foundation)

Add bilateral partner attribution to capital flows, sourced through the existing AI research waterfall:

- New table `country_capital_flow_partners` (country_code, node_key, period, partner_name, partner_iso3, partner_lat, partner_lon, share_pct, value_usd_m, confidence_grade, citations) with GRANTs + RLS via `has_country_access`, public/private `visibility` like other corpus tables.
- Extend `searchCapitalFlows` with a second pass: per node, ask the model for the top 3–5 origin countries (inflows) or destination countries (outflows) with approximate share % and citations. Reuse `runWithFallbacks` and the existing commit/review gating (a draft needs enough partners to cover a sensible share before it's commit-eligible).
- Dedup/upsert on (country, node, period, partner) per the second-brain no-duplicates rule; snapshot citations into the row.
- Surface partner rows in the existing interpretation panel and Evidence panel, each with an Explain-this entry ("shares are model-estimated from cited sources, not official bilateral statistics" when confidence is low).

### Stage 2 — Global flows map mode (the visual)

Add a view toggle on the Sovereign Theatre: **Regional** (current) / **Global flows**.

```text
┌ Sovereign Theatre ─────── [ Regional | Global flows ] ─┐
│                                                        │
│      USA ●╮                     EU ●╮                  │
│           ╲                        ╲                   │
│  UK ●──────╲───▶  ◆ GRD ◀───╮       ╲                  │
│                (selected)    ╲       ╲                 │
│                               ╲       ╲                │
│      World schematic, arcs sized by value,             │
│      green = inbound, gold = outbound                  │
└────────────────────────────────────────────────────────┘
```

- A simple whole-world equirectangular projection (same hand-rolled SVG approach as today — no new map library, no external tiles, keeps the paper/ink house style and works offline/print).
- Directional arcs (curved paths) from each partner coordinate to the selected country: green inbound, gold outbound, width = value, dashed = low confidence — identical encodings to today's capital layer, so the legend and interpretation panel work unchanged.
- Zoom/pan controls, collapsible legend, hover-delay interpretation, click-to-pin, and the Explain-this system all carry over as-is.
- Graceful empty state: if a country has no partner data yet, the Global view says so and offers a "Research partner geography" action (admin) that runs the Stage 1 research pass.
- Public shared scenes (`/s/$token`) only include partner rows with public visibility.

## Why not the alternatives

- **Fake world anchors from today's data** (place "inflows" at generic points like "North America"): fastest, but fabricates geography — rejected.
- **Mapbox/Cesium globe**: heavy dependency, external tokens, and a visual style that clashes with the engraved paper aesthetic; the schematic SVG already matches house style and needs no new package.
- **SovereignSankey extension**: good for category composition, but it cannot show geography; it stays as the composition companion view.

## Technical notes

- New migration: `country_capital_flow_partners` + GRANTs + RLS policies in one migration.
- Research: second pass inside `src/lib/corpus/searchers/flow.server.ts`; write-back via `writers.server.ts` with normalized-key upsert.
- Server fn: extend `getCapitalFlows` (or add `getCapitalFlowPartners`) in `flows.functions.ts` with the same `assertCountryAccess` guard.
- UI: `RegionMap.tsx` gains a `mode: "regional" | "global"` prop and a global projection + arc renderer; toggle lives in the theatre header; legend gains no new symbols (encodings reused).
- Partner coordinates: resolve via a small built-in ISO3 → centroid table (no geocoding dependency).
- Verification: typecheck, `bun run check:maps`, build, plus an authenticated visual pass on `/admin/countries/GRD/godseye` once signed in.

## Suggested sequencing

Stage 1 (data) ships first and is useful on its own — partner tables visible in the Focus tray and Evidence panel. Stage 2 (map) follows once at least one country has commit-eligible partner data. Stage 2 can be scoped to a follow-up turn if you prefer.
