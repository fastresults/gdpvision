## Goal

Keep the marginalia placement exactly as it is, but scale the engraved sketches back up so the cross-hatching and line detail read at normal viewing distance. Right now the width clamps are tuned for "accent" and are losing the artwork.

## What changes

Only `src/components/marketing/Illustration.tsx` (the variant width clamps) plus the two docs that record the numbers. No layout, no section restructuring, no new assets.

### New scale (roughly 1.6–1.8× current)

| Variant | Now | New | Why |
|---|---|---|---|
| `mark` | 72 / 88px | 104 / 128px | chamber-panel corner marks and eyebrow marks currently read as favicons; engraved detail needs ~120px to survive |
| `spot` | 150 / 190px | 232 / 288px | margin-anchored art beside a column — big enough to read the subject, still under half the column |
| `aside` | 300px | 460px (520px at `xl`) | fills the empty half of the existing 2-col grid properly instead of floating small in it |
| `rule` | 520px | 720px | the divider engraving reads as a line at 520; at 720 the hatching is legible |

Also raise render fidelity slightly: `opacity-90 → opacity-95` and keep `contrast-[1.12]`, so mid-greys don't wash into the paper ground at larger sizes.

Aspect ratio stays free (width-only clamps), `grayscale`, `mix-blend-darken`, `select-none pointer-events-none`, lazy loading all unchanged.

### Guardrails that stay intact

- One illustration per section.
- Never full-bleed, never inside the reading column.
- `band` stays retired.
- Alternating margin sides down the page stays.

### Docs to sync

- `docs/illustration-contract.md` — the size table in §4.
- `AGENTS.md` — the cardinal-rule line listing variant maxima.
- `mem://design/illustration-contract` — same numbers.

## Verification

Screenshot the marketing home at 1386px and at 390px via Playwright and check each section: the illustration should be clearly legible as a drawing, still visually subordinate to the headline type, and never crowding the reading column on mobile.
