# Make the standards and investment hubs findable

The hubs exist and the route gate already lets country users open them, but the
links are only on the Chambers Launcher (`/home`, `/admin/country/<CODE>`) and
inside the investments page. Two gaps remain: country users have no visible
entry point in the console, and the super-admin countries list does not link
the hubs per row.

## Change 1 — Console brief tiles (country users)

`src/routes/_authenticated/console.$code.index.tsx`

Add a "Standards and investment" section under the existing Sovereign Eye tile,
reusing the same tile pattern (`SovereignEyeTile` as the visual reference —
eyebrow, serif title, one-line blurb, ArrowUpRight, hover/focus styles from
`src/styles.css` tokens, no inline colors):

- **Data standards audit** → `/admin/countries/$code/standards`
- **Investment pipeline** → `/admin/countries/$code/investments`
- **Investors** → `/admin/countries/$code/investors`

Layout: three stacked tiles on mobile, a bordered grid row on `md+`
(mirroring the launcher's syndication row). No new routes, no server fns.
Country users landing on these pages get the SuperAdminShell "← Your brief"
back link, so the round trip already works.

## Change 2 — Countries list row links (super admins)

`src/routes/_authenticated/admin/countries.index.tsx`

In the last table cell, next to the existing `Data` link, add two underlined
links per row: `Standards` and `Investments` (same link style as `Data`).
The country name itself keeps pointing at onboarding.

## Verification

- Typecheck (`tsgo`), eslint.
- Playwright: signed-in country-user console shows the three tiles and each
  opens its hub; super-admin countries list shows the per-row links and they
  navigate correctly.
- No route, table, or server-function changes — `bun run check:maps` should
  stay green.
