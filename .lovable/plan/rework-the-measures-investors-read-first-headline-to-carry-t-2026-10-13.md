# Rework the "Measures investors read first" headline to carry the direct-connection ethos

## What changes

One copy edit in `src/components/marketing/IndexBand.tsx` (the headline block only — cards, layout, and disclaimer untouched).

Current headline:

> Ten bodies set the standard measures that rank a country for investors and lenders. GDPVision tracks them and shows which decisions move them.

New headline (two sentences, same slot, same type size):

> Ten bodies set the standard measures that rank a country for investors and lenders. GDPVision connects directly to those indexes and data sets — a near-live interface where evidence combines into decisions, policy, investment and management: the environment for GDP growth.

Optional supporting line directly under the headline (small text, replaces nothing):

> The connections run both ways: measures come in as they are published, and the decisions that move them go out to Cabinet, ministries and investors.

## Why this shape

- Keeps the opening sentence the user called good, untouched.
- Sentence two now names the mechanism (direct connections to indexes and data sets), the quality (near-live interface and integration), and the outcomes (decisions, policy, investment, management) ending on the GDP-growth environment.
- One edit, one file; nothing else on the page moves.

## Verification

- Fresh browser load of the homepage `#measures` section at desktop and phone widths: new headline renders, wraps cleanly within the existing `max-w-3xl` block, and the arrows/cards below are unchanged.
- Build log clean.
