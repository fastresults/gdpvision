# Country-specific Chamber value estimates on the homepage

## Recommendation

Add a compact **“Estimate for” country selector** above the Chamber grid. Each Chamber card will then show its **estimated year-three economic contribution** for that country, using the same public records, reference assumptions, adoption levels, ceiling, and central case already used by the Decision Brief.

This is stronger than publishing fixed numbers: the values remain relevant to the selected economy, are visibly qualified as estimates, and can be traced back to the existing model.

## Experience

1. Place the country selector directly beneath the Chambers section introduction and above the featured Chamber cards.
2. Default to the same country currently used by the public Decision Brief, then load the selected country’s supported public facts.
3. Add a restrained value line immediately below each Chamber image:
   - `ESTIMATED VALUE · YEAR THREE`
   - `US$8.2 m ⓘ`
   - a short status such as `Proposed: embedded` or `Not yet included`
4. Hovering or focusing the value opens the existing concise explanation.
5. Clicking or tapping opens the existing full derivation modal, showing:
   - what value pool the Chamber addresses;
   - the recoverable share;
   - the proposed adoption level;
   - the central-case multiplier;
   - the final year-three contribution after the national ceiling.
6. Add one clear action inside that modal: **“Open this country’s Decision Brief →”**.
7. The action opens the Decision Brief with the selected country and the exact homepage configuration encoded in the URL, so the Chamber figure matches what the visitor sees there.
8. Changing the country updates all ten figures together without moving or resizing the cards. While data loads, preserve the space with a quiet loading state; if records are unavailable, show a clearly labeled reference estimate rather than a blank or misleading zero.

## Credibility rules

- Always call the number an **estimate**, never a forecast or guaranteed return.
- Use the existing 1.2%-of-GDP ceiling and existing Chamber coefficients without modification.
- Distinguish national-record inputs from reference assumptions in the explanation.
- Use the Decision Brief’s evidence-informed proposed adoption sequence. If a Chamber is at zero adoption, display **“Not yet included”** rather than implying it has no economic value.
- Keep the selected country visible beside the figures so no value appears context-free.
- Do not create a second calculator or duplicate coefficients in homepage code.

## Technical implementation

- Extract the existing country-facts-to-proposed-input logic from `ValueCalculator` into a shared client-safe calculator helper, so the homepage and Decision Brief cannot drift.
- Reuse `getBriefCountries`, `getCountryFacts`, `computeValue`, `encodeBrief`, and the registered `calc.chamber.*` explanations.
- Extend the explanation modal with an optional action destination; existing explanation uses remain unchanged.
- Pass each Chamber’s calculated contribution and adoption label into `ChamberPanel` through a small focused value-estimate presentation.
- Use TanStack `Link` with typed search parameters for `/business-case/brief`.
- Preserve the current image zoom, card proportions, mobile stacking, typography, and Chamber accent colors.

## Verification

- Confirm all ten cards update after changing countries.
- Confirm each visible value equals the matching Chamber value in the opened Decision Brief.
- Test explanation hover/focus, modal opening, and the Decision Brief action on desktop.
- Test selector, tap-to-open modal, close behavior, and no sideways overflow on mobile.
- Test loading, unavailable-country-data, reference-assumption, and zero-adoption states.
- Run focused type, lint, build, and browser checks without changing the value model.
