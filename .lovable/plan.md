## Problem

Chamber 08 (The Mandate Compact) exists as a full workflow (routes, server fns, admin stepper, console view) but is invisible from the country switchboard. `src/components/country/ChambersLauncher.tsx` — the switchboard rendered on `/home`, `/admin/countries/$code`, and `/admin/countries/$code/onboard` — only lists 01–07 and still says "Seven workspaces · one country".

## Audit findings (verified reads)

- `src/components/country/ChambersLauncher.tsx` — `REST` array stops at 07; header copy hard-codes "Seven workspaces · one country"; `Chamber.to` union type has no `/admin/countries/$code/mandate-compact` entry.
- `ChambersLauncher` is mounted in three places (home, admin country overview, onboarding). All three inherit the omission automatically once the launcher is fixed.
- Console (`src/routes/_authenticated/console.$code.*`) already has `console.$code.mandate.tsx` for the citizen-facing Mandate view — good, no change needed there.
- `MarketingHome.tsx` already lists Chamber 08 (fixed last turn). No other "seven chambers/workspaces" copy remains in `src/` besides the launcher header.

## Changes

1. **`src/components/country/ChambersLauncher.tsx`**
   - Add `/admin/countries/$code/mandate-compact` to the `Chamber["to"]` union.
   - Append an 8th tile to `REST`:
     - `n: "08"`, icon `ScrollText` (lucide), title "The Mandate Compact", blurb "Manifesto to delivery — pledges tracked to the ministry.", `to: /admin/countries/$code/mandate-compact`.
   - Update header copy: "Seven workspaces · one country" → "Eight sovereign chambers · one country".
   - Grid stays `lg:grid-cols-3`; with 7 secondary tiles the layout is 3 + 3 + 1. Adjust the `nth-child` divider classes so the trailing single tile on the last row doesn't render a stray right-border on lg, and no bottom-border on the final row on md/lg (small tweak to the border utility string only).

2. **No route changes** — `/admin/countries/$code/mandate-compact` already exists and is fully wired (7-step admin flow: Ingest → Decompose → Transform → Track → Ministries → Publish → History).

3. **No console changes** — the mobile 3-tab bottom bar (Study / Ask / Send) is intentionally scoped; the Mandate Compact citizen view is already reachable at `/console/$code/mandate` from the Study surface.

## Out of scope

- No server-fn, migration, or RLS changes (Chamber 08 backend is already shipped across Slices A–F).
- No marketing site edits (Chamber 08 already present).
- No changes to onboarding stages.

## Acceptance

- Switchboard on `/home`, `/admin/countries/$code`, and `/admin/countries/$code/onboard` shows eight tiles; the 08 tile navigates to `/admin/countries/ATG/mandate-compact` (and every other country code).
- Header on the switchboard reads "Eight sovereign chambers · one country".
- No lint/type errors; grid dividers render cleanly with 1 hero + 7 tiles.
