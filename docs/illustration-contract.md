# Illustration contract (global)

One binding house style for every illustration in GDPVision — product UI, marketing
site, and any exported document (Mandate Compact PDF, briefing packs, decks).

**Sole exception:** the marketing hero section, which keeps its existing treatment.

---

## 1. The style

Hand-drawn engraved sketch:

- Graphite pencil / pen-and-ink engraving, as if drawn in a technical sketchbook.
- **Monochrome only.** White ground, grey-to-black line. No colour fills, no gradients,
  no drop shadows, no 3D renders, no flat-vector "corporate" iconography, no photography.
- Fine cross-hatching and stipple shading for volume.
- Subject centred, generous white space, quiet composition.
- Objects and places, not people-as-mascots. No text inside the artwork.

## 2. Prompt template

Use this verbatim prefix when generating a new illustration, then append the subject:

> Hand-drawn pencil and pen-and-ink engraving illustration, monochrome graphite on white
> paper, fine cross-hatching and stipple shading, no colour, no gradients, vintage etching
> sketchbook feel, generous white space, on a solid white background. Subject: `<subject>`,
> `<wide horizontal | centred>` composition.

Sizes: bands `1536×512` (3:1), spots `1024×1024`, panels `1024×768`.

## 3. Where files live

Generate to `/tmp`, upload via `lovable-assets create`, and commit only the pointer:

- Section / page illustrations → `src/assets/illustrations/<name>.jpg.asset.json`
- Chamber illustrations → `src/assets/chambers/chamber-0N.jpg.asset.json`

Never commit the binary.

## 4. How it is rendered

All illustrations render through `<Illustration>` (`src/components/marketing/Illustration.tsx`).
Sections must not place a bare `<img>` for an illustration.

```tsx
import { Illustration } from "@/components/marketing/Illustration";
import corpusIll from "@/assets/illustrations/section-corpus.jpg.asset.json";

<Illustration src={corpusIll.url} variant="band" className="mt-12" />
```

Variants: `band` (3:1 divider between header and content), `spot` (square mark beside a
column), `panel` (4:3 supporting figure).

The component owns: paper ground, forced `grayscale`, `mix-blend-multiply`, lazy loading,
and accessibility. It never introduces a colour token — only `paper-*` / `ink-*` / `line-*`
are legal, per the token contract in `AGENTS.md`.

## 5. Accessibility

- Decorative illustration → omit `alt`; the component sets `alt=""` and `aria-hidden`.
- Meaningful illustration → pass a real `alt` describing what it conveys.

## 6. Do / don't

| Do | Don't |
| --- | --- |
| Engraved graphite sketch on white | Colour, gradients, glassmorphism, 3D |
| Objects, instruments, rooms, charts, landscapes | Stock-photo people, emoji, cartoon mascots |
| One idea per illustration | Busy collages |
| `<Illustration>` | Bare `<img>` or CSS background for an illustration |
| Generate at the sizes above | Upscaled or stretched art |

## 7. Print / exported documents

PDF and deck generators use the same assets and the same rules: monochrome engraved
sketch, generous margins, no colour. If an exporter cannot use the `<Illustration>`
component, it must still pull from `src/assets/illustrations/` and render greyscale.
