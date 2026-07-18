## Chamber 02 — Portfolio Workspaces (country-scoped build-out)

### Problem with today's route
`ChambersLauncher` sends Chamber 02 to `/instrument/portfolio` — that lives in the `_authenticated/instrument` shell (its own header/nav) and reads the "default country binding", not the country the admin is inside. Clicking the card from `/admin/countries/ATG/onboard` yanks the user out of the ATG admin surface, exactly like the tab problem we just fixed for Data Stores. Chamber 01 (`/admin/countries/$code/ledger`) already models the right pattern: country in the URL, wrapped in `SuperAdminShell`.

### Goal
Give Chamber 02 the same country-scoped, in-shell UX as Chamber 01 — one workspace per ministerial portfolio for the current country, with the ministry roster on the left, a portfolio detail pane on the right, and no page yank.

### Routes to add (country-scoped, admin shell)
```
src/routes/_authenticated/admin/
  countries.$code.portfolio.tsx           → layout (SuperAdminShell + <Outlet/>)
  countries.$code.portfolio.index.tsx     → roster + empty detail pane
  countries.$code.portfolio.$ministry.tsx → roster + selected ministry detail
```

- `ChambersLauncher` Chamber 02 link changes from `/instrument/portfolio` to `/admin/countries/$code/portfolio` (params link, matches Chamber 01's shape). No other chamber destinations change in this pass.
- Existing `/instrument/portfolio*` routes stay (used by the instrument shell for country-admin users) — we're adding, not deleting.

### UI / UX

Two-column layout inside `SuperAdminShell` (matches Ledger chamber chrome):

```
┌─ CeremonialHeader (country name, chamber label "02 · Portfolio Workspaces") ─┐
│                                                                              │
│ ┌── Ministries rail (sticky) ──┐  ┌── Portfolio detail ─────────────────┐    │
│ │  Search / filter             │  │  Minister card (name, party,        │    │
│ │  • Ministry A  · 3 sectors   │  │    portrait, contact) — from        │    │
│ │  • Ministry B  · 2 sectors   │  │    ministry_profiles.minister_profile│   │
│ │  • Ministry C  · 1 sector    │  │                                     │    │
│ │  ...                         │  │  Sectors in portfolio (table:       │    │
│ │                              │  │    sector · GDP share · weight)     │    │
│ │                              │  │                                     │    │
│ │                              │  │  KPI strip (small multiples for     │    │
│ │                              │  │    each sector's headline KPI)      │    │
│ │                              │  │                                     │    │
│ │                              │  │  Scenarios (list + New scenario →)  │    │
│ │                              │  │                                     │    │
│ │                              │  │  Actions: Open in Scenario Engine,  │    │
│ │                              │  │    Open Ministry dossier            │    │
│ └──────────────────────────────┘  └─────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────────────┘
```

Behaviors:
- Selecting a ministry in the rail navigates to `/admin/countries/$code/portfolio/$ministry` — child route swap, rail stays mounted, no white flash.
- `/portfolio` (index) shows the rail plus an empty-state pane ("Select a portfolio to open its workspace") and auto-preloads the first ministry on hover.
- Empty ministries list → same empty-state copy as `/instrument/portfolio` today, plus link back to onboarding Stage 09.
- Sector name links open the country's sector dossier (reuse existing `/instrument/sector/$code` for now; a country-scoped variant is out of scope for this pass).
- "New scenario →" preserves current behavior (opens `/instrument/scenarios/new?ministry=<slug>`).
- Collapse: rail can collapse to icon-only (persist in `localStorage` per country, same pattern as Data Stores panel).

### Data (reuse existing server fns, no schema changes)
- `listMinistries({ countryCode })` — rail.
- `getPortfolio({ countryCode, slug })` — detail (ministry + sectors + composition + scenarios).
- `ministry_profiles.minister_profile` (already canonical) — Minister card at top of detail.
- KPI strip: reuse `KpiSmallMultiples` fed by existing `country_kpis` points, filtered to sectors in the portfolio.

All queries stay under `_authenticated/admin/` so RLS/route guards match the rest of the country admin surface.

### Technical notes
- Route filenames use dot-nesting, `createFileRoute("/_authenticated/admin/countries/$code/portfolio")` etc., matching project convention.
- Layout route's component returns `SuperAdminShell` around `<Outlet/>`; index and `$ministry` render the rail + pane so the rail remounts once and children swap.
- Use `queryOptions` + `ensureQueryData` in loaders + `useSuspenseQuery` in components (project default read shape). Preload ministry detail on rail hover via `router.preloadRoute`.
- Add `errorComponent` and `notFoundComponent` on each route (project convention).
- Head metadata per route: `"Portfolios · <code> — GDPVision"` and `"<Ministry> · Portfolio · <code> — GDPVision"`, both `robots: noindex`.
- Update `src/components/country/ChambersLauncher.tsx`: change Chamber 02 entry's `to` to `/admin/countries/$code/portfolio` and `kind` to `"params"`.

### Out of scope (call out, do not build here)
- Country-scoped sector dossier route.
- Editing minister/sector mapping from inside the chamber (that stays in Data Stores → Ministries).
- Rewiring Chambers 03–06 to country-scoped routes — same fix pattern, tracked separately.