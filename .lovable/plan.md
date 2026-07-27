## Problem

The "The Moment" section cycles through eight exposures (CBI Cliff, One Storm from Zero, Tourism Trap, Cut Off from the System, The Debt Ceiling, Powering Uncompetitiveness, Regulated Out of the Game, The Talent Drain), but the accent illustration is hard-coded to a single asset (`section-moment.jpg`), so all eight show the same harbour sketch.

## Plan

**1. Generate eight illustrations in the house style**

Each rendered with the canonical engraved-graphite prompt from `docs/illustration-contract.md` — monochrome, hand-drawn, no colour, no text, white ground — so they sit in the same family as the existing set. Subject per threat:

- CBI Cliff — a passport/seal ledger at the edge of an eroding cliff shelf
- One Storm from Zero — a barometer and storm-swept palm over a low coastline
- Tourism Trap — a single cruise liner dwarfing a small quay
- Cut Off from the System — severed telegraph/cable lines between two shores
- The Debt Ceiling — a stacked-weights balance scale pressing on a vaulted ceiling
- Powering Uncompetitiveness — diesel generator and transmission pylons on an island ridge
- Regulated Out of the Game — a wax-sealed edict and gavel over a chart of the region
- The Talent Drain — a departure gangway, figures boarding, an emptying schoolhouse behind

**2. Upload as CDN assets**

Written to `src/assets/illustrations/threat-<id>.jpg.asset.json` via the assets CLI; no binaries left in the repo.

**3. Wire the data**

Add an optional `illustration` field to the `ExistentialThreat` interface in `src/lib/existential-threats.ts` and set it on all eight entries, importing the pointer JSON.

**4. Render per-threat**

In `src/components/marketing/MarketingHome.tsx`, the moment section's `<Illustration>` reads `moment.illustration ?? illMoment.url`, keeps the current size/placement (320–384px, two-column layout), and gains a `key={moment.id}` so it cross-fades with the existing `animate-in` transition when Previous/Next is pressed. Alt text set from the threat title, since these carry meaning now.

**5. Verify**

Screenshot the section across all eight states at desktop and mobile widths to confirm each image loads, matches the style, and the layout holds.

### Technical notes

- No change to the `<Illustration>` component, the illustration contract, or any other section.
- `docs/illustration-contract.md` gets a one-line note that per-threat variants live under `src/assets/illustrations/threat-*`.
