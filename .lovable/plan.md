## Why you landed on the country picker

After sign-in, every user is navigated to `/instrument`. Its loader checks `instance_bindings` for the current user and — if there are none — redirects to `/onboarding/country`. Your super-admin account has no country binding yet, so it fell into that flow.

The onboarding page does detect super admins (that's the "You are a super administrator — pick any country…" copy) but it still asks you to bind yourself to a single country, which is the country-admin flow. There is no branch that sends a super admin to the super-admin dashboard instead.

## Plan

1. **Post-login routing (`src/routes/auth.tsx`)** — after a successful sign-in / existing-session detection, call `getMyCountryStatus()` once and branch:
   - `isGlobalAdmin === true` → navigate to `/admin/countries` (the super-admin country onboarding dashboard we built).
   - otherwise → keep the current `/instrument` navigation.

2. **`/instrument` loader (`src/routes/_authenticated/instrument/route.tsx`)** — when there are no bindings, also check `isGlobalAdmin`. Super admins get `redirect({ to: "/admin/countries" })`; everyone else keeps redirecting to `/onboarding/country`. This covers hard refreshes and deep links, not just the post-login hop.

3. **`/onboarding/country` (`src/routes/_authenticated/onboarding/country.tsx`)** — if a super admin lands here anyway (e.g. via the wordmark link), redirect them to `/admin/countries` in the loader instead of showing the country-admin picker. Keeps a single "super admin home" and removes the confusing "pick any country to bind yourself" copy for supers.

4. **Admin landing (`/admin`)** — add a top-of-page link/redirect to `/admin/countries` so the super-admin dashboard is the obvious entry point. No structural change to `/admin` itself.

No DB changes. No changes to the country-admin experience for non-super users.

### Technical notes
- `getMyCountryStatus` already returns `isGlobalAdmin`, so no new server fn is needed.
- Loader-level redirects run before the component, so the super admin never sees the country picker flash.
- Auth page uses `useServerFn(getMyCountryStatus)` in the existing session-detection `useEffect` and the submit handlers.