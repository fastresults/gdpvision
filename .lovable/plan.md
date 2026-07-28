## Problem

The `/business-case` decision paper currently borrows six illustrations from the marketing home page (`section-provenance`, `section-loop`, `section-corpus`, `section-counsel`, `section-sovereignty`, `section-briefing`). They are recognisable from the home page, and none of them are drawn for the argument they sit beside — the filing-cabinet engraving under "A language model is a component" is a corpus image, not a component-vs-system image. The page reads as assembled rather than authored.

## What gets built

Eight brand-new engravings, drawn to the existing Illustration Contract (`docs/illustration-contract.md`): monochrome graphite pen-and-ink, cross-hatching and stipple, white ground, objects not people, no text in the artwork. Same prompt prefix verbatim, so they sit in one family with the homepage set but are entirely unique to this page.

Subject, matched one-to-one to the section it accents:

| Slot | Section | Subject |
|---|---|---|
| `bc-instrument` | Masthead | A precision brass surveying theodolite on a tripod — the instrument itself |
| `bc-cliff` | 01 · What is at stake | A coastal limestone shelf with a sheared edge, survey stakes along the drop |
| `bc-lag` | 02 · The problem | A ship's chronometer in its gimbal case, hands lagging a second dial |
| `bc-component` | 03 · A language model is a component | A single machined gear resting beside a complete escapement movement |
| `bc-ledger-cost` | 04 · The alternative is not free | A brass beam balance, one pan stacked with weights, the other with folded paper |
| `bc-paths` | 06 · Options appraisal | Three engraved roads diverging over a contoured survey plate |
| `bc-seal` | 09 · The five approvals | A wax seal, matrix and ribbon on a folded despatch |
| `bc-briefing-room` | Closing CTA | An empty Cabinet table with blotters and a single closed red box |

Sizes per contract: spots `1024×1024`, the one `rule` divider `1536×512`.

## Placement

Placement is corrected at the same time, not just swapped in:

- One illustration per section, maximum — unchanged.
- Margin side **alternates** down the page (masthead right, 01 left, 02 right, 03 rule under header, 04 left, 06 right, 09 left, closing right) so the eye reads a composition rather than a stack.
- Sections currently rendering an illustration centred in the flow are moved into the empty half of their existing two-column grid, or given a two-column grid where they lack one, so the artwork sits beside the argument and never interrupts the reading column.
- `spot` stays the default; `rule` is used once only, as the divider under the section-03 header.
- No `band`, no full-bleed, no bare `<img>` — everything renders through `<Illustration>`.

## Technical notes

1. Generate the eight images to `/tmp` at contract sizes.
2. Upload each with `lovable-assets create`, commit only the pointer at `src/assets/illustrations/bc-<name>.jpg.asset.json`. No binaries in the repo.
3. Rewrite the six imports in `src/routes/business-case.tsx` to the eight new pointers, and adjust the surrounding grid markup for the alternating placement.
4. The six homepage assets stay exactly as they are — they are still in use on `/` and must not be deleted or edited.
5. Visual QA pass with a full-page capture of `/business-case` at desktop and mobile widths to confirm nothing is oversized, nothing collides with type, and the alternation reads correctly.
