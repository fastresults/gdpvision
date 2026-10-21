# Make the eight summits visible on GDP Events

## Why nothing shows
All eight summits are saved as drafts. The public Events pages only show published events, so visitors see nothing.

## What I will do
1. Publish all eight summits (Blue Economy, CGDPS, CADIS, CHIS, CAFS, CEIS, CBIS, Health). Health stays "Dates TBA" with no venue until you settle Antigua vs Barbados.
2. Show them where you expect:
   - **/events**: "Upcoming summits" cards with photo, name, dates, venue and a "Details" button.
   - **/events/series/<summit>**: each summit's own page.
   - **/events/<edition>**: full details page with registration link to the summit site.
   - **/events/host**: add an "Our summits" strip with the eight cards, so the page you are on also lists them.
   - **Navigation**: the GDP Events menu lists the eight summits by name, each linking to its details page.
3. Check every page in the browser and confirm all eight appear.

## Technical details
- Data change: set `status='published'` for the 8 non-archived events (no schema change).
- Host page: reuse the existing event card component and `listPublicSeries`.
- Mega-menu: GDP Events group pulls summit links from published series.
