
## What exists today

- `countries` — 22 CARICOM/OECS entries already loaded (Haiti, Jamaica, Saint Lucia, …), each with `currency`, `fiscal_year_start_month`, `country_pack` JSON.
- `user_roles(user_id, role, country_code)` — table already has a nullable `country_code` column, but the current `has_role(uuid, app_role)` function ignores it, so every role is effectively global.
- `app_role` enum: `admin, principal, steward, advisor, line_minister, comms_director, cabinet_secretary, data_steward`. No `country_admin`.
- `instance_bindings(user_id, country_code, is_default)` — this is what actually scopes data reads (KPIs, series, etc. filter on it via RLS). New users have zero rows here, so `/instrument` opens on an empty state with no way to pick a country.
- `admin.functions.ts` — every mutation is gated by `assertAdmin`, which only allows the global `admin` role. No per-country delegation.
- `sectors`, `country_sectors`, `ministries`, `ministry_sectors` tables all exist; sectors + country composition are public read; ministries are steward/admin write.
- Existing super admins: `fastresults@gmail.com`. `stachio@madebyopen.com` has not signed up yet.

## What this plan adds

### 1. A `country_admin` role and country-aware permission check

- Extend `public.app_role` enum with `country_admin`.
- Add `public.has_country_role(_user_id, _role, _country_code)` — a SECURITY DEFINER function returning true when either (a) the user has that role globally (`country_code IS NULL`) or (b) they have it scoped to that specific country. Global `admin` continues to satisfy every country check.
- Leave the existing `has_role(user_id, role)` untouched (returns true for any-country match) so existing global-only checks keep working.

### 2. Post-sign-in onboarding flow

- New route `/onboarding/country` (inside `_authenticated/`) that shows when the signed-in user has no `instance_bindings` rows.
- `_authenticated/instrument/route.tsx` loader currently redirects to `/auth` when there is no user. Extend it: if the user has zero bindings, redirect to `/onboarding/country` instead of landing on the empty instrument.
- Onboarding UI: a searchable list of the 22 countries. The user picks one and submits. Behavior depends on their situation:
  - If they are a super admin, the request self-completes (insert binding + set default).
  - Otherwise, the request creates a pending row in a new `country_access_requests` table and shows a "waiting for your country admin to approve" screen. This is important because we do not want anyone to self-assign to Haiti and read Haiti data.

### 3. Country access requests

- New table `country_access_requests(id, user_id, country_code, status, requested_role, note, decided_by, decided_at, created_at, updated_at)` with `status ∈ (pending, approved, denied)`.
- RLS:
  - user sees their own rows
  - country admin for that country (via `has_country_role(auth.uid(), 'country_admin', country_code)`) sees + decides rows for that country
  - super admin sees + decides all
- Approving a request runs a server function that inserts the corresponding `instance_bindings` row (default true if the user has none), sets a base role (`advisor` by default), marks the request approved, and writes to `audit_log`.

### 4. Country-scoped admin console

- New route `/admin/country/$code` visible when the caller is super admin OR `country_admin` for `$code`. Sections:
  - Pending access requests for this country (approve / deny).
  - Users bound to this country (list, change role scoped to this country, remove binding).
  - Seeding entry points for this country (see §6): GDP composition, ministries, ministry↔sector mapping.
- `/admin` (existing super-admin console) gains a "Country admins" tab: promote/demote a user to `country_admin` for a chosen country (writes `user_roles(user_id, 'country_admin', country_code)`).
- All admin server functions get an `assertCountryAdmin(ctx, countryCode)` helper (calls `has_country_role`) alongside `assertAdmin`.

### 5. Grant stachio@madebyopen.com super admin

Same insert-only step as the previous plan: check whether the account exists in `auth.users`; if it does, insert `(user_id, 'admin', NULL)` into `user_roles` with `ON CONFLICT DO NOTHING` and audit-log the grant. If it does not, tell the user that person needs to sign up first, then run the insert.

### 6. Seeding pipeline (super admin, and where noted, country admin)

Order matters — each stage feeds the next.

```text
countries (already loaded)
   -> country GDP totals + sector composition (country_sectors)
      -> ministries per country
         -> ministry <-> sector mapping (ministry_sectors)
            -> KPIs / series per ministry & sector
```

Stage A — GDP baseline (super admin, or country admin for their country):
- Add `countries.gdp_current_usd` and `countries.gdp_year` columns (nullable). Super-admin seeder screen lets you paste/import per-country GDP for the reference year.
- `country_sectors` already exists — build a "Composition" editor keyed by country: rows for each `sectors.code` with `share_pct` and `confidence_grade`. Validate totals ≈ 100%. This screen lives in the country admin console.

Stage B — Ministries (country admin):
- Ministries editor under `/admin/country/$code/ministries`: create/rename/reorder ministries for that country. `ministries` already has RLS for `data_steward | admin`; extend the policy to also allow `country_admin` scoped to `country_code`.

Stage C — Ministry ↔ sector weights (country admin):
- Editor for `ministry_sectors`: assign each ministry a set of sectors with `weight`. Same RLS extension.

Stage D — Later (out of scope of this plan, called out so the data model is right): KPIs and series flow from ministries; the current `kpis write cabsec` RLS is fine, and we will add a country_admin allowance in the follow-up when we build the KPI seeder.

### 7. RLS updates (in the migration that adds `country_admin`)

For each of `instance_bindings`, `ministries`, `ministry_sectors`, `country_sectors`, `country_access_requests`: add / adjust write policies so `country_admin` can only touch rows for countries they administer, and super admin retains full access. Public read policies are unchanged.

## Technical notes

- Enum change: `ALTER TYPE public.app_role ADD VALUE 'country_admin'`.
- New function `has_country_role` mirrors the pattern of `has_role` (STABLE, SECURITY DEFINER, `SET search_path = public`, granted EXECUTE to `authenticated` + `service_role`).
- New table `country_access_requests` follows the four-step recipe: CREATE TABLE → GRANT (`SELECT, INSERT, UPDATE` to `authenticated`; `ALL` to `service_role`) → ENABLE RLS → policies.
- `assertCountryAdmin` uses `context.supabase.rpc('has_country_role', {...})`, matching the existing `assertAdmin` shape in `admin.functions.ts`.
- Onboarding gate lives in the `_authenticated/instrument/route.tsx` loader so it runs before the empty instrument renders; a small server fn `getMyCountryStatus()` returns `{ hasBinding, pendingRequestCountry }` so the loader stays a single round-trip.
- OG/head tags, error boundaries, and `useSuspenseQuery` patterns follow existing route conventions.
- No changes to `src/integrations/supabase/*` generated files.

## Order of execution once approved

1. Migration: enum + `has_country_role` + `country_access_requests` + RLS updates.
2. Insert-tool step to grant `stachio@madebyopen.com` if the account exists.
3. Server functions: onboarding, country-admin console, country-scoped seeding writes.
4. UI: `/onboarding/country`, `/admin/country/$code` (+ tabs), and hook onboarding gate into the instrument loader.
5. Seeding screens: GDP + composition first, then ministries, then ministry↔sector.
