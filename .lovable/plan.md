# Counsel section: a compact, balanced composition

## What needs changing
The three benefits and illustration currently share the right column. Stacking the illustration below them makes that column much taller than the introduction, leaving a large empty area beneath the headline and explanation.

## Recommended layout
- Place the existing headline, explanation and three benefits together on the left, using approximately 60% of the desktop content width.
- Arrange the benefits as three compact, unframed columns beneath the explanation, separated from it by one subtle horizontal rule. Keep their headings and descriptions unchanged.
- Give the new “Evidence to Answer” engraving its own right-hand column, vertically centred against the complete text group—not positioned below the benefits.
- Increase the engraving from its current 288px desktop slot to an approximately 360–400px slot, within the existing illustration size limits. Preserve the entire artwork and its proportions.
- Reduce desktop space above and below the section from 96px to approximately 64px. Retain comfortable breathing room rather than introducing a fixed section height.

## Smaller screens
- Stack the introduction, benefits and artwork in that order.
- Stack the benefits when three columns would become cramped.
- Keep the artwork smaller and right-aligned on phones so it remains a companion to the text, not a large empty block.

## Scope and technical details
- Change only the Counsel section in `MarketingHome.tsx`.
- Continue rendering the existing asset through `Illustration`, using its `aside` variant with a narrower width constraint.
- Preserve all copy, the engraving, surrounding sections and existing design tokens. No new content, animation or data changes.

## Verification
- Check desktop, tablet and phone layouts for balanced spacing, readable benefits and fully visible artwork.
- Confirm the illustration no longer creates a tall right column with empty space beneath the introduction.
- Check for overlap, horizontal overflow and preview errors. Publishing is not included.