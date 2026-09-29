# Business Case hero: Corpus ring of ten Chambers, "Elevating GDP"

Replace the theodolite engraving in the Business Case hero (right column, ~320px wide) with a hand-built animated diagram in the same size and position.

## Art direction: "The Assembled Instrument"

A single engraved-looking object, not a tech graphic. Graphite fine lines on paper, one gold accent. It should feel like a precision instrument being assembled, matching the /record animations.

```text
          [01]  [02]
      [10]   ____   [03]
     [09]   ( CORPUS )  [04]
      [08]   ‾‾‾‾   [05]
          [07]  [06]
        ── Elevating GDP ──
```

- **Centre, the Corpus:** a round core drawn with hatched concentric rings and small cited fragments (tiny dots) drifting inward and settling. A soft slow "breath" pulse keeps it alive.
- **Ring, the ten Chambers:** ten interlocking arc-shaped puzzle pieces (annular segments with a tab and a notch on each side) forming a full ring around the Corpus. Each piece has a fine hatch fill and its number (01–10) in small mono type.
- **Sequence (about 6 seconds, runs once when the hero first appears):**
  1. The Corpus draws itself in (line-draw), and fragments flow into it.
  2. The pieces fly in one at a time from slightly outside the ring, rotating a few degrees and clicking into place clockwise from 01. Each click gives off a small gold hairline flash.
  3. When 10 locks in, a thin gold line rises from the Corpus through the top of the ring (a restrained upward trajectory), and the caption fades in.
- **Settled state:** the ring turns very slowly (about 90 seconds per full turn), the core keeps pulsing, and one piece at a time faintly lights in gold.
- **Caption below:** "ELEVATING GDP" in small uppercase mono with gold hairlines on either side. Beneath it, a tiny qualifier: "Ten Chambers. One national corpus." (No figures, and no claim of guaranteed growth.)

## Interaction

- On hover or focus, a piece lifts slightly, the other pieces dim, and a small label shows the Chamber number, title and outcome line (taken from the existing Chambers list). The piece links to the matching Chamber on the homepage.
- Hovering the core shows "The Corpus: graded, cited national evidence."
- Reduced-motion users see the fully assembled ring without movement.

## Placement and responsiveness

- Same slot as the current illustration: right column, desktop only, about 320px square plus the caption. The column grows slightly to about 360px so labels stay readable.
- Hidden on phones, as the illustration is today, so the layout does not change there.
- The theodolite image stays in the project, unused, in case you want it back.

## Technical details

- New `src/components/marketing/CorpusChamberRing.tsx`: pure SVG with puzzle segments computed from polar geometry (10 × 36°, with a tab/notch on the radial edges). The animation uses CSS keyframes with staggered `animation-delay` and is triggered by an in-view observer (reusing the existing in-view utility from the /record visuals).
- Titles and outcomes come from `CHAMBERS` in `src/lib/chambers.ts`.
- Uses only the paper, ink, line and gold tokens. Keyframes go in `src/styles.css` with a `prefers-reduced-motion` override.
- Replaces lines 147–149 of `src/routes/business-case.tsx` and widens the grid column to 360px.
- Verify the entry sequence, the settled state, hover/focus labels, reduced motion and the desktop fit with Playwright.
