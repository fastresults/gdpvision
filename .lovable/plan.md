# Bring the Second Brain to life

Right now the constellation only animates the flowing dots along threads — the orbs, core, and background are static, which makes the whole diagram read as a still illustration. I'll layer several subtle, continuous motions so it breathes like a living system without becoming noisy.

## Scope
Single file: `src/components/country-data/BrainConstellation.tsx`. Pure SVG/CSS animation — no data or logic changes.

## Motion layers to add

1. **Core "SYSTEM" node — heartbeat**
   - Soft dual-ring pulse (2 concentric circles) expanding and fading every ~2.5s.
   - Gentle scale breath (1.00 → 1.04 → 1.00) on the core disk.
   - Slow rotating conic/gradient halo underneath (20s loop) so the center always feels alive.

2. **Country orbs — breathing + halo**
   - Each orb gets a slow scale breath (~3–4s) with a randomized phase per country so they don't pulse in unison.
   - Faint radial glow ring behind each orb that expands/fades on the same offset.
   - Orbs with recent activity (last 24h) get a brighter amber halo pulse at a faster cadence.

3. **Sector orbs — shimmer**
   - Subtle opacity shimmer (0.85 → 1 → 0.85) on the stroke, staggered by index.
   - Recent-activity sectors (already amber) get a stronger pulse ring matching the country pattern.

4. **Threads — living lines**
   - Very subtle stroke-opacity oscillation on all threads (0.35 → 0.55) so the web feels like it's inhaling.
   - Keep existing flowing dots; slightly randomize dot speeds per thread for a more organic feel.

5. **Ambient starfield (background)**
   - 30–40 tiny static-position dots twinkling (opacity 0.1 → 0.4) at random intervals inside the viewbox, behind everything.
   - Adds depth without competing with data.

6. **Respect user preferences & performance**
   - Wrap all new animations in a `@media (prefers-reduced-motion: reduce)` guard that disables breath/pulse/shimmer (keeps the diagram fully readable).
   - All animation is CSS keyframes on SVG attributes/transforms — no JS timers, no re-renders. Zoom control continues to work unchanged.

## Technical notes
- Add a `<style>` block scoped inside the SVG with keyframes: `pulse-ring`, `breath`, `shimmer`, `twinkle`, `halo-spin`.
- Use `transform-box: fill-box; transform-origin: center` on animated `<circle>` elements so scale breathes from each orb's own center.
- Stagger via inline `style={{ animationDelay: `${(i % 7) * 0.35}s` }}` per orb — cheap and deterministic.
- No new dependencies.

## Out of scope
- No changes to zoom control, labels, filtering, tooltips, or data flow.
- No changes to other diagrams or routes.
