# Show all ten chambers on the country page

## What's wrong
The chamber grid on the country page shows only chambers 01–08. Chamber 09 (Digital Government Studio) and Chamber 10 (Sector Studio) exist, but they sit in the lower "Standards and investment" row as plain tiles with no chamber numbers. The page text also still says "all eight chambers".

## Recommended approach
Treat 09 and 10 as full chambers, one list for all ten:

- Add **09 Digital Government Studio** and **10 Sector Studio** to the chamber grid, with the same numbered tiles, icon and one-line description as the others. 01 stays as the large top tile, and 02–10 fill the grid in order.
- Take those two out of the "Standards and investment" row, so they don't appear twice. That row keeps Data standards audit, Investment pipeline, Investors and Government record.
- Change "eight chambers" to "ten chambers" in the launcher heading and the executive brief text.
- The same launcher also appears on /home and /admin/country/<CODE>, so they get fixed too.

## Technical details
- `src/components/country/ChambersLauncher.tsx`: extend the `to` union with `/egov` and `/sector`. Append entries 09 (icon `Monitor`) and 10 (icon `Factory`) to `REST`. Remove both from `SYNDICATION`. Update the "eight" copy. Check the grid columns so 9 tiles lay out cleanly, for example 3 per row on large screens.
- `src/routes/_authenticated/admin/countries.$code.executive.tsx`: change "eight" to "ten" in the head description.
- Update the "02–08" header comment. No database or route changes.
- Verify on /admin/countries/ATG/onboard at desktop and mobile widths.
