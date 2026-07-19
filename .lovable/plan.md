## Goal
Transform the Second Brain (`/admin/brain`) from a flat SVG into a cinematic, always-in-motion 3D constellation — pulsing core, orbiting country and sector nodes, flowing particle threads, and depth-of-field focus on whatever is closest to the camera.

## Stack
- **react-three-fiber** (`@react-three/fiber`) + **drei** (`@react-three/drei`) + **three** — the standard R3F trio, works fine in Vite/TanStack Start when rendered client-only.
- **postprocessing** via `@react-three/postprocessing` for Bloom + Depth-of-Field (the "cinematic" look).
- No new data model, no server changes. Same `rows` payload as today.

## Where
- New: `src/components/country-data/BrainConstellation3D.tsx` — the R3F canvas + scene graph.
- New: `src/components/country-data/brain-3d/` — small internals:
  - `Core.tsx` (pulsing SYSTEM core, layered shells + rim light)
  - `CountryNode.tsx` (orbiting country orb + billboard label)
  - `SectorNode.tsx` (sector orb + billboard label, hue from existing sector palette)
  - `Thread.tsx` (curved tube from core → node with GPU-instanced flowing dots)
  - `useOrbit.ts` (deterministic orbit params per country/sector code so layout is stable across renders)
  - `focus.ts` (compute "front-most" node each frame → drives DoF focus distance + subtle scale/label boost)
- Edit: `src/routes/_authenticated/admin/brain.tsx` — swap `BrainConstellation` for a `<ClientOnly>`-gated lazy import of `BrainConstellation3D`, keep the same props (`rows`, `filter`, `onFilter`, `onSelectCountry`, `centerLabel`).
- Keep `BrainConstellation.tsx` (2D) as a fallback for reduced-motion / no-WebGL.

## Scene design
- **Camera**: PerspectiveCamera at ~(0, 0, 14), slow autonomous dolly + parallax on pointer move (damped). OrbitControls enabled but damped, with auto-rotate at 0.25 rad/s so it's always drifting even when idle.
- **Core**: two nested icosahedron shells (inner solid ink-950 with emissive gold-500, outer wireframe) breathing on a sine (scale 1.0 → 1.06, 4s period). Point light at center pulses in sync.
- **Sector ring**: 12 sector orbs on a tilted torus (~radius 4.5), each hued from `--sector-01…12`. Slow rotation around Y.
- **Country shell**: countries distributed on a Fibonacci sphere (~radius 8), each orbiting its anchor point on a small local ellipse so the whole shell "swims". Size scales with memory count; verified % drives emissive strength.
- **Threads**: quadratic Bézier tubes core→sector and sector→country. Flowing dots are a single `InstancedMesh` per thread with a shader offset driven by `uTime` — 2–3 dots per thread, amber tint when the cluster had activity in the last 24 h (reuse existing "recent" logic).
- **Labels**: `<Billboard>` + `<Text>` from drei, always camera-facing. Opacity fades with distance so the front stays legible and the back recedes.
- **Front-focus** ("primary focus on the front, proximity"): every frame compute each node's z in camera space; the nearest node gets (a) label opacity 1 + slight upscale, (b) becomes the DoF focus target. Everything behind softly blurs.

## Cinematic post-processing
- `EffectComposer` with:
  - **Bloom** (intensity ~0.6, luminanceThreshold 0.2) — makes the gold core and flowing dots glow.
  - **DepthOfField** (focusDistance driven by front-most node, bokehScale ~2.5) — the "proximity" cinematic feel.
  - **Vignette** (subtle, 0.3) — anchors the frame like a lens.
- ACES tone mapping, linear color space, `dpr={[1, 2]}` for retina without tanking perf.

## Interaction
- **Hover** a node: ring highlight + label boost + tooltip chip (HTML overlay via `<Html>`).
- **Click country orb**: calls existing `onSelectCountry(code)` → same filter behavior as today.
- **Click sector orb**: `onFilter({ sector })` — matches 2D behavior.
- **Zoom control** (+/−): keep the discreet bottom-right control; drives camera dolly (z: 6 → 22) instead of SVG viewBox.
- **Reset view** button (top-right, discreet) restores default camera.

## Performance & accessibility
- Single `InstancedMesh` per node type (countries, sectors, thread-dots) — one draw call each.
- `frameloop="always"` but throttled to 60fps; pause when tab hidden (`document.visibilityState`).
- `prefers-reduced-motion`: freeze orbits + disable bloom/DoF, keep the scene as a static 3D still.
- No-WebGL / SSR: `<ClientOnly>` wrapper renders the existing 2D `BrainConstellation` as fallback.
- Keyboard: Tab cycles focusable nodes (invisible DOM buttons mirrored from the scene), Enter activates.

## Dependencies to add
```
bun add three @react-three/fiber @react-three/drei @react-three/postprocessing postprocessing
bun add -d @types/three
```

## Acceptance
- `/admin/brain` renders a continuously moving 3D constellation: core pulses, country/sector orbs orbit, flowing dots stream along threads.
- Whatever node is nearest the camera is visibly the sharpest and brightest; the rest softly blurs (DoF).
- Hover shows a tooltip; clicking a country filters the view (same as today); +/− zoom still works.
- Reduced-motion users get a static 3D still; no-WebGL users get the current 2D diagram.
- No regression to the surrounding page (stats bar, breadcrumbs, filter state).
