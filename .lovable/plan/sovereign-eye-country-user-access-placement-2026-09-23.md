# Sovereign Eye — Country-User Access Placement

## Problem

Super admins can already reach Sovereign Eye from the ChambersLauncher tile on the admin country page. Country users — who live in the mobile-first Console (`/console/$code`, 4-tab bottom bar: Brief / Study / Ask / Send) — have **no link to Sovereign Eye anywhere**, even though the route gate (`COUNTRY_SURFACES` includes `"godseye"`) and the `SuperAdminShell` (which shows country users "← Your brief" instead of agency nav) already support their access.

The gap is discoverability, not authorization.

## Recommendation

Add the Sovereign Eye entry point in **two places** in the Console, mirroring the admin side's prominence while respecting the 4-tab design:

### 1. Brief screen tile (primary, mirroring admin placement)

In `src/routes/_authenticated/console.$code.index.tsx`, add a Sovereign Eye tile **between** the `ExecutiveDashboard` and the `RequestLanes` card — the same structural position it occupies in the admin `ChambersLauncher` (between the Executive Brief and the chambers grid).

```
Console Brief tab layout:
┌──────────────────────────────┐
│  Executive Dashboard         │
│  (masthead, attention,       │
│   8 chambers, due ledger)    │
├──────────────────────────────┤
│  ★ Sovereign Eye tile ★      │  ← NEW
│  Strategic map · one tap     │
├──────────────────────────────┤
│  Your requests (lanes)       │
└──────────────────────────────┘
```

The tile uses the same visual language as the admin tile: a small radar icon, "Strategic map" eyebrow, "Sovereign Eye" title, one-line blurb, and an arrow-up-right. It links to `/admin/countries/$code/godseye`. Uses `btn-*` / approved token classes only.

### 2. Console header radar icon (secondary, always-visible quick access)

In `src/routes/_authenticated/console.tsx`, add a small radar icon button in the header (right side, next to the "← All countries" / sign-out area) that links to `/admin/countries/$code/godseye`. This gives one-tap access from **any** Console tab (Brief, Study, Ask, Send), not just the Brief screen.

```
Console header:
┌────────────────────────────────────────────┐
│ [Wordmark] [CountrySwitcher]   [📡] [← All] │
│                               ↑ NEW         │
└────────────────────────────────────────────┘
```

The icon is labeled with `aria-label="Sovereign Eye"` for accessibility.

## Why not other placements

- **5th bottom tab**: The Console design is explicitly "4 rails, no menus." Adding a 5th tab breaks that clean pattern and crowds the bar on mobile.
- **Inside the ExecutiveDashboard chambers grid**: Sovereign Eye is not one of the eight chambers; placing it as a 9th card would muddy the "eight chambers" concept.
- **Only the header icon**: Too easy to miss for a feature this important; the Brief tile gives it proper visual weight on first landing.

## Destination chrome note

When a country user taps either entry point, they land on `/admin/countries/$code/godseye` wrapped in `SuperAdminShell`. The shell already detects country users and shows "← Your brief" instead of agency navigation, so the experience is safe. No new wrapper needed.

## Files to change

1. `src/routes/_authenticated/console.$code.index.tsx` — add the Sovereign Eye tile between ExecutiveDashboard and RequestLanes.
2. `src/routes/_authenticated/console.tsx` — add the radar icon link in the header.

No new routes, no server functions, no migrations. Both are pure presentational additions using existing `Link` components and approved token classes.
