## What's wrong today (from current screenshot)
- Orbs read as flat glowing circles: bloom is too aggressive, emissive dominates every material, and there's no environment/rim lighting to create a shaded side + specular hotspot.
- The constellation is capped to `aspect-square max-h-[820px]`, so big country orbs clip and the scene doesn't fill the viewport.
- Core label reads "SYSTEM"; it should read "GDPVISION".
- Labels are 3D `<Text>` billboards — small, low-contrast, no background — they wash out against orbs and bloom.

## Reference language (from attached knowledge-graph mock)
- Deep black space with a fine, sparse white starfield.
- Every node is a compact **glowing dot with a soft halo** (colored inner core → wide fuzzy bloom), *not* a big matte sphere. Halo hue matches the node's category.
- Connecting threads are thin single-pixel lines tinted to their parent's hue (amber for the focus cluster, violet/pink/mint for others). No thick tubes.
- Labels sit in a **dark rounded pill** with white text and a 1 px border tinted to the parent's hue. Labels only appear on the focused/hovered node and its immediate neighbors — the rest of the graph stays label-free so the constellation breathes.
- The composition is asymmetric and drifting, with a clear focal cluster in the center-front and quieter satellites in the back.

## Fixes

### 1. Real 3D orbs (halo + PBR core, per the reference)
- Add `<Environment preset="night" />` from drei for image-based reflections/specular on every orb.
- Rebuild each node as a **two-layer object**:
  - Inner **core sphere** (radius ~0.14): `meshPhysicalMaterial` with `metalness 0.6`, `roughness 0.25`, `clearcoat 1`, tinted `color` = category hue, low `emissive` (0.2). Gets a real specular highlight from lights + environment → visibly spherical.
  - Outer **halo sprite** (radius ~0.55): drei `<Billboard>` + radial-gradient texture (built once via `CanvasTexture`), additive blend, opacity 0.55, hue = category hue. This is what gives the reference its "glowing dot in space" look.
- Rebalance materials so bloom no longer eats them:
  - `<Bloom intensity={0.55} luminanceThreshold={0.7} luminanceSmoothing={0.4} mipmapBlur />` — bloom now only fires on the emissive core + halo, not on the whole orb surface.
  - Lower DoF `bokehScale` to 1.6.
- Add three explicit lights (warm key upper-right, cool rim lower-left, dim fill behind camera) so every core has a lit side and a shaded side.
- Country orbs: white core + soft blue halo (amber halo when `recent`). Sector orbs: colored core + matching hue halo. Core: unchanged pulsing icosahedron with tighter gold emissive.

### 2. Thin, tinted threads (not tubes)
- Replace `TubeGeometry` with drei `<Line lineWidth={1}>` (uses meshline under the hood — resolution-independent, thin, crisp).
- Line color = parent node's hue; opacity 0.35 baseline, 0.9 when the parent is hovered/selected.
- Flowing dots stay (2–3 per thread, sized 0.03) but travel along the same Bézier curve — kept as visual heartbeat.

### 3. Legible pill labels + interactive show/hide
- Swap 3D `<Text>` billboards for drei `<Html transform sprite>` label pills — real DOM text stays crisp at every zoom level:
  ```
  <span class="pointer-events-none whitespace-nowrap rounded-full bg-black/80 px-2 py-0.5
               text-[11px] font-medium tracking-wide text-white
               ring-1 ring-[color:var(--halo)] shadow-[0_0_12px_rgba(0,0,0,0.6)]">
    {label}
  </span>
  ```
- Show a label only when the node is (a) hovered, (b) selected, (c) the current focus proximity node, or (d) a direct neighbor of a selected node. Everything else stays label-free (matches the reference).
- Always-visible **core** label uses the same pill style with a gold ring, reading **"GDPVISION"**.

### 4. Interactivity — click to pause, click again to resume, click orb to focus
- Add a scene-level `paused` state (managed in `BrainConstellation3D`, dropped into R3F via a context or a prop-drilled ref).
- When paused: `frameloop="demand"` + `OrbitControls autoRotate={false}` + skip per-frame position updates (the whole galaxy freezes cinematically, like a shutter).
- **Click on empty space** (canvas background) → toggle pause/resume.
- **Click on an orb** → set it as the focused node: camera smoothly tweens to face it (drei `CameraControls.setLookAt` or a manual lerp of `camera.position` + `controls.target`), that orb's label pill + neighbor labels appear, everything else dims (halo opacity → 0.25, thread opacity → 0.1). Second click on the same orb clears focus. Click on the country orb *also* still calls `onSelectCountry` (unchanged behavior).
- Small **pill controls** at bottom-right (next to zoom): `Pause | Play`, plus the existing `+ / − 100%` zoom, plus a `Reset` icon. All use dark chrome consistent with the pill labels.
- Keyboard: `Space` toggles pause, `Esc` clears focus (mounted on the canvas wrapper).

### 5. Fill the viewport by default
- Drop `aspect-square max-h-[820px]`. Use `h-[min(78vh,900px)] w-full`.
- Auto-fit camera on mount + on resize: compute bounding sphere of core + all sector + country anchors, place the camera so the sphere fits vertical FOV with 8 % padding. Store that distance as the "100 %" baseline for the zoom control.
- Widen `OrbitControls` polar range so panning around still reveals back-hemisphere countries.

### 6. Starfield (match the reference)
- Keep `StarDust` but drop count to ~500, size 0.02, pure white, no size-attenuation glow — matches the fine dusty starfield in the reference instead of the current blue haze.

## Files
- `src/components/country-data/BrainConstellation3D.tsx` — new halo sprites, `<Line>` threads, HTML pill labels, pause/focus state, auto-fit camera, tuned post-fx, viewport sizing.
- `src/routes/_authenticated/admin/brain.tsx` — `centerLabel` default `"GDPVISION"`.

## Verification
Take a fresh Playwright screenshot of `/admin/brain` at 1280×1800 and confirm:
- Nodes read as **glowing orbs with halos**, each visibly spherical (specular hotspot).
- Labels are crisp dark pills with hue-tinted borders (unmistakably readable), and only the focused cluster shows labels.
- Clicking an orb focuses it (camera glide + labels reveal); clicking empty space pauses/resumes the whole scene.
- Threads are thin colored lines; flowing dots still stream along them.
- Constellation fills the viewport; core reads **GDPVISION**.
