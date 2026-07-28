## Goal

In the Country Console header, the country chip beside the GDPVISION wordmark becomes a clickable switcher. A super admin clicks it and gets a searchable list of every onboarded country, with flags, and jumps straight into that country's Executive Brief.

## Behaviour

- **Super admin**: the chip shows a small chevron and opens a dropdown panel listing all onboarded countries (same source the `/home` flag gallery uses), each row with flag, ISO code and name. A type-to-filter field sits at the top; the current country is marked. Selecting a country switches the view-as target and navigates to `/console/{CODE}` (the Executive Brief). A footer row keeps "← All countries" as an escape hatch to `/home`.
- **Country user with more than one country binding**: same panel, but limited to the countries they are bound to.
- **Country user with a single binding**: chip stays exactly as today — plain, non-interactive, no chevron. No new affordance where there is nothing to switch to.

## Interaction detail

- Keyboard: Enter/Space opens, arrow keys move, Enter selects, Escape closes; focus returns to the chip.
- Panel is anchored under the chip, capped in height with internal scroll, and closes on outside click or route change.
- Mobile: the same panel, full width under the header so rows are comfortably tappable.
- The wordmark keeps its own separate link (Brief / home); clicking the chip must no longer trigger the wordmark's navigation.

## Visual language

Follows the existing paper/ink system — mono uppercase micro-labels, hairline `line-200` borders, `paper-0` surface, gold focus ring. No new colours. Rows use the same flag treatment as the masthead.

## Technical notes

- Split the header link in `src/routes/_authenticated/console.tsx`: wordmark stays a `Link`, chip becomes a sibling switcher (fixes the current nested-interactive markup).
- New `src/components/console/CountrySwitcher.tsx` wrapping the existing `CountryChip` as its trigger; `CountryChip` itself stays presentational.
- Country list: `listOnboardingCountries()` for super admins (already query-cached under `["onboarding","countries"]`), `getMyCountryStatus().bindings` for country users. Fetch on first open so the console shell stays light.
- Switching calls `useImpersonation().enter(code)` for super admins before navigating, so the rest of the app agrees on which country is in view.
- Frontend only — no schema, RLS, or server-function changes.
