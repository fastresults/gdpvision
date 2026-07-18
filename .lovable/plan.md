## What happened

The Chambers launcher was built on a different route than the one you're viewing:

- Installed on: `/admin/country/ATG` (file `country.$code.tsx`)
- You are on: `/admin/countries/ATG/onboard` (file `countries.$code.onboard.tsx`)

Two separate pages exist for a country, and the launcher only landed on the seldom-used one. That's why the onboarding page you actually land on shows no Chambers grid.

## Plan

### 1. Put the launcher where you actually work

Embed `ChambersLauncher` on `countries.$code.onboard.tsx`, placed directly under the country header/status chips and above the Pipeline Health card — matching the position you described ("below country name and captured data").

### 2. Reorganize the onboarding page header

Current header is a wall of chips + 4 stacked action buttons on the right. Restructure into three clean bands:

```text
┌───────────────────────────────────────────────────────────┐
│  Breadcrumb                                               │
│  Antigua & Barbuda        [Run all pending] [Resume] [⋯]  │
│  ATG · XCD · FY M1 · GDP $2.21B (2024)                    │
├───────────────────────────────────────────────────────────┤
│  Stage chips (Profile · GDP · Sectors · … · Flows)        │
│  — single wrapping row, muted when done, bold when pending │
├───────────────────────────────────────────────────────────┤
│  CHAMBERS (6-tile launcher)                               │
├───────────────────────────────────────────────────────────┤
│  Pipeline health · Sticky status · Stage cards            │
└───────────────────────────────────────────────────────────┘
```

Specifics:
- Collapse the four right-rail buttons into a primary `Run all pending` + a small overflow menu (`Resume one step`, `Rerun all`, `Manage data stores`, `GDP visualizations`). Frees horizontal space and stops the vertical stack.
- Stage chips become one compact wrapping row with consistent width, using the same green/neutral tokens (no oversized boxes).
- Add a thin divider between bands so the eye can group them.

### 3. Retire the duplicate country page

`/admin/country/$code` is now a dead-end duplicate. Redirect it to `/admin/countries/$code/onboard` so any old links keep working and there's one canonical page.

### 4. Chambers tile polish (small)

Keep the icon-led tiles from the previous install, but:
- Use `bg-card` + `border` + hover lift instead of the current flat panel
- 3 columns desktop / 2 tablet / 1 mobile
- Ensure the six routes are wired: National Ledger, Portfolio, Scenario Engine, FDI Studio, Narrative Chamber, Cabinet Room (stubs are fine where routes don't exist yet — they already exist from the earlier install)

## Files touched

- `src/routes/_authenticated/admin/countries.$code.onboard.tsx` — import `ChambersLauncher`, restructure header, add overflow menu
- `src/routes/_authenticated/admin/country.$code.tsx` — replace body with a redirect to `../countries/$code/onboard`
- No new components; reuse the existing `ChambersLauncher`

## Out of scope

- No changes to onboarding pipeline logic, self-heal, or stage runners
- No changes to Chambers destination routes themselves
