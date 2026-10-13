# Keep the "Country value estimate" copy vertically centred

## What you'll see
The heading block on the left ("Country value estimate / See what each Chamber could deliver…") always sits at the vertical middle of the charcoal panel. This holds while the country picker column on the right grows or shrinks: loading, a different country, a longer total, or a narrower screen.

## Why it's off now
The two columns line up on their bottom edges. When the new combined-value line was added under the picker, the right column got taller, so the left copy now sits low instead of centred.

## Approach
- Change the two-column row so both columns centre on each other, not line up at the bottom. The panel's height is set by whichever column is taller, and the other column always centres within it, so no fixed heights are needed.
- Keep the panel's top and bottom padding equal so the centred content also sits in the middle of the charcoal box itself.
- On phones the columns still stack (copy, then picker) with no change.

## Technical details
- `src/components/marketing/MarketingHome.tsx`, around line 421: replace `md:items-end` with `md:items-center` on the grid.
- Leave the padding as it is (`py-6 sm:py-8`, already equal top and bottom); the 3px gold rule is drawn on top, so it doesn't affect centring.

## Verification
- Use the browser to measure the left block's middle against the panel's middle at 1280 and 834 widths, for both the loading and loaded states (difference of 2px or less), and check the 390 stacked layout.
- Confirm the build is clean.
