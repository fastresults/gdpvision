# Replace nation dots with real country outlines

## Recommendation
Draw each nation as its own shape (its island outline) on the Regional map and the Globe, instead of a dot. The outlines come from the world map data already in the project (the same source that draws the globe's land), so no new service or licence is needed.

The catch is scale: at full-basin zoom, islands like Montserrat, Anguilla or Grenada are only a fraction of a dot wide. Drawn true to size they would disappear. So:

- **Large nations** (Guyana, Suriname, Belize, Jamaica, Haiti, Bahamas, Trinidad & Tobago, and so on) are drawn at true size and position.
- **Small islands** are drawn with their real shape, enlarged around their true location to a minimum readable size. The legend says "Small islands enlarged for visibility; not to scale". As you zoom in, the enlargement shrinks until each island is shown at true size.
- **Selected country:** gold fill with a dark outline. **Other nations:** paper fill with a grey outline. **Hazard exposure (Globe):** the same red ring colour, now drawn around the island's shape.
- **Hover, click and pinning** work as today. An invisible touch area around each shape keeps tiny islands easy to hit. Labels stay beside each shape.

## What changes for the user
- The Regional map shows the real Caribbean island chain.
- The Globe's Region view shows every nation's shape; exposed nations are outlined in red.
- The legend's "Nation" entry shows a small island silhouette instead of a dot, with the not-to-scale note.

## Technical details
- A one-off script (`scripts/build-caribbean-shapes.ts`) extracts the 22 nations from `world-atlas/countries-10m.json` (fine detail, needed for small islands). It simplifies them and writes a small, trimmed file, `src/lib/sovereign-eye/caribbean-shapes.json`, of roughly 30–60 KB. The full 3.6 MB atlas is never sent to the browser.
- Guadeloupe and Martinique are stored as part of France in the atlas. The script splits them out by their location, and every other nation is matched by name.
- `caribbean-geo.ts` gains `shapeFor(code)`. The capital point stays as the label and hazard-distance anchor.
- `RegionMap.tsx`: the nation `<circle>` becomes a `<path>` built with a d3-geo equirectangular projection fitted to the existing map bounds, so shapes line up with the flows and marks already drawn. A minimum-size rule scales small shapes around their centre using the current zoom level.
- `GlobeView.tsx`: nation dots become `path(shape)` with the same styling and minimum-size rule.
- Legend: the nation swatch becomes a mini silhouette, and a "not to scale" note is added.
- No changes to data tables or server code.
