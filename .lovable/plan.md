## Goal

The "The moment" section becomes 8 variants — one per Existential Threat. On every page load, the CBI variant renders first; on subsequent loads it's replaced by a randomly chosen other variant (from the remaining seven). Selection happens once on mount and stays static — the section does NOT rotate on a timer (unlike the hero).

Not in scope: syncing to the hero rotation, changing the hero, adding controls/pagination, animating the Moment section.

## Data

New file: `src/lib/moment-variants.ts`

```ts
export interface MomentStat {
  value: number;
  unit: string;
  label: string;
  grade: "A" | "B" | "C";
  citation: string;
}

export interface MomentVariant {
  id: string;                  // matches ExistentialThreat.id
  eyebrow: string;             // e.g. "The moment"
  title: string;               // headline
  lede: string;                // body copy
  stats: [MomentStat, MomentStat, MomentStat];
}

export const MOMENT_VARIANTS: MomentVariant[] = [ /* 8 entries, cbi-cliff first */ ];
```

Order matches `EXISTENTIAL_THREATS`: `cbi-cliff`, `one-storm`, `tourism-trap`, `cut-off`, `debt-ceiling`, `power-cost`, `regulated-out`, `talent-drain`.

I will draft all 8 in the tone of the current Moment copy (single-sentence cliff headline, ~55-word lede, 3 stats with grade + citation). The current CBI-cliff Moment copy stays as variant #1 unchanged. Stats will use publicly-defensible ranges (IMF Article IV, ECCB, EM-DAT/CCRIF for hurricanes, CARICOM energy stats, World Bank remittances, FATF/EU listings, etc.), each with a B grade unless a hard primary source supports A.

## Component change

Edit `src/components/marketing/MarketingHome.tsx` only:

1. Import `MOMENT_VARIANTS` from `@/lib/moment-variants`.
2. Add a `pickMoment()` helper: returns `MOMENT_VARIANTS[0]` on first evaluation? No — requirement is CBI first each load, THEN random. Correction: every load shows CBI initially is the HERO behavior. For the Moment section the user said "randomize on load, 8 versions." Since the alignment answer maps to the 8 threats CBI-first, we mirror the hero rule: `useState` initializer returns `MOMENT_VARIANTS[0]`; a `useEffect` (client-only, avoids SSR/hydration mismatch) immediately replaces it with a random variant from `MOMENT_VARIANTS.slice(1)`. Result: CBI always paints first, then swaps to a random other variant on the client for the rest of the session. Static thereafter (no interval).
3. Replace the hardcoded `SectionHeader` + 3 `NumberTile`s in the `#problem` section (lines 163–190) with:

```tsx
<SectionHeader eyebrow="The moment" title={moment.title} lede={moment.lede} />
<div className="mt-16 grid gap-12 border-t border-line-200 pt-12 md:grid-cols-3">
  {moment.stats.map((s, i) => (
    <NumberTile key={i} {...s} />
  ))}
</div>
```

No changes to `NumberTile`, `SectionHeader`, existing hero rotation, or any other section.

## Why useEffect (not useState random initializer)

Reading `Math.random()` in the `useState` initializer runs during SSR and produces a hydration mismatch. Initial render = deterministic CBI; effect swaps to a random variant on the client. This also satisfies "CBI always renders first" for crawlers/SEO and briefly for users, matching the hero convention.

## Files touched

- New: `src/lib/moment-variants.ts`
- Edit: `src/components/marketing/MarketingHome.tsx` (imports, small hook, replace the `#problem` section body)
