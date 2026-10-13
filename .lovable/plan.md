# Drop the small engraving from the corner of each chamber card

## What changes on the page

Each of the ten homepage chamber cards currently shows a small hand-drawn engraving in the top-right corner, to the right of the "Chamber 01" … "Chamber 10" heading (a barge and crane for 04, a broadcast microphone for 05, a boardroom for 06, and so on).

Those ten drawings are removed. Each card then opens with just the coloured 4px rule and the chamber number, and the rest of the card — the product screenshot, the value estimate, the outcome line, the title, the purpose and the bullets — is unchanged and keeps its current width and spacing.

Nothing else moves: the cards stay three across in order 01 to 10, and because the number already sits at the left of its row, removing the drawing leaves no empty gap — the row simply becomes shorter.

The same drawings stay in use where they already appear elsewhere (the admin chamber pages), so no artwork is deleted from the site.

## How it is built

One file changes: `src/components/marketing/ChamberPanel.tsx`.

1. Delete the header drawing — the `{image ? <Illustration src={image} variant="mark" … /> : null}` block at lines 83-89, which is the only thing rendered to the right of the chamber number.
2. Remove the now-unused `Illustration` import (line 3) and the `image` entry from the component's destructured props (line 32). The optional `image?: string` field stays in the props interface, because the card list in `src/lib/chambers.ts` still supplies it and the card is rendered with a spread.
3. No layout edits are needed: the header row at line 66 already aligns its single remaining child to the left, and the screenshot below keeps its existing top margin.

`MarketingHome.tsx` is the only place this card is used, so no other page is affected, and no data, styles or assets change.

## Verification

- Load the homepage and confirm no drawing element remains inside any card's header row, on all ten cards.
- Confirm the headings still read Chamber 01 to Chamber 10, all cards keep one shared width, and the cards no longer carry the extra header height.
- Check there is no horizontal overflow at desktop, tablet and phone widths.
- Confirm the latest build result is clean.
