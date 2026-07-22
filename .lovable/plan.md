## Goal

Kill the hamburger. On mobile (and everywhere else), the minister sees one thing at a time and has exactly four rails, always visible, no menus to open:

1. **Study** — dashboard: In-flight + Delivered
2. **Ask** — question the Second Brain
3. **Send** — start a request to the agency
4. **Sign out** (tucked in Study header, not a nav rail)

No hamburger. No drawer. No hidden options.

## Changes

### 1. `src/routes/_authenticated/console.tsx` — remove hamburger, add bottom tab bar

- Delete the `Menu`/`X` button, the `menuOpen` state, and the entire mobile drawer block.
- Header (mobile + desktop) becomes: Wordmark + CountryChip on the left, nothing on the right. No nav links in the header at all on mobile; keep a compact desktop nav (≥ md) as-is minus the "Start a request" button (moved into the tab bar / Study hero).
- Add a **fixed bottom tab bar** rendered on all viewports ≤ md, three equal tabs:
  - Study (home icon) → `/console/$code`
  - Ask (message icon) → `/console/$code/ask`
  - Send (send icon, primary-styled pill) → `/console/$code/request/new`
- Bar uses `safe-bottom`, `min-h-[64px]`, `btn-*` utility tokens only. Active tab uses `text-ink-950` + top hairline; inactive `text-ink-500`. No color drift — all tokens from the button contract.
- `<main>` gets `pb-24 md:pb-10` so the tab bar never covers content.
- Move Sign out into the Study page header (small ghost link) so it stays reachable without a menu.

### 2. `src/routes/_authenticated/console.$code.index.tsx` — Study as the whole dashboard

Restructure to exactly three stacked blocks, in this order, nothing else:

1. **Hero strip** — Country name + one line of context + Sign out (top-right ghost).
2. **In-flight** — every request not yet Delivered. Card list, each row shows: title, chamber label in plain language (from `minister-lexicon.ts`), status pill, and elapsed time in days & hours. Empty state: "Nothing in flight — tap Send to start a request."
3. **Delivered** — completed requests, most recent first, same card shape with turnaround time. Empty state: "No deliveries yet."

Remove any other CTAs, chamber grids, or secondary launchers from this page. The Requests index route stays as a deep-link target, but Study is the canonical dashboard.

### 3. Wire the existing data

- Reuse the queries already powering `console.$code.requests.index.tsx` (in-flight vs delivered filter) — no new server functions.
- Turnaround formatting comes from the existing helper used on the Requests screens.

### 4. Tab bar semantics

- Only three tabs. "Requests" is not a separate rail anymore — In-flight and Delivered live on Study; tapping any card deep-links to `/console/$code/requests/$id`.
- The Send tab visually pops (filled `btn-primary` treatment) because it's the one action we want the minister to take.

## Out of scope

- No changes to Ask flow, deep research, or request detail screens.
- No visual redesign of cards beyond the layout consolidation above.

## Technical notes

- Files touched: `src/routes/_authenticated/console.tsx`, `src/routes/_authenticated/console.$code.index.tsx`.
- No new dependencies. Icons from `lucide-react` already in use.
- All colors via `btn-*` utilities and registered theme tokens (paper/ink/line/gold) — per the Button Contract memory.
- Global scroll-to-top rule already handles route changes; no extra work needed.
