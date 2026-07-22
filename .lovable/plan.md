## What's wrong (honest critique of the current screen)

Looking at the ATG view-as capture, this is the country user's very first impression of the instrument and it currently fails on five counts:

1. **Dead hero.** A raw flag rectangle floats beside a heading with a huge empty gutter between them. No framing, no country data, no sense of place. It looks like a stock template, not a national instrument.
2. **The Concierge slab is a black void.** A full-width `bg-ink-950` band is 95% empty. Copy hugs the left edge, the CTA hugs the right, and the middle is a wasteland. It reads as "something is broken" more than "premium invitation".
3. **No signal, no numbers.** For a "sovereign decision instrument", the landing screen shows zero data — no GDP, no fiscal snapshot, no last-updated stamp, no active chambers indicator. An executive lands here and learns nothing about their country.
4. **Weak hierarchy.** Section titles ("Enter a chamber") are the same weight and rhythm as body copy. Nothing pulls the eye. Everything is muted blue-gray on cream — beautiful in a mood board, invisible in a working screen.
5. **Chamber grid (below the fold) is a uniform card set** without any visual differentiation between chambers, no state (populated / empty), no last-used breadcrumb, no primacy for the National Ledger which should anchor the day.

The type ramp (Fraunces + IBM Plex) and the paper/ink palette are strong. The composition is not using them.

## Redesign plan — one screen, three moves

### Move 1 — Replace the hero with a "State of the Nation" masthead

Restructure the top section as an editorial masthead, inspired by a printed Cabinet brief:

```
┌───────────────────────────────────┬────────────────────────────────┐
│ ANTIGUA AND BARBUDA · TUE 22 JUL  │  GDP (2024)    2.11 B USD     │
│                                   │  YoY           +5.4%           │
│ Welcome, Prime Minister.          │  Fiscal        Balanced        │
│                                   │  Corpus        342 sources     │
│ Your instrument is current as of  │  Chambers      7 / 7 live      │
│ 09:42 today. Four items need      │                                │
│ your eye.                         │  ─── last committed 09:42 ──── │
└───────────────────────────────────┴────────────────────────────────┘
```

- Flag becomes a small heraldic mark (~64px) beside the country name in the eyebrow, not a giant photo block.
- Behind the masthead, a subtle full-bleed watercolor wash tinted with the flag's dominant color (via `color-mix` against paper-0). Adds gravitas without shouting.
- Right rail is a live "brief strip" pulling from `country_kpis` / `country_source_documents` counts. Every number is tabular-nums, hairline-ruled between rows. Reads like a Cabinet briefing note.
- Below the masthead, a single-line "attention band": tiny row of chips showing pending items ("2 Concierge deliverables ready · 1 new Signal · Cabinet meets Thursday") that deep-link into the relevant chamber.

### Move 2 — Concierge tile becomes an "invitation card", not a slab

Kill the full-width `ink-950` band. Replace with a bordered, framed card that behaves like a folded correspondence:

- Uses paper-0 background with a thin ink-950 border and a heavy ink-950 seal/rule at the top.
- Left column: an italic Fraunces line ("Would you rather have us handle it?") followed by 2 lines of quiet body copy.
- Right column: a stacked mini-list of the requester's last two Concierge threads (or, if none, three example asks scoped to their country in italic pale ink).
- CTA is a filled ink-950 pill *inside* the card, not a ghost outline pushed to the edge.
- The card sits at ~7/12 width, aligned with the masthead's left column — leaves right-side breathing room and stops looking like a broken banner.

### Move 3 — Chambers become a "sovereign switchboard", not a card grid

Keep seven tiles but restructure them:

- **Chamber 01 (National Ledger) gets 2× width** at the top — it is the daily anchor. Preview strip inside it renders a single sparkline of GDP momentum from the second brain.
- Remaining six chambers arrange 2×3 below in a hairline grid (border-only, no shadows), each tile:
  - Numeric monogram (large Fraunces "02", "03"…) as the visual anchor, not the lucide icon.
  - Chamber title in Fraunces, one-line blurb in Plex Sans.
  - Bottom-strip meta: "Last used 3 days ago · 12 active items" (populated from real per-chamber counters when available, hidden otherwise — never fake).
  - Hover reveals a thin ink-950 rule underneath the title and a right-arrow, replacing the current "lift + border" hover which feels e-commerce.
- Icons move to a small mono-monochrome mark in the top-right corner of each tile (12px) — support, not headline.
- Add a single-row footer under the switchboard: `Signed in as [name] · Country binding: ATG · Instrument version 1.4 · Last corpus sync 08:12`. Anchors the screen in a working-instrument feel.

## Styling contract (locked, applied everywhere)

- Palette stays paper/ink; add one accent: **ink-950 with a hairline gold-500 rule** used sparingly (masthead ruler, ledger tile top-border, active-chamber marker). No new colors introduced.
- Type ramp:
  - Masthead headline: Fraunces 500 · 56/60 · tracking-tight.
  - Section labels: IBM Plex Mono 500 · 10 · uppercase · tracking-[0.25em].
  - Numeric block: tabular-nums, IBM Plex Mono for units, Fraunces for the number itself.
- Rhythm: everything sits on an 8px baseline, section gaps at 96px, card padding at 32px. No arbitrary spacings.
- Motion: on load, the brief-strip numbers count up from 0 in 400ms (framer-motion, existing dep). Masthead ruler draws left-to-right in 600ms. Nothing else animates.
- Empty state contract: any tile whose data isn't in the corpus yet renders a hairline "— not yet on record" placeholder in mono, never a fake number.

## Files touched

- `src/routes/_authenticated/home.tsx` — replace `CountryAdminWelcome` body with masthead + concierge card + switchboard composition.
- `src/components/country/ChambersLauncher.tsx` — restructure to feature-01 + 2×3 grid, drop screenshot backgrounds, add per-chamber meta strip.
- new: `src/components/country/CountryMasthead.tsx` — masthead + brief strip + attention band.
- new: `src/components/country/ConciergeInvitationCard.tsx` — the reworked concierge tile.
- new: `src/lib/country-home/summary.functions.ts` — one server fn that returns `{ gdp, yoy, fiscal_state, corpus_count, chambers_live, last_commit_at, attention_items[] }` for the masthead. Backed by existing tables (`country_kpis`, `country_source_documents`, `service_request_deliverables`, `narrative_feed_items`, `cabinet_sessions`).

## Out of scope

- No new palette, no new fonts, no marketing copy rewrite beyond the masthead lead line.
- Chamber internals are untouched — this is landing-screen only.
- Super-admin welcome and multi-country picker views stay as-is.
