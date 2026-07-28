## What's actually broken

I read `src/components/marketing/MarketingShell.tsx` (the shared public header), `src/components/marketing/MarketingHome.tsx`, `src/routes/_authenticated/instrument/route.tsx`, and `src/routes/_authenticated/home.tsx`. Four real defects:

**1. Three of the six nav items are dead on every page except the home page.**
"The Instrument", "Sovereignty" and "Request briefing" are plain `<a href="#instrument">` / `#sovereignty` / `#briefing`. Those section IDs exist only in `MarketingHome`. On `/business-case`, `/op-eds`, `/op-eds/$slug`, `/auth` and `/reset-password` — all of which render the same shell — clicking them just appends a hash to the current URL and nothing moves. This is the main "routing doesn't work" symptom.

**2. Signed-in state makes it worse, not better.**
When signed in the wordmark points at `/home`, but the same three hash links still point at home-page sections that don't exist on `/home`. So after signing in and navigating back out to a public page, half the menu is inert.

**3. "Open instrument" can dump the user somewhere unexpected.**
The signed-in header links to `/instrument`, whose loader redirects to `/admin/countries` (super admins) or `/onboarding/country` (anyone with no instance bindings). For a country user the correct destination is their console brief, not the instrument shell.

**4. There is no mobile navigation at all.**
Every nav item carries `hidden md:inline`, so below the `md` breakpoint the header shows only the wordmark and Sign in.

Also minor: `useSignedIn` is called twice (shell + `AuthEntry`), opening two auth listeners, and SSR always paints the signed-out header before flipping — a visible flicker.

## The fix

**Make section links route-aware.** Replace the bare anchors with TanStack `<Link to="/" hash="instrument">` (same for `sovereignty`, `briefing`). From the home page this scrolls in place; from any other public page it navigates home and lands on the section. Add a small hash-scroll effect on the home route so a cross-page hash arrival scrolls to the target after mount (the router's scroll-to-top hook already skips hash navigations, but the target may not exist at first paint).

**Give the signed-in header a correct destination.** Keep the wordmark → `/home`, and change "Open instrument" to a "Dashboard" link pointing at `/home`, which already routes super admins to the country picker and country users to their console. Sign-out gets the full hygiene sequence: cancel in-flight queries, clear the query cache, `signOut()`, then `navigate({ to: "/", replace: true })`.

**Add a mobile menu.** A compact disclosure under the header (or a sheet) exposing the same six items on small screens, closing on selection.

**Single session source.** Lift `useSignedIn` into `MarketingShell` and pass the flag to `AuthEntry` so there is one listener and one consistent render.

## Verification

Drive Playwright over `/`, `/business-case`, `/op-eds`, `/op-eds/$slug` signed-out: click each of the six nav items and assert the resulting URL and that the target section is in view. Then repeat with a restored session to confirm the signed-in header renders Dashboard + Sign out, that Dashboard lands on `/home`, and that sign-out returns to `/` with the signed-out header. Check both desktop (1280) and mobile (390) widths, plus a clean console.

## Files

- `src/components/marketing/MarketingShell.tsx` — nav links, mobile menu, single session hook, signed-in affordance, sign-out hygiene
- `src/components/marketing/MarketingHome.tsx` — hash-arrival scroll on mount

No backend, schema, or copy changes.
