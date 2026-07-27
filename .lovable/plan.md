## What's wrong today

Audit of every placement made in the last pass:

| Where | Current treatment | Problem |
|---|---|---|
| `#moment`, `#corpus`, `#loop`, `#counsel`, `#provenance` | `variant="band"` = `w-full aspect-[3/1]` inside a 1280px container → a ~1280×427px image block | Five near-identical full-width slabs sitting in the main reading column. They interrupt the text rhythm, out-weigh the type, and repeat as a pattern down the page. |
| `#counsel` | Section is *only* a header + a full-width band | The illustration has become the content. |
| `#sovereignty`, `#briefing` | `variant="spot"` at 220px square, stacked under the text | Better, but still a centred block in the flow, and 220px is heavier than a "spot". |
| `/auth` sign-in | 220px spot under the form column | Competes with the primary action. |
| Chamber cards (`ChamberPanel`) | bare `<img>` at `aspect-[3/1] object-cover` as a card header | Cropped, heavy, bypasses the `<Illustration>` contract, and eight of them at once reads as stock art. |

The style is right; the **scale, count, and position** are wrong. Award-winning editorial pages (Pentagram, Zuzunaga, FT Alphaville-class) use engraved marks as *marginalia* — small, off-axis, aligned to a rule or an eyebrow — never as a repeating full-bleed slab.

## The corrected system

Rewrite `Illustration.tsx` around a proper scale with hard maximum sizes, and retire `band` as the default.

```text
mark    28–40px   inline beside an eyebrow / step number
spot    96–140px  margin-anchored beside a column, never centred in flow
aside   max 260px sits in the empty half of an existing 2-col grid
rule    max 560px wide, aspect 6:1, opacity 80, used ONCE as a section divider
```

Additional contract rules baked into the component:
- default variant becomes `spot`, not `band`
- every illustration renders at `opacity-[.85]` with `select-none pointer-events-none`
- `aside`/`spot` get `md:` positioning helpers so they sit in the outer margin, not the text column
- one illustration maximum per section — the component itself can't stop that, so the rule goes into `docs/illustration-contract.md` and `AGENTS.md`

## Placement, section by section

- **`#moment`** — remove the band entirely. Instead a `mark` sits next to the "The moment" eyebrow. The three NumberTiles stay the visual hero.
- **`#corpus`** — convert the section to a two-column grid (`md:grid-cols-[1.3fr_1fr]`): copy + the public/private list on the left, one `aside` illustration bottom-aligned in the right margin. No slab.
- **`#loop`** — the four loop steps already form a 4-up grid. Drop the band; place a `mark` above each step number? No — one `spot` right-aligned above the grid, aligned to the container's right edge, so it reads as a plate reference rather than a banner.
- **`#counsel`** — this section is too thin to carry an image alone. Restructure into `md:grid-cols-[1fr_0.8fr]`: the Counsel copy plus three short capability lines on the left (voice-first / two-to-four sentences / cited), the illustration as an `aside` on the right. The section gains substance and the image stops being the content.
- **`#sovereignty`** — keep it in the left column but drop to `spot` (≤140px), top-aligned beside the eyebrow rather than stacked below the lede.
- **`#provenance`** — replace band with a single `rule` divider under the section header, max 560px, left-aligned to the text measure.
- **`#briefing`** — drop to `spot`, moved to sit under the mono spec lines and above the paragraph, so the form column stays the clear focal point.
- **`/auth`** — `mark` beside the wordmark instead of a 220px block under the form.
- **`ChamberPanel`** — stop cropping to a 3:1 header. Move the chamber sketch to a small `spot` floated to the panel's top-right at ~88px, `object-contain`, behind the title block at low opacity. Routed through `<Illustration>` so the contract holds. Eight small marks read as a considered set; eight banners read as clip art.

## Layout improvements that come with it

- Reclaiming ~2,000px of vertical slab tightens the page considerably; section padding stays as-is so the rhythm improves rather than compresses.
- Two thin sections (`#counsel`, `#corpus`) become proper two-column compositions, which is what removes the "header + picture" monotony.
- Alternating the margin side (right, left, right) down the page creates a slow visual zig-zag instead of a stack of centred rectangles.

## Technical notes

- `src/components/marketing/Illustration.tsx` — new variant map, new defaults, max-width clamps, opacity/no-select.
- `src/components/marketing/MarketingHome.tsx` — placements above; two sections restructured to grids.
- `src/components/marketing/ChamberPanel.tsx` — replace the bare `<img>` header with a contract-compliant corner spot.
- `src/routes/auth.tsx` — spot → mark.
- `docs/illustration-contract.md` + `AGENTS.md` + project memory — add the scale table and the "one per section, never in the reading column, never full-width" rules so this doesn't regress.
- Verified afterwards with a Playwright capture of the marketing page at 1280 and 390 wide.

No copy, data, or backend changes.
