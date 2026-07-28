## Goal
Add a floating, sticky "Back to top" affordance on the public home page (`/`) so users can always return to the top of the long, sectioned page from any scroll position.

## What we'll build
1. A reusable `FloatingBackToTop` component in `src/components/marketing/FloatingBackToTop.tsx`.
   - Uses the existing `btn-primary` utility (ink-950 background, paper-0 foreground) to stay on-brand and respect the global button contract.
   - Circular icon-only button with an `ArrowUp` lucide icon, or a compact pill with "Top" label + arrow — final label chosen during implementation to match the spare, editorial voice of the marketing site.
   - Fixed to bottom-right (`fixed bottom-6 right-6 z-50`) with a subtle drop shadow using the existing shadow tokens.
   - Appears once the user scrolls past a threshold (default 300px) so it is not redundant at the top of the page; fades/slides in with `motion-reduce` support.
   - Click handler smooth-scrolls to `window.scrollTo({ top: 0, behavior: 'smooth' })`, falling back to `auto` when `prefers-reduced-motion: reduce` is active.
   - Accessible: `aria-label="Back to top"`, keyboard focusable, visible focus ring via the existing `btn-primary` focus-visible style.

2. Wire the component into `src/components/marketing/MarketingHome.tsx` just before the closing `</MarketingShell>` tag so it renders across all home-page sections.

3. (Optional, recommended) Apply the same component to the other long public pages once proven on the home page:
   - `src/routes/business-case.tsx`
   - `src/routes/op-eds.index.tsx`
   - `src/routes/op-eds.$slug.tsx`
   - This keeps the public-site UX consistent and costs only dropping the component into each page shell.

## Implementation notes
- No new route or server function needed; this is pure UI/presentation work.
- Use `useEffect` with a window scroll listener. Debounce/throttle with a lightweight `requestAnimationFrame` pattern to avoid layout thrashing.
- No new dependencies — reuse `lucide-react` for the arrow icon and existing Tailwind theme tokens.
- Verify the button does not overlap the footer content on mobile; keep safe margins (`bottom-6 right-6`) and ensure it clears the mobile menu toggle area.
- Test the public page at 390px viewport to confirm the tap target is at least 44px and the button remains visible above the mobile footer.

## Deliverables
- `src/components/marketing/FloatingBackToTop.tsx`
- Updated `src/components/marketing/MarketingHome.tsx` including the new component
- (Optional) Updated `business-case.tsx`, `op-eds.index.tsx`, and `op-eds.$slug.tsx` for consistency
- Visual verification via the live preview at desktop and mobile widths