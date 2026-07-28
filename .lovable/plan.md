## Why you can't find it

The dashboard was built, but nothing in the country-user flow points at it.

- It exists twice: `/admin/countries/$code/executive` (wrapped in the **super-admin** shell, and `/admin/*` has a `beforeLoad` gate that redirects anyone who isn't a global admin) and `/console/$code/brief`.
- `/console/$code/brief` has **no link anywhere** — the console bottom bar has exactly three rails: Study / Ask / Send.
- A country user signing in hits `/home`, which immediately redirects to `/console/$code` — the requests list ("The Study"), not the brief.
- `ChambersLauncher` (the brief link + the eight chamber cards) renders only on `/home` for super admins and on the admin country page, and every card points at an `/admin/...` route country users are bounced out of.

So the brief is real, reachable only by typing the URL, and the chambers are agency-side only.

---

## Part 1 — The brief becomes the console home

1. Move today's request-list page from `console.$code.index.tsx` into `console.$code.study.tsx` (route `/console/$code/study`), unchanged.
2. `console.$code.index.tsx` becomes the Executive Brief: masthead, "Requires you" attention rail, the eight chamber cards, due ledger — the same `<ExecutiveDashboard>` already built, rendered at console width with a mobile-first density pass (single-column cards under `sm`, attention rail first).
3. `/console/$code/brief` stays as a redirect to `/console/$code` so existing links and the print target don't break.
4. Bottom tab bar goes from 3 rails to 4: **Brief** (home) · **Study** · **Ask** · **Send** — Send keeps the primary treatment. Active-state logic updated so `/requests/*` marks Study, not the home tab.
5. The brief's in-flight/delivered counts get a "See all" link into Study, so the two lanes stay one tap apart.

## Part 2 — Country users can enter the chambers

Chambers currently live only under `/admin/*`, which is hard-gated to global admins, and the pages render inside `SuperAdminShell`. Rather than duplicate ~30 route files, the gate and the chrome become role-aware:

1. **Gate** — `_authenticated/admin/route.tsx` allows through either a global admin, or a signed-in user with a binding to the `$code` in the URL. Non-matching country codes still redirect. Admin-only surfaces (`/admin/countries` index, `/admin/brain`, users, invitations, audits, onboarding, ledger-QA, config) keep the strict super-admin check.
2. **Chrome** — `SuperAdminShell` gains a country-user mode: the "Super admin" eyebrow and the agency nav are replaced by the country chip plus a back-to-brief link, so a Prime Minister never sees agency navigation.
3. **Server-side truth** — audit the chamber server functions for `assertSuperAdmin`-style checks and move them to the existing `has_country_access` scoping so the read/write is authorised by binding, not by role. Anything genuinely agency-only (onboarding runs, corpus admin, cross-country surfaces) keeps the super-admin assertion. This is the security-critical step; the UI gate alone is not sufficient.
4. **Links** — `ChambersLauncher` and the brief's chamber cards resolve to the same routes for both audiences; the launcher is added to the console (below the brief's chamber grid it's redundant, so the brief cards themselves become the switchboard).

## Part 3 — Super-admin parity

- `/admin/countries/$code/executive` keeps working unchanged for the agency view.
- Impersonation ("view as country user") already redirects to `/console/$code`, so super admins will land on the brief too and see exactly what the Principal sees.

## Technical notes

- Files touched: `src/routes/_authenticated/console.tsx` (tabs), `console.$code.index.tsx` (new brief home), new `console.$code.study.tsx`, `console.$code.brief.tsx` (redirect), `src/routes/_authenticated/admin/route.tsx` (gate), `src/components/admin/SuperAdminShell.tsx` (role-aware chrome), `src/components/country/ChambersLauncher.tsx`, plus the chamber `*.functions.ts` audit.
- No schema changes; `has_country_access` and the country bindings already exist.
- `ExecutiveDashboard`, its resolvers, and the attention ranking are reused as-is — no rewrite of the data layer.
- After the route changes: `bun run map` + `bun run check:maps` so CI stays green.

## Sequence

Part 1 lands first and is independently verifiable (sign in → brief is the first screen). Part 2 follows with the server-function audit, since that's where the real access decision is made.
