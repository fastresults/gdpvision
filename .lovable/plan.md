# Plan: Integrate a GDPVision-native “Sovereign Eye” experience

## Recommendation

Build a new country-scoped geospatial intelligence workspace inspired by `gods-eye-view`, but do not copy the repository wholesale.

The source repo is a browser-based 3D globe with live public feeds, including aircraft, ships, satellites, earthquakes, traffic, public cameras, and voice control [1](https://github.com/bilawalsidhu/gods-eye-view/blob/main/README.md). Its code is MIT-licensed, but its bundled and runtime data sources are not uniformly MIT; several datasets have separate restrictions, including non-commercial terms [2](https://github.com/bilawalsidhu/gods-eye-view/blob/main/LICENSE) [4](https://github.com/bilawalsidhu/gods-eye-view/blob/main/DATA_SOURCES.md). The right approach is therefore an adaptation: keep the interaction model and reusable globe/layer concepts, but rebuild the data, styling, security, and workflow inside GDPVision.

Working name: **Sovereign Eye**.

Primary audience: **country teams**.

Scope: **full experience**, phased safely from country-scoped map intelligence to broad OSINT feeds, AI control, saved scenes, and shareable briefings.

## Why this approach

- The external repo is a local-first Vite/vanilla JavaScript application with Node-style provider middleware and local secret handling. GDPVision is a TanStack Start, authenticated, country-scoped platform running on a serverless backend.
- Country teams must only see the public corpus plus private data they are authorized to see. The map cannot become a global unscoped surveillance console.
- GDPVision’s design system is formal, evidence-led, and restrained. The imported experience should feel like a sovereign intelligence instrument, not a copied “spy HUD.”
- Broad OSINT is valuable, but licensing, attribution, reliability, and provider costs must be controlled layer-by-layer.

## User experience

Add a new country-scoped workspace reachable from the country switchboard and country console:

```text
Country home
  → Sovereign Eye
      → Map
      → Layers
      → Evidence
      → Briefing
      → Saved scenes
```

The first screen should be the working map, not a landing page.

Core interactions:

1. **Country focus**
   - Open centered on the selected country and surrounding region.
   - Show country boundary, capital, ports, airports, energy assets, roads where available, key economic zones, and known project/investment locations.

2. **Layer rail**
   - Public economic layers from the corpus.
   - Private uploaded layers visible only to that country team.
   - OSINT layers grouped by category: movement, hazards, infrastructure, media/public cameras, weather, satellites, and alerts.

3. **Evidence side panel**
   - Clicking a marker opens a source-backed panel.
   - Every claim links back to corpus citations or provider attribution.
   - Raw structured payloads use the platform’s existing JSON renderer.

4. **AI map operator**
   - Ask questions like “show ports exposed to storm risk” or “what public evidence supports tourism corridor fragility?”
   - The AI should query the existing corpus first, then summarize visible map context.
   - The AI should not invent locations, people, figures, or source claims.

5. **Saved scenes**
   - Country teams can save a view: camera position, selected layers, filters, notes, and evidence references.
   - Saved scenes can be used in briefings and exports.

6. **Shareable view**
   - Share links should be scoped, unbranded where needed, and safe for the selected visibility level.
   - Private data must never appear in public links.

## Phased build

### Phase 1 — GDPVision-native map shell

- Add a new country-scoped route, not a global public route.
- Add the map workspace to the country switchboard.
- Use a client-only globe/map component so server rendering does not break.
- Style the workspace using GDPVision tokens: paper, ink, line, gold, signal, and sector colors.
- Use existing button utilities only.
- Avoid hardcoded color palettes from the external repo.

Deliverable:

- A working country-focused map shell with layer rail, evidence panel, loading/error states, and country navigation.

### Phase 2 — Corpus-backed economic intelligence layers

Start with GDPVision-owned data before live feeds:

- Ministries and portfolio relevance.
- Sector concentration by region or asset where available.
- Capital-flow touchpoints: ports, import exposure, tourism inflows, remittance corridors, fiscal outflows.
- Projects, pledges, cabinet decisions, risks, narrative signals, and persona-study field locations where data exists.
- Public/private visibility controls aligned with the corpus rules.

Deliverable:

- A map that makes the country’s existing second brain spatial and interrogable.

### Phase 3 — Broad OSINT layer framework

Add OSINT as modular providers, each with its own license, attribution, reliability, and refresh policy.

Recommended first OSINT layers:

- Weather and hazards.
- Earthquakes and storm advisories.
- Public infrastructure points from permissive or attribution-compatible sources.
- Shipping and aircraft only after licensing review.
- Public cameras only where terms allow display in a commercial product.

Do not ship restricted bundled datasets from the source repo. TeleGeography-style non-commercial cable data should be omitted unless separately licensed [2](https://github.com/bilawalsidhu/gods-eye-view/blob/main/LICENSE).

Deliverable:

- A provider registry with safe defaults, visible attribution, and clear unavailable states.

### Phase 4 — AI map operator

- Add a server-side AI function for map commands and brief synthesis.
- Use the existing Lovable AI Gateway pattern and the assigned text model.
- Keep prompts, tools, and credentials server-side.
- Ground answers in corpus results and visible layer data.
- Add bounded retries only for retryable AI failures.
- Show safe provider errors in the UI.

Deliverable:

- A command box that can filter layers, move the camera, open evidence, and draft a short map briefing.

### Phase 5 — Saved scenes, exports, and sharing

- Save map state, selected layers, annotations, and evidence references.
- Allow country teams to prepare scene-based briefings.
- Add private/internal sharing first.
- Add public unbranded share links only with strict visibility filtering.

Deliverable:

- Scene library, briefing export, and safe share flow.

## Technical design

### Frontend

- Add a new component area for the Sovereign Eye workspace.
- Wrap any browser-only globe library behind client-only loading.
- Keep map controls outside card-heavy layouts; use full-width workspace bands and tight instrument panels.
- Use icons for layer toggles, camera controls, save, share, and briefing actions.
- Use GDPVision typography, spacing, and token colors.

### Backend

- Add `*.functions.ts` server functions for country-scoped layer manifests, corpus search, saved scenes, and AI map commands.
- Do not port the source repo’s Node/Vite middleware directly.
- Replace local file caches with database-backed or request-safe caching.
- Keep all private provider keys server-side.
- Add new tables only if needed for saved scenes, provider registry, and map annotations; every table must include grants and row-level policies in the same migration.

### Data governance

Every layer should declare:

- Source name.
- License or terms category.
- Attribution text.
- Refresh cadence.
- Whether data is stored, cached, or only viewed live.
- Visibility: public corpus, country-private, internal-only, or shareable.

### Security

- Country teams see only their country-scoped data.
- Public OSINT layers must not expose private uploaded material.
- Private uploads must remain private in map panels, saved scenes, AI summaries, and share links.
- The AI operator must never use client-side state as authority for access.

## What to reuse from the external repo

Reuse conceptually:

- 3D globe interaction model.
- Layer registry pattern.
- Camera scenes and saved view idea.
- Public-signal categories.
- Voice or natural-language map control concept.

Do not reuse directly without review:

- Local Node provider middleware.
- `.env`/desktop key setup.
- Pinokio/local launcher flow.
- Non-commercial bundled datasets.
- “Spy satellite” visual language.
- Any live feed whose provider terms do not fit commercial, multi-user use.

## Acceptance criteria

- Country teams can open Sovereign Eye from their country workspace.
- The map loads without breaking server rendering.
- Public corpus and private country data are visibly separated.
- Each layer has attribution and a clear unavailable/error state.
- AI answers cite corpus evidence or visible layer data.
- Saved scenes preserve camera, layer, filter, note, and evidence state.
- Public share links never include private data or platform branding.
- The interface follows GDPVision’s design standards: token colors, approved buttons, no raw JSON rendering, and explainable derived figures.

## Open decisions before implementation

1. Map engine: Cesium-style 3D globe versus a lighter 2D/2.5D map. For the full experience, start with a globe-capable engine, but keep the first release bounded.
2. Provider list: confirm which OSINT providers are acceptable commercially before enabling them.
3. Public sharing: decide which layer categories are allowed in unbranded public links.
4. Voice: decide whether voice control belongs in the first release or after typed AI commands are reliable.
