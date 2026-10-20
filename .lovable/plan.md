# Sextant radar on each index card

## Recommendation
Give each of the four index cards a small radar chart. Its four spokes are the four parts that make up the Sextant score:
- **Availability**: how many inputs have a value
- **Timeliness**: how recent they are
- **Grade quality**: the mix of A to D grades
- **Source health**: how many sources answered

Each spoke runs from 0 at the centre to 100 at the edge. The filled shape shows at a glance which part is pulling the score down. The fill colour comes from the overall median Sextant on a continuous scale:

```text
0 deep red -> 40 red -> 60 amber -> 80 green -> 100 deep green
```

This fits the cards better than plotting the pillars, because the colour then measures the same thing as the shape. Pillar scores stay in the planned league-table and heatmap views.

## What the user sees
- The radar replaces the plain "Sextant 70 median" number, with the number shown in the centre and the band name under it (clear, fair, hazy or obscured).
- There are faint rings at 40, 60 and 80, the same edges as the bands.
- Hovering a spoke shows its name, its value and what it measures.
- If no states are scored yet, the card shows an empty grey radar marked "No Sextant yet", never a red 0.
- The colour is never the only signal: the number and band name are always shown.

## Technical details
- `getIndicesOverview` (review.functions.ts): for each index, add the median of each `sextant_parts` value across the scored rows of the latest complete run, next to `median_sextant`.
- New `src/components/indices/admin/SextantRadar.tsx`: a 4-axis SVG with no new library, in the same style as `SignalRadarScope`.
- New pure helper `sextantHue(score)`: an OKLCH blend between the `signal-negative`, `signal-caution` and `signal-positive` tokens, darkened at both ends. Tests in `sextant-hue.test.ts` cover 0 as deep red, 50 as amber, 100 as deep green, and clamping below 0 and above 100.
- `OverviewTab.tsx`: use the radar in place of the Sextant stat. Add an `<Explain id="indices.sextant">` entry for the meaning of the score.
