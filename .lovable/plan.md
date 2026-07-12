## Goal

Replace the fixed hero paragraph in `src/components/marketing/MarketingHome.tsx` (line 98) with a rotating copy block drawn from the eight "Existential Threats to Caribbean GDP Inflows". On every page load, block #1 (The CBI Cliff) is shown first; blocks #2–#8 shuffle so each visitor sees a different threat highlighted next to the CBI framing.

## Behavior

- On mount, the hero shows two stacked copy blocks in the left column of the existing hero grid:
  1. **The CBI Cliff** (always first, always in the same slot).
  2. One randomly selected block from #2–#8 (Storm, Tourism, Correspondent banking, Debt, Energy, Regulation, Talent).
- Randomization runs once per page load in a `useEffect` (client only) to avoid SSR/CSR hydration mismatch — the SSR pass renders the CBI block plus a stable fallback (block #2, "One Storm from Zero"); the client swaps in the random pick after hydration.
- Each block renders with the same visual treatment already used on line 98 (`mt-8 max-w-xl text-[17px] leading-relaxed text-ink-700 md:text-[21px]`) and gets a small mono eyebrow above it with the threat's title, matching the existing `font-mono text-[11px] uppercase tracking-[0.22em] text-ink-500` styling.
- No other hero elements change: the `GDPVision · v1.0` eyebrow, `h1`, gold rule, and the two CTAs (`Request a Cabinet briefing`, `See the instrument ↓`) stay exactly where they are.

## Implementation

1. **New file** `src/lib/existential-threats.ts` — exports a typed array of the eight threats (`{ id, title, body }`), copy pulled verbatim from the brief. `id: "cbi-cliff"` is index 0; the other seven follow in the order given.
2. **Edit** `src/components/marketing/MarketingHome.tsx`:
   - Import the threats array and `useEffect`, `useState`.
   - Add a `useThreatOfTheDay()` local hook (or inline state) that:
     - Initializes to `THREATS[1]` (stable SSR value).
     - On mount, sets state to `THREATS[1 + Math.floor(Math.random() * 7)]`.
   - Replace the hard-coded `<p>` on line 98 with a fragment that renders the CBI block first, then the rotating block, each with an eyebrow (`<div>` mono label) + `<p>` body.
3. No route, data, or backend changes. No new dependencies.

## Out of scope

- Persisting which block a returning user last saw (spec says randomize per load).
- Weighting the rotation, A/B tracking, or analytics events.
- Changing the `h1`, CTAs, right-column visual, or any downstream section.
- Editing copy anywhere else on the page.

## Files touched

- `src/components/marketing/MarketingHome.tsx` (edit hero block only).
- `src/lib/existential-threats.ts` (new, data-only).
