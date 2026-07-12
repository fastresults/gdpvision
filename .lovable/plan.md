## Root cause of the 404

The `Link to="…"` values in the new super-admin pages include the `/_authenticated/` layout segment (e.g. `to="/_authenticated/admin/countries/$code/onboard"`). Underscore layout segments are part of TanStack's internal route ID, **not** the URL. TanStack builds the anchor href literally, so the browser navigates to `/_authenticated/admin/countries/LCA/onboard` — which matches nothing → 404. `createFileRoute("/_authenticated/…")` strings are correct; only the `<Link to>` / navigation strings are wrong.

Files with the bug: `admin/countries.index.tsx` (3 links), `admin/countries.$code.onboard.tsx` (1 link).

## Plan — Super Admin build & audit

### 1. Fix the routing bug (unblocks Saint Lucia)
- Rewrite every `to="/_authenticated/..."` to the real URL (`/admin`, `/admin/countries`, `/admin/countries/$code/onboard`) across the two files above.
- Add `errorComponent` + `notFoundComponent` to both routes (required for any route with a loader).
- In the `$code/onboard` loader, `throw notFound()` when the country doesn't exist, so a bad code renders a real boundary instead of falling through.

### 2. Super-admin shell (`src/components/admin/SuperAdminShell.tsx`)
A single header/layout reused by every `/admin/*` page:
- Wordmark → `/admin/countries`
- Nav: **Countries** · **Users** · **Config** · **Activity** · **Audit log**
- Right side: "Super admin" badge, current user email, Sign out
- Consistent max-width container, breadcrumb slot
- Convert `/admin` (index), `/admin/countries`, `/admin/countries/$code/onboard`, `/admin/country/$code`, `/admin/audits/*`, `/admin/documents` to render inside the shell.

### 3. Country onboarding wizard upgrades (`admin/countries.$code.onboard.tsx`)
- Header: country flag/name + committed-stage summary chips (Profile ✓, GDP ✓, …).
- Add **"Run all pending"** button (sequential runs, stops on first error).
- Replace `alert()` with an inline error region per stage; keep last error visible until re-run.
- Show cost / tokens / model per run pulled from `onboarding_runs`.
- Show Perplexity key status ("configured" / "missing — cannot run agents") at the top so it's obvious when the environment isn't ready.
- After a successful commit, invalidate both the wizard status query and the countries queue query so the queue's green dots update immediately.

### 4. Country queue upgrades (`admin/countries.index.tsx`)
- Search box (name / iso3 / code) + status filter (all / not started / in progress / complete).
- Sort by progress descending by default.
- Add a "Bulk profile" action that runs the profile agent for every country with 0 stages committed (throttled, sequential).
- Column: last activity timestamp from most recent `onboarding_runs` row.

### 5. Activity page — new route `admin/activity.tsx`
- Table of latest 100 `onboarding_runs` rows across all countries: started_at, country, stage, status, model, tokens_in/out, cost_usd, error.
- Filter chips by status (planning / researching / drafted / committed / failed).
- Drill-in link to the wizard for that country.
- Read-only super-admin view; helps diagnose failing runs at a glance.

### 6. Super-admin gate
- Add a `beforeLoad` on `/admin` (and children by inheritance via a shared helper) that calls a small `assertSuperAdmin` server fn; non-supers `throw redirect({ to: "/instrument" })`.
- Belt-and-braces: server fns already assert `has_role('admin')`; this just prevents non-supers from landing on the pages at all.

### 7. Small server-side additions (`country-onboarding/agents.functions.ts` + new files)
- `listOnboardingRuns({ limit })` — for the activity page.
- `assertSuperAdmin()` — for the route gate.
- `getPerplexityKeyStatus()` — returns `{ configured: boolean }` (no secret leak) for the wizard header.
- Keep existing agent/commit fns untouched (already role-gated and citation-gated).

### 8. Verification pass after edits
- Reload `/admin/countries` as super admin → click Saint Lucia → wizard loads at `/admin/countries/LCA/onboard` (no 404).
- Click "Run AI research" on the Profile stage → run row appears in Activity page.
- Commit profile → queue dot turns green.
- Sign out link works; hard-refresh on the wizard route works.

### Out of scope for this pass
- Editing committed rows from the wizard (a separate "Country detail" review page can come later).
- Cron/auto-onboarding of all 22 countries.
- New tables — the existing `onboarding_runs / drafts / citations` schema is sufficient.