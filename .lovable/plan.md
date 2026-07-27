## Part 1 — The illustration contract (global rule)

Define one binding house style for every illustration in the product and in print/PDF output. Derived from the uploaded references: hand-drawn graphite / pen-and-ink engraving, monochrome, white ground, fine cross-hatch and stipple shading, no colour fills, no gradients, no 3D, no flat-vector "corporate" iconography, subject centred with generous white space.

**Where it is written down (so it binds future work):**
1. `docs/illustration-contract.md` — the canonical spec: subject matter rules, rendering rules, prompt template, sizing, alt-text rules, do/don't list.
2. A Core line added to project memory (`mem://index.md`) plus a detail memory `mem://design/illustration-contract`, so every future session applies it without being asked.
3. A short pointer section in `AGENTS.md` §1 Cardinal rules.

**The rule itself:**
- Every illustration in front-facing UI/UX and in any exported document (Mandate Compact PDF, briefing packs, decks) uses the engraved-sketch style.
- Illustrations render monochrome and are tinted only through the existing ink/paper tokens — never introduce new colour.
- Sole exception: the website hero section, which keeps its current photographic treatment.
- Illustrations are decorative unless they carry meaning; decorative ones get `alt=""` + `aria-hidden`, meaningful ones get a real description.
- New illustrations are generated from the shared prompt template in the contract doc, stored under `src/assets/illustrations/`, and referenced via the assets pointer pattern already used for the chamber images.

**Enforcement in code:** a single `<Illustration>` component (`src/components/marketing/Illustration.tsx`) that all sections use. It owns the frame, the paper background, the mix-blend/`sepia`-free monochrome treatment, sizing variants (`spot` / `band` / `panel`), lazy loading, and the alt/aria handling. Sections do not place bare `<img>` tags — the contract is enforced by the component, and the docs state that.

## Part 2 — Illustrating the public sections

Generate a set of new engraved-sketch illustrations and place one per section of the public site (`MarketingHome`), plus the auth and invite pages.

| Section | Illustration concept |
|---|---|
| `#problem` (threats carousel) | A small spot mark per threat theme; one shared "storm over a harbour" band behind the carousel frame |
| `#corpus` | Sketched cabinet of stacked, indexed folios with a lamp — study/archive |
| `#loop` (Rehearse/Decide/Track/Score) | Four numbered spot sketches, one per step |
| `#instrument` (chambers) | Featured chambers 04/08 keep their photographs; the six grid chambers move to sketch spots so the band reads as hierarchy |
| `#counsel` | Two chairs and a table, counsel-in-session |
| `#sovereignty` | A sealed strongbox / key motif for the five panels (one spot on the lead panel) |
| `#provenance` | Regional chart-and-dividers sketch |
| `#briefing` | Sealed envelope and pen beside the form |
| `/auth`, `/auth/invite` | One quiet lamp spot to carry the same register |

Hero stays exactly as it is.

**Chamber imagery:** the eight existing `chamber-0N.jpg` photographs are off-contract. Plan is to regenerate all eight in the sketch style so the grid is consistent, keeping the same filenames/pointers so nothing else changes. If you would rather leave the chamber photographs alone, say so and I will scope the sketches to the non-chamber sections only.

### Technical notes
- Images generated at 1024px-ish, saved as `.png`/`.jpg` under `src/assets/illustrations/`, imported through the existing asset-pointer JSON convention.
- No new colour tokens; `Illustration` uses `paper-0`/`line-200`/`ink-*` only, per the button/token contract.
- `MarketingHome.tsx`, `ChamberPanel.tsx`, `BriefingForm.tsx`, `routes/auth.tsx`, `routes/auth.invite.tsx` are the edited files; copy is untouched.
- Verify with lint, typecheck, `bun run check:maps`, and a rendered pass over the page at desktop and mobile widths.
