# Welcoming admin home

Today, super admins land directly on `/admin/countries` (a dense operations table) and country admins land on `/instrument` (a single country's dashboard). Neither greets the user or sets context. Replace the entry with a single welcoming home screen that adapts to role.

## New route

`src/routes/_authenticated/home.tsx` — the shared landing page for every signed-in user. Uses `getMyCountryStatus()` to branch:

- **Super admin** → "Welcome back, Administrator" + gallery of ALL countries (from `listOnboardingCountries`) as flag tiles, each linking to `/admin/countries/$code/onboard`. Plus 4 quick-action cards: Countries queue, Second Brain, Users, Audit log.
- **Country admin (single country)** → Full-bleed hero with that country's flag, "Welcome to the {Country} Instrument", a short welcome paragraph, and 6 chamber launch tiles (Ledger, Portfolio, Scenarios, FDI Studio, Narrative, Cabinet).
- **Country admin (multi-country)** → Same welcome, but a country picker grid first; picking one enters its instrument.
- **No bindings + not super** → Friendly "Request access" state pointing at existing request flow.

## Redirects

Update `postSignInRedirect` in `src/routes/auth.tsx` to always return `/home`. Update `/_authenticated/route.tsx` so hitting `/` while authenticated forwards to `/home` (or leave `/instrument` and `/admin/countries` fully working as deep links — only the default landing changes).

## Flags

No flag column exists today. Use `https://flagcdn.com/w320/{iso2}.png` via a small `iso3ToIso2` map in `src/lib/caricom-registry.ts` (22 CARICOM/OECS countries — trivial static map). Fallback to a monogram tile when unknown. Preload via `<img loading="eager">` on the hero, `loading="lazy"` on the grid.

## Visual direction

Consistent with the existing editorial system (paper-0 background, ink-950 serif headings, mono eyebrows, thin line-200 borders — same tokens as `SectionHeader` / `SuperAdminShell`). No new color tokens.

- Hero: full-width band, flag as a 480px softly-shadowed card on the left, headline + welcome copy + primary CTA on the right.
- Country gallery: responsive grid of flag cards (aspect 3:2), country name in serif below, ISO3 + GDP in mono caption. Hover raises the card and reveals a "Enter →" affordance.
- Quick actions: 2×2 grid of bordered cards with icon + title + one-line description.

## Copy (super admin)

- Eyebrow: `SUPER ADMIN · {N} SOVEREIGN INSTANCES`
- Title: `Welcome back.`
- Sub: `Every CARICOM and OECS country in one instrument. Pick a nation to review its ledger, or jump straight into an operations surface.`

## Copy (country admin)

- Eyebrow: `{COUNTRY} · SOVEREIGN INSTRUMENT`
- Title: `Welcome to the {Country} instrument.`
- Sub: `Your live economic picture, your scenario room, your cabinet dossier — all grounded in verified sources. Choose a chamber below to begin.`

## Technical notes

- New file: `src/routes/_authenticated/home.tsx` (route, loader ensures `getMyCountryStatus` + conditional `listOnboardingCountries`).
- New component: `src/components/home/WelcomeHome.tsx` with `SuperAdminWelcome`, `CountryAdminWelcome`, `CountryPickerWelcome`, `NoAccessWelcome` subviews.
- New helper: `iso3ToIso2` in `caricom-registry.ts` + `flagUrl(iso3)` util.
- Edit `src/routes/auth.tsx` `postSignInRedirect` → return `/home` for all authenticated users.
- Keep `/admin/countries` and `/instrument` as-is (deep-linkable from the home page and existing nav).
- Add "Home" link to `SuperAdminShell` top nav so admins can return.

## Out of scope

- No schema changes.
- No changes to existing country data or chambers.
- No new AI calls — everything renders from existing queries.
