## Goal

When a super admin signs in and picks a country flag on `/home`, they land on that country's **Executive Brief** — the identical dashboard a country admin sees — instead of the onboarding/admin page.

## Current behaviour (verified)

- `/home` renders `SuperAdminWelcome`, whose `CountriesGrid` → `CountryCard` links are hard-typed to `/admin/countries/$code/onboard`.
- Country admins land on `/console/$code`, which renders `ExecutiveDashboard` + request lanes inside the 4-rail console shell (Brief / Study / Ask / Send).
- The console layout already resolves its country from the route param, so it works for any signed-in user, not just bound country users.

## Changes

1. **Country cards route to the brief**
   - Widen `CountryCard`'s `to` prop to accept `/console/$code` and point the super-admin grid (and the multi-binding picker) at `/console/$code`.
   - Cards keep flag, name, GDP and onboarding-progress chips exactly as today.

2. **Keep the operator path reachable**
   - Add a small secondary link on each super-admin card footer (e.g. `Onboarding →`) going to `/admin/countries/$code/onboard`, so provisioning work isn't lost. The card's main click target is the dashboard.
   - The existing "Countries queue →" link above the grid stays.

3. **Console chrome for super admins**
   - `console.tsx` derives the country name from the user's own bindings, which a super admin doesn't have. Fall back to the onboarding countries registry (or `caricom-registry` name lookup) so the header chip shows the proper country name rather than a bare code.
   - Add an unobtrusive "Agency ←" / back-to-`/home` affordance in the console header, shown only when the signed-in user is a global admin, so they can switch countries without the browser back button.

4. **No permission changes**
   - Super admins already pass every gate; server functions continue to run as their real identity. The existing "View as country user" impersonation mode is untouched and remains the way to preview a restricted country-user experience.

## Verification

- Sign-in as super admin → `/home` → click a flag → `/console/ATG` shows the executive brief, chamber cards, attention rail and the 4-rail tab bar.
- Header chip shows the country name; back link returns to `/home`.
- Country-admin flow (direct redirect to `/console/$code`) is unchanged.
