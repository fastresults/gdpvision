## Goal

Clicking a chamber card on the Executive Brief no longer drops the Principal into the working chamber. It opens a **Chamber Room Sheet** — a one-screen macro + micro read of that chamber — with a single unmistakable "Enter the chamber" action to continue.

## Current behaviour (verified)

- `ChamberCard` is itself a `<Link to={chamber.to}>` pointing straight at `/admin/countries/$code/<chamber>`. The hover overlay's "Enter chamber →" is decorative — the whole card is the link.
- `getExecutiveDashboard` returns per-chamber `ChamberSummary`: 3 KPIs, a 30-day tempo array, `last_activity_at`, one `next_due`, 3 `recent` lines, and `alerts` with `because` reasoning. Enough for the card; not enough for a full sheet.
- `AttentionRail` items also link straight into chambers.

## The Chamber Room Sheet

A dedicated route, not a modal — the Principal must be able to bookmark it, print it, and forward the URL to a minister.

- `/console/$code/chamber/$chamber` — console (country principal, mobile-first)
- `/admin/countries/$code/executive/chamber/$chamber` — same component inside the agency shell for super admins

Layout, top to bottom, one screen on desktop, one scroll on mobile:

1. **Sheet head** — chamber numeral, name, owning office, health rule (same tone colours as the card), last activity, and one plain-English verdict line: *"Steady — nothing awaits you"* / *"Two items await your decision."*
2. **Macro band** — the chamber's headline KPIs at display scale (the 3 card KPIs plus up to 3 more the resolver already has in hand), each with tone colour, unit, and an "as of" stamp. `tabular-nums`, no chrome.
3. **Tempo panel** — the 30-day sparkline enlarged with axis labels, plus a "work rhythm" read (busiest day, days since last movement, 30-day total).
4. **What awaits you** — full alert list for this chamber (not truncated to the rail's top 5), each with the deterministic `because` arithmetic shown inline. This is the micro view.
5. **Deliverables & dates** — every upcoming due item for the chamber as a dense table (date, item, owner, state), plus the last 10 activity lines as a timeline.
6. **Actions rail (sticky footer on mobile, right column on desktop)** — a single filled `btn-primary` **"Enter the chamber →"**, and secondary ghost actions: "Brief" (print this sheet), "Back to brief".

Design laws carried over from the dashboard: verdict first, typography over chrome, saturation only for state, uniform anatomy across all eight sheets (identical section order regardless of chamber), and quiet chambers render explicitly ("Not yet on record") rather than blanking.

## Data

- New `src/lib/executive/chamber-detail.functions.ts` → `getChamberDetail({ country_code, chamber })`, protected with `requireSupabaseAuth`, called from the component via `useServerFn` + `useQuery` (never a public loader).
- Extend each resolver in `resolvers/core.server.ts` and `resolvers/office.server.ts` with an optional `detail` producer returning: `kpis_extended`, `due[]` (full list), `recent[]` (10), `alerts[]` (full). Where a resolver has no extra depth yet, the detail falls back to the summary payload so all eight sheets ship at once.
- New `ChamberDetailDTO` in `src/lib/executive/types.ts`, plus a `CHAMBER_SLUGS` map (`ledger`, `portfolio`, `scenarios`, `studio`, `narrative`, `cabinet`, `personas`, `mandate-compact`) so route params resolve to a resolver and to the existing `ChamberRoute`.

## Wiring changes

- `ChamberCard` links to the sheet instead of the chamber; its hover overlay label becomes "Open the room sheet →".
- `AttentionRail` items link to the sheet, deep-linked to the alert (`#awaits`), so the reasoning is visible before entering.
- `ChamberLedgerTable` rows link to the sheet too, keeping one destination for every chamber affordance on the brief.
- The only route into a working chamber from the brief is the sheet's primary button.

## Components

New files under `src/components/executive/chamber/`:
`ChamberSheet.tsx` (composition), `SheetHead.tsx`, `MacroKpiBand.tsx`, `TempoPanel.tsx`, `AwaitsList.tsx`, `DeliverablesTable.tsx`, `EnterChamberRail.tsx`. Reuses `tone.ts`, `TempoSparkline`, and the `btn-*` utility contract. Print styles extend the existing `@media print` block so the sheet prints as a one-page chamber briefing.

## Verification

- Click each of the eight cards on `/console/ATG` → sheet loads with correct chamber, KPIs, alerts and dates; no chamber jump.
- "Enter the chamber" lands on the real chamber route; back returns to the sheet, then the brief.
- Quiet chambers (06, 07 on ATG today) render the explicit empty contract, not blanks.
- Typecheck, `bun run headers && bun run map`, and browser screenshots at desktop and mobile widths.
