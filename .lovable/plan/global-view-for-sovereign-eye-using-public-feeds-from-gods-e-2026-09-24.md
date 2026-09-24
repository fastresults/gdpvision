# Global view for Sovereign Eye, using public feeds from gods-eye-view

## What the repo is (checked against its README and DATA_SOURCES.md)

- Its code is MIT-licensed, but it is a separate Node/Vite app built on a Cesium 3D globe. It fetches every feed live and needs a Google Maps key or Cesium ion token for photorealistic 3D. There is no data you can simply copy in: nearly all feeds are fetched at runtime, and the few bundled packs carry their own licences.
- Feed licences fall into three groups:

| Group | Feeds | Use in GDPVision |
|---|---|---|
| Safe (public domain / CC BY / ODbL) | NOAA NHC hurricane tracks and cones, USGS earthquakes, NASA GIBS satellite imagery, NOAA GFS wind, ECMWF wind (CC BY), Open-Meteo, adsb.lol flights (ODbL), OSM datacenters (ODbL), CelesTrak | Yes, with attribution |
| Conditional | AISStream ships (beta, no formal terms), GDELT news, Esri imagery (Esri agreement), Google 3D tiles (paid key) | Optional, only after review |
| Not allowed | OpenSky flights (non-commercial only), Cesium ion personal tier, Nepal flood bundle (non-commercial), adsbdb route data (no redistribution) | No |

**Conclusion:** use the repo as a guide to proven public endpoints and layer patterns. Do not embed it or its Cesium globe. Rebuild the few feeds that matter to a Caribbean government, following GDPVision's own rules.

## Recommended approach

### 1. A three-way scale toggle on the Sovereign Theatre

```text
[ Regional | Global flows | Globe ]
```

- **Regional:** today's Caribbean map, unchanged.
- **Global flows:** the world map with partner-country arcs that was just built.
- **Globe (new):** a rotatable orthographic globe drawn in the same paper/ink engraved style. It opens centred on the selected island, which stays highlighted with a gold ring. A dotted outline marks the Caribbean basin so the user always sees where the island sits in the world. Drag to rotate, zoom with the existing controls, and a "Return to island" reset.
- No 3D tiles, no Cesium and no paid keys. The globe is SVG, so it keeps working offline and in print.

### 2. Public global layers, grouped for economic relevance

These layers appear in the Map Layers tray only in Globe mode. Each one has an On/Off switch, a legend entry, a hover explanation and an Explain-this rationale:

- **Hurricanes (NOAA NHC):** active storm tracks and forecast cones, flagged when a cone crosses the selected island. This is the highest-value layer for the region.
- **Earthquakes (USGS):** events from the past 7 days, sized by magnitude, with the distance to the island.
- **Capital-flow arcs:** the existing partner data, drawn on the globe.
- **Satellite imagery snapshot (NASA GIBS):** an optional daily true-colour tile of the island, shown in the side tray rather than draped over the globe.
- **Later, optional:** flights near the island (adsb.lol) and ships (AISStream, only after its terms are reviewed).

Every layer shows its source, licence and last-updated time. If a feed fails, the layer is marked "Feed unavailable" and the rest of the workspace keeps loading. This also fixes the open issue where a slow live feed blocks the whole workspace.

### 3. Data handling

- Server functions fetch each feed and cache the result briefly (5–60 minutes), so the browser never calls third parties directly and every feed is checked against the existing safe-URL guard.
- Live readings are not saved into the second-brain corpus. They are reference context, not facts to research. Only saved scenes store a snapshot.
- Shared public scenes (`/s/$token`) contain only public-domain and CC-licensed layers, with attribution printed.

## Why not the alternatives

- **Embed or fork gods-eye-view:** a different framework and runtime, a heavy Cesium dependency, key-gated 3D, and non-commercial feeds mixed in. It would clash with the house style and create licensing risk.
- **Cesium or Mapbox globe inside GDPVision:** a heavy package, external tokens and a photographic style that breaks the engraved look.

## Technical notes

- Globe projection: add `d3-geo` (small, pure JS) plus a bundled low-resolution world outline (Natural Earth, public domain) for an orthographic projection. `RegionMap` gets `mode: "regional" | "global" | "globe"`.
- New `src/lib/sovereign-eye/global-feeds.functions.ts`: `getGlobalHazards({countryCode})` returns NHC + USGS results, protected by country access, with a per-feed timeout and `Promise.allSettled`. Separate `*.server.ts` fetchers use `assertPublicHttpUrl`.
- Rationale entries go in `sovereign-eye-entries.ts` (hurricane cone meaning, magnitude vs. distance, "live context, not corpus evidence").
- No new tables. Afterwards: `bun run headers && bun run map`, typecheck, build, and a signed-in visual check on `/admin/countries/GRD/godseye`.

## Sequencing

1. Globe mode with the island highlight and flow arcs.
2. Hurricanes and earthquakes layers (non-blocking load).
3. Optional imagery, flights and ships in a follow-up.
