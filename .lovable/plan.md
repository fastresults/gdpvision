## Goal

Let a super admin preview the app exactly as a country user of Antigua and Barbuda (ATG) would see it — same chamber tiles, same Concierge, same Second Brain, same nav — without creating a second account or losing admin powers.

## Approach — "Impersonation Mode" (view-as)

A lightweight, client-side impersonation layer that is UI-only. It does not weaken RLS or grant new database rights; a super admin already has read access via `has_role('admin')`. The mode just makes the app *render* as if the current user were a plain country user bound to ATG.

### 1. Impersonation context

- New `useImpersonation()` hook backed by `localStorage` key `gdpv.viewAs` = `{ role: "country_user", country_code: "ATG" } | null`.
- New `<ImpersonationProvider>` mounted in `__root.tsx` so every route sees it.
- Effective role helper: `useEffectiveRole()` returns `"country_user"` when impersonating, otherwise the real role.

### 2. Where it changes behavior (UI only)

- `_authenticated/route.tsx` and `_authenticated/admin/route.tsx`: when impersonating, admin surfaces redirect to `/home` and the "Admin" nav entry is hidden.
- `home.tsx` + `ChambersLauncher`: force `country_code = "ATG"` and hide super-admin-only tiles (Agency Console, Country Onboarding, Backfill, Invitations).
- `useChamberCountry`: return `"ATG"` when impersonating, ignoring `?code=` and bindings.
- Concierge (`/concierge`, `/concierge/new`, `/concierge/$id`): shown normally — this is the primary surface to test.
- Agency console (`/agency`) and `/admin/*`: hidden from nav and gated by redirect to `/home` while impersonating.

### 3. Entry + exit UI

- New "View as country user (ATG)" button in the super-admin shell header (`SuperAdminShell` and `/home` for supers).
- Persistent top banner while active: `Viewing as Antigua and Barbuda country user · Exit view-as` → clears localStorage and reloads to admin home.
- Banner is the only affordance that reveals the mode; nothing else in the UI hints at admin identity.

### 4. Safety rails

- Impersonation is UI-only. Server functions still run as the real (admin) user, so no privilege change and no audit confusion for writes. Document this in a short comment at the top of the hook.
- Writes that would be surprising in view-as (submitting a real Concierge request, deleting data) show a confirm dialog: "You are in view-as mode. This will create a real record owned by your admin account. Continue?"
- Auto-expires after 8 hours to avoid a super admin forgetting they're in view-as.

### 5. Seed data for ATG (only if missing)

Quick check during plan execution: if ATG has no country binding / no sample Concierge requests, add a one-time seed migration inserting one draft request and one delivered request so the dashboard isn't empty during the demo. Skip if data already exists.

## Files touched

- new: `src/lib/impersonation.tsx` (context + hook + banner component)
- edit: `src/routes/__root.tsx` (mount provider + banner)
- edit: `src/routes/_authenticated/route.tsx`, `.../admin/route.tsx` (redirects while impersonating)
- edit: `src/routes/_authenticated/home.tsx` (entry button for supers, force ATG in view-as)
- edit: `src/components/country/ChambersLauncher.tsx` (hide admin-only tiles)
- edit: `src/hooks/useChamberCountry.ts` (respect impersonation)
- edit: `src/components/admin/SuperAdminShell.tsx` (entry button in header)
- optional: seed migration for ATG demo Concierge rows

## Out of scope

- Real role switching or a second test account.
- Server-side identity swap (would require signed tokens + audit rework — not needed to preview UI).
