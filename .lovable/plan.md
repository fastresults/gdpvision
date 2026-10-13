# Country picker: big name when closed, normal list when open

## What you'll see

- The closed control keeps the enlarged serif country name (Saint Lucia at 38px).
- The open list of countries goes back to normal, comfortable reading size (about 15px), scrollable, in the brand's own styling, with a check mark on the country you're on.

## Why the list is oversized now

The control is a plain browser dropdown. Its own text was raised to 38px, and the browser copies that size into every row of the open list. Browsers do not let a plain dropdown use one size for the closed control and a different size for the open list — Safari ignores row sizing completely.

## Recommended approach

Swap the plain dropdown for the styled dropdown component already sitting in this app (Radix Select, installed but not yet used anywhere). It keeps the closed control and the open panel as two separate pieces, so each gets its own type size, and it behaves the same in Chrome, Edge, Firefox and Safari.

```text
CLOSED                          OPEN
+---------------------+         +---------------------+
| Saint Lucia      ⌄  |  38px   | Anguilla            | 15px
+---------------------+         | Antigua & Barbuda   |
                                | ...                 |
                                | ✓ Saint Lucia       |
                                +---------------------+
```

## Lighter alternative (incomplete)

Keep the plain dropdown and add CSS that shrinks only the list rows. It is a one-line change, but Safari on macOS ignores it — the huge list would stay there — and the panel still can't take on the brand colours. Not recommended for a briefing surface.

## Technical details

- File: `src/components/marketing/MarketingHome.tsx` — the `select#chamber-estimate-country` block (around lines 428-448).
- Replace `<select>` / `<option>` with `Select`, `SelectTrigger`, `SelectValue`, `SelectContent`, `SelectItem` from `@/components/ui/select`.
- Trigger: keeps `id="chamber-estimate-country"`, white surface, gold focus ring, `font-serif text-[38px]`, `min-h-20`.
- Panel: `bg-paper-0 text-ink-950`, rows at `text-[15px]` with `py-2`, capped height with scroll, gold accent on the highlighted row, check indicator on the current country.
- Behaviour unchanged: `value={estimateCountry}` with `onValueChange={setEstimateCountry}`, same country list and same fallback while loading.
- The visible "Select country" label stays; the trigger is labelled with `aria-labelledby` so screen readers still announce it.
- Nothing else changes — no database, no server functions, no other pages.

## Verification

- Playwright: trigger computed font-size 38px, open-panel rows 15px; screenshots of the open panel at 1280px and 390px widths.
- Pick a different country and confirm all ten Chamber value cards update.
- No horizontal overflow; build clean (`/tmp/observability/build-errors.log`).
