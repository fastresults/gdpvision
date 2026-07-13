## Goal
Every `[N]` citation marker anywhere in the app opens the full source card in a **popup on hover** (not click), with a click fallback for touch devices.

## Where citations render today
- Central component: `src/components/data/PrettyJson.tsx` — `CitationRef` renders `[N]` as a button that opens a shadcn `Dialog` on click.
- All admin/onboarding/data surfaces already route through `PrettyJson` (onboard draft review, `countries.$code.data.tsx`, memory drafts, sector dossiers, ministry profiles).
- Counsel answer pages (`counsel/index.tsx`, `counsel/mobile.tsx`) render their own citation list — not inline `[N]` markers — out of scope for hover behavior, but same visual card component will be reused so styling stays consistent.

## Change
Refactor citation display in `PrettyJson.tsx` only. No API, no data model, no ingest change.

1. Replace the `Dialog`-on-click flow with `HoverCard` (shadcn `hover-card.tsx`, already in project).
2. `CitationRef` becomes a `<HoverCardTrigger>` wrapping the existing `[N]` sup button.
3. `<HoverCardContent>` renders the same source card content that today lives inside `CitationDialog` (domain, published date, title link, quote, full URL) — extracted into a reusable `<CitationCard citation={c} n={n} />` sub-component so Dialog and HoverCard both use it.
4. Hover behavior: 150 ms open delay, 100 ms close delay, `align="start"`, `side="top"` with collision-aware flip, max width ~420 px, scroll if multi-ref content overflows ~60 vh.
5. Click fallback: clicking the marker still opens the current `Dialog` (needed on touch/no-hover devices and for keyboard users who want a persistent view). Detected via `matchMedia('(hover: none)')` — on hover-less devices the trigger opens the modal directly on tap instead of the hovercard.
6. Keyboard: `HoverCardTrigger` is focusable; focus opens the card, Escape closes.
7. Multi-ref markers (`[9,1,9,1]`): dedupe refs in `CitationRef` before render so the popup lists each source once, in the order they first appear.
8. Missing-source guard: if `citations[n-1]` is undefined, show "Source unavailable [N]" inside the popup (matches current Dialog behavior).

## Files touched
- `src/components/data/PrettyJson.tsx` — refactor `CitationRef`, extract `CitationCard`, swap `Dialog` trigger for `HoverCard`, keep `Dialog` as click/tap fallback.

No other files change. No migrations. No new packages.

## Verification
- On `/admin/countries/LCA/onboard`, hover any `[N]` inline marker → popup shows the source card; move away → closes.
- Click the marker on desktop → modal still opens for a persistent view.
- Repeated refs like `[9,1,9,1]` show sources 9 and 1 once each in the popup.
- Preview at `1386x853` viewport confirms popup does not clip at the right edge (collision flip).
