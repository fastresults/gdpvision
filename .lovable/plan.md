## What's going on

Two things are tangled together:

1. **The stale-preview error.** `Failed to fetch dynamically imported module: virtual:tanstack-start-client-entry` is Vite's stale module graph after a dev-server restart. Both that module and the app root return 200 right now, so it's transient — but it very likely means the tab you were looking at was still rendering the **pre-change** page. That is the most probable reason the logo "didn't reduce".

2. **The sizing code is already reduced.** The public header currently renders `<Wordmark className="h-[2.55rem] md:h-[3.4rem]" />` in `MarketingShell.tsx` (down from `h-12 md:h-16`), and the component default is `h-[1.9rem]`.

## Plan

1. Force a clean reload of the preview and confirm the rendered logo height with a live measurement (not just the source), so we're judging the real pixel size rather than a cached page.
2. If it still reads at the old height, apply a further 15% cut to the header override: `h-[2.55rem] md:h-[3.4rem]` → `h-[2.17rem] md:h-[2.89rem]`.
3. Check the other places a logo renders so the reduction is consistent where it should be:
   - `MarketingShell.tsx` line 149 (footer wordmark, currently `h-8`)
   - the authenticated shells (console / admin / instrument headers), which have their own logo sizing and were not touched by the earlier edit.
4. Re-measure at desktop and mobile widths to confirm the header container no longer over-sizes the lockup.

### Technical notes

- The `Wordmark` component's own `h-[1.9rem]` is always overridden by the `className` passed at each call site, so any real size change must happen at the call site — that's why the first edit to `Wordmark.tsx` alone had no visible effect.
- No layout/business logic changes; header height and padding stay as-is unless the smaller lockup leaves an awkward gap, in which case I'll trim the header's vertical padding to match.
