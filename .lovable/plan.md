## Intent

The `SignatureRing` in the hero has ~34% of its diameter as untouched negative space in the middle. Right now that void reads as decorative. We turn it into the *product's own thesis in motion*: a miniature, live-feeling Second Brain constellation orbiting behind the ring — masked precisely to the ring's inner circle so it never bleeds over the sector segments.

The effect: the National Signature becomes a **window** into the sovereign corpus. The eye lands on the ring, then discovers movement inside it — nodes pulsing, faint links breathing, a soft center label ("Second Brain"). Signature outside, intelligence inside.

## Design principles (hero-designer POV)

1. **Ring stays sovereign.** Sector segments remain the loudest layer. The inner scene sits behind them at ~55–70% opacity, softly vignetted at its edge so it fades before touching the inner hairline guide.
2. **Masked, not overlaid.** The constellation is clipped to a circle of radius `inner - 10px` (matches the existing inner concentric guide). Nothing escapes the void.
3. **Ambient, not busy.** 14–18 nodes max, 3 gentle "thought" arcs, one slow rotation (~90s/turn), heartbeat pulses on ~3 nodes. Respect `prefers-reduced-motion` → static composed frame.
4. **No auth, no data fetch, no citations.** This is a *marketing lyric*, not the real corpus. Deterministic seeded layout so it looks identical across renders.
5. **Center label.** Two lines of mono microtype at true center: `THE SECOND BRAIN` / `— sovereign corpus —`. Fades in after the ring assembles.

## Build

**New:** `src/components/marketing/BrainMask.tsx`
- Pure SVG, no data deps. Renders inside its own `<svg>` sized to the ring's inner diameter.
- Uses `CANONICAL_SECTORS` colors for node hues (ties visually to the ring above).
- Seeded PRNG places ~16 nodes on 3 concentric orbits. Each node: 2–3px dot, sector-hue fill, `--line-300` hairline halo.
- 3 curved chord links between random node pairs, stroked at 0.5px `--line-300`, animated `stroke-dashoffset` breathing.
- 3 selected nodes get a `@keyframes` heartbeat (scale + opacity), staggered.
- Whole scene wrapped in a `<g>` with a very slow CSS `rotate` (90s linear infinite), disabled under `prefers-reduced-motion`.
- Radial mask `<radialGradient>` fades the outer 15% of the disk to transparent so the scene dissolves before the ring's inner edge.

**Edit:** `src/components/marketing/SignatureRing.tsx`
- Add optional prop `showBrain?: boolean` (default true on hero usage).
- Insert `<BrainMask size={inner * 2 - 20} />` positioned absolutely at true center, `z-index: 0`, behind the SVG (which stays `z-index: 1` — the segments naturally have transparent centers).
- Add a centered `<div>` with the two-line mono label (`text-[10px] uppercase tracking-[0.22em] text-ink-500`), fades in via the same `assembled` state (delay ~800ms after last segment).
- The existing `sr-only` table stays unchanged; add one more `<caption>`-adjacent sentence noting the inner scene is decorative.

**No changes** to `MarketingHome.tsx`, `BrainConstellation.tsx`, routing, or data layer.

## Motion budget

- Ring assemble: unchanged (existing staggered opacity, ~720ms total).
- Brain scene fade-in: 600ms, starts at +400ms after ring completes.
- Rotation: 90s linear infinite, `will-change: transform`.
- Heartbeats: 3s ease-in-out, 3 nodes staggered by 900ms.
- Link breathing: 6s ease-in-out on `stroke-dashoffset`.
- All motion gated by `prefers-reduced-motion` → static frame.

## Accessibility

- `<BrainMask>` marked `aria-hidden="true"` — it's decorative; the sr-only sector table already describes the signature.
- Center label is real text, screen-reader visible, contributes semantic meaning ("The Second Brain — sovereign corpus").

## What this does NOT do

- Does not fetch, embed, or preview any real country's corpus (auth-gated, wrong audience surface).
- Does not add interactivity — no hover, no click. Hero must remain a scannable statement, not a toy.
- Does not touch the authenticated `BrainConstellation` component.
