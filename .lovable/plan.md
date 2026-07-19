## Intent

Elevate the masked Second Brain scene inside the hero ring from a static-feeling constellation into a *living cognitive field*: more nodes, richer link geometry, always-visible motion, and clearer visual hierarchy — while staying strictly decorative and respecting `prefers-reduced-motion`.

Scope is `src/components/marketing/BrainMask.tsx` only. Ring, label, and layout stay untouched.

## What's wrong today

- Only 18 nodes, 4 links → reads sparse and static.
- All motion depends on the 120s outer rotation, which is imperceptible frame-to-frame.
- Links are dashed hairlines that barely register; no traveling signal.
- Nodes are same-size dots — no hierarchy between "hubs" and "leaves".
- No center anchor tying the label to the field.

## What the new scene looks like

**1. Three-tier node system (~34 nodes)**
- **Core hubs (4)**: 3.5px, saturated sector hue, thick 8px halo ring, always heartbeat-pulsing on staggered offsets. These read as "ministries".
- **Mid nodes (12)**: 2.2px, sector-hued, thin halo. 4 of these gain a slower secondary pulse.
- **Leaf nodes (18)**: 1.2px, low-opacity dots scattered on outer orbits. Read as "memory fragments".

**2. Live link fabric (7 curved chords)**
- Chords now connect only **hub↔mid** pairs (never leaf↔leaf) — this creates a legible neural topology instead of random noise.
- Each chord gets a **traveling signal packet**: a 2px sector-hued dot animated along the path via SVG `<animateMotion>` on `<mpath>`, 4–7s duration, staggered starts. This is the single biggest movement upgrade — the eye always catches a packet mid-flight.
- Chord stroke itself uses a subtle dash-march (stroke-dashoffset animation, 8s) so the line feels alive even between packets.
- Link opacity breathes 0.25 ↔ 0.65 on a 5s cycle.

**3. Center anchor**
- A single "core" node behind the "The Second Brain" label: 5px filled dot with a triple-ring pulsing halo (3 concentric circles expanding and fading on a 4s cycle, staggered 1.3s apart). Reads as the corpus itself breathing.
- 4 of the 7 chords originate from this center — creating an obvious "everything connects back" hub-and-spoke motif under the label.

**4. Orbit rings**
- Keep the 3 dashed orbit guides but reduce to 0.3px and add a very slow counter-rotation (opposite direction to the scene rotation) so the guides visibly drift relative to the nodes.

**5. Scene rotation**
- Slow overall rotation from 120s → **80s**, still ambient but now perceptibly moving over a 3–4s dwell.

## Motion budget (all pausable via `prefers-reduced-motion`)

| Layer | Duration | Notes |
|---|---|---|
| Scene rotate | 80s linear ∞ | outer group |
| Orbit counter-rotate | 140s linear ∞ | reverse direction |
| Core-hub heartbeat (×4) | 3.2s ease ∞ | staggered 800ms |
| Mid-node secondary pulse (×4) | 4.8s ease ∞ | staggered 1.2s |
| Chord dash-march (×7) | 8s linear ∞ | staggered 600ms |
| Chord opacity breathe (×7) | 5s ease ∞ | staggered 700ms |
| Signal packets (×7) | 4–7s linear ∞ | one per chord, `<animateMotion>` |
| Center triple-halo (×3 rings) | 4s ease ∞ | staggered 1.3s |

Total DOM additions: ~40 elements. Still cheap; all CSS/SMIL transforms, no JS ticks.

## Craft & accessibility

- Deterministic seeded layout preserved — same visual identity across renders and SSR.
- `aria-hidden="true"` retained; sr-only sector table already covers the ring semantics.
- Center label z-order unchanged: it sits **above** the brain layer, so the pulsing center halo reads *behind* the text without ever competing with it.
- Radial vignette (70%→100% fade) preserved so nothing clips the ring's inner hairline.
- Under `prefers-reduced-motion`: all `animation`/`<animateMotion>` disabled, packets rendered at their midpoints as static dots — the field still looks composed, just frozen.

## Files touched

- **Edit** `src/components/marketing/BrainMask.tsx` — expand `buildScene` to produce hubs/mids/leaves + hub-anchored chord graph + per-chord packet paths; add center anchor group; add counter-rotating orbit group; extend `<style>` block.
- No other files touched. No new imports, no new deps.
