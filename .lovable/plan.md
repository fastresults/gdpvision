## Change

Only **one** copy block shows in the hero at a time. Start with The CBI Cliff, then auto-rotate through the other seven threats every 2.5 seconds, looping forever.

## Behavior

- On mount: render The CBI Cliff (title eyebrow + body).
- After 2.5s: swap to a randomly ordered sequence of the remaining seven threats (Storm, Tourism, Correspondent banking, Debt, Energy, Regulation, Talent). Each is shown for 2.5s.
- After the seventh, restart from The CBI Cliff and reshuffle the tail — the CBI block always leads each loop; the order of the other seven is re-randomized each cycle so no visitor sees the same sequence twice.
- SSR renders The CBI Cliff (stable, no hydration mismatch). The interval and shuffling run only in `useEffect` on the client.
- Smooth cross-fade between blocks (~250ms opacity transition) so the swap doesn't jar. Respects `prefers-reduced-motion` by disabling the fade (instant swap, rotation still runs).
- Container reserves min-height so shorter/longer blocks don't reflow the hero and shift the CTAs.

## Implementation

Edit `src/components/marketing/MarketingHome.tsx`:

1. Replace the two stacked blocks with a single `<div>` slot showing `current.title` + `current.body`.
2. Local state:
   - `index` starts at 0 (CBI).
   - `tail` starts as `null`; on first `useEffect` run, build a shuffled copy of `EXISTENTIAL_THREATS.slice(1)` and store it.
   - `setInterval(2500ms)` advances `index`; when `index` wraps back to 0, reshuffle `tail`.
   - Clear interval on unmount.
3. `current = index === 0 ? EXISTENTIAL_THREATS[0] : tail[index - 1]`.
4. Wrap the block in a `key={current.id}` div with a `transition-opacity duration-250` fade-in class (mounted per key change). Wrap in a `motion-reduce:transition-none` variant.
5. Set `min-h-[<computed>]` on the container so the tallest block fits without reflow — use a Tailwind `md:min-h-[280px] min-h-[240px]` pair calibrated to the longest body (Storm/Debt).

No changes to `src/lib/existential-threats.ts`, no other files, no new deps.

## Out of scope

- Pause on hover, manual next/prev controls, dot indicators.
- Persisting position across page loads.
- Changing the `h1`, CTAs, right-column visual, or any other section.
