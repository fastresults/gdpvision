## Goal
Add a beautiful, icon-led launcher grid on the country admin page (`/admin/country/$code`) that appears right below the country name + summary line (users bound / pending requests), giving the admin one click to enter each of the six chambers.

## Where it goes
File: `src/routes/_authenticated/admin/country.$code.tsx`

Insert a new `<ChambersLauncher countryCode={code} />` section between the existing header block (`<section>` at ~line 154) and the `<Requests …/>` block (~line 165). No other layout changes.

## The six chambers (icon + title + one-line + destination)

| # | Icon (lucide) | Title | One-liner | Link (typed `<Link to=…>`) |
|---|---|---|---|---|
| 01 | `BookOpen` | The National Ledger | Authoritative decomposition of the national economy. | `/admin/countries/$code/data` (params: `{ code }`) |
| 02 | `Layers` | Portfolio Workspaces | One workspace per ministerial portfolio. | `/instrument/portfolio` |
| 03 | `Activity` | The Scenario Engine | Consequence-free rehearsal across every downstream metric. | `/instrument/scenarios` |
| 04 | `TrendingUp` | The FDI Transition Studio | Replacement plan for the CBI wind-down, sector by sector. | `/instrument/studio/packages` (route: `studio.packages.tsx`) |
| 05 | `MessageSquare` | The Narrative Chamber | Signal to statement inside a working day. | `/narrative` |
| 06 | `LandPlot` | The Cabinet Room | Consolidated national view, Session Mode, commitments register. | `/instrument/cabinet` |

Icon set is small and consistent (all from `lucide-react`, `strokeWidth={1.5}`). If a route id above doesn't match a filename exactly, swap to the matching typed `to=` value at build time — this is a naming pick, not a scope change.

## Visual spec (icon-led lighter tiles)

- 3-column grid on `md+`, 2-col on `sm`, 1-col on mobile. `gap-3`.
- Each tile: `border border-line-200 bg-paper-0 p-5` with `hover:border-ink-950 hover:-translate-y-0.5 transition` and focus ring using `focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-500`.
- Tile content, top to bottom:
  1. Row: 32px icon in a `w-9 h-9` square (`border border-line-200`, currentColor icon) + tiny `font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500` chamber number ("CHAMBER 01").
  2. `font-serif text-lg mt-4` title.
  3. `mt-1 text-sm text-ink-500` one-line description.
  4. Trailing `ArrowUpRight` icon in the top-right corner, `text-ink-500 group-hover:text-ink-950`.
- Whole tile is a single `<Link>` with `group` class — no separate CTA button.
- No numbered accent bars, no bullet lists (keeps it "lighter" per selected style).

## Section header

Directly above the grid:
```
<div className="flex items-baseline justify-between">
  <h2 className="font-serif text-2xl">Enter a chamber</h2>
  <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-500">Six workspaces · one country</span>
</div>
```

Wrap the grid in a `<section className="space-y-6">` so it inherits the page's `space-y-16` rhythm cleanly.

## Implementation notes (technical)

- Define the six-entry array locally inside `country.$code.tsx` (or a colocated `ChambersLauncher.tsx` under `src/components/admin/`). Keep it a static const — no data fetching.
- Import icons individually from `lucide-react` (tree-shakable).
- Use `<Link to="/…" params={…}>`; for the Ledger tile, pass `params={{ code }}`. Do not use `<a href>`.
- Do not add hash anchors; each tile navigates to an existing route.
- No changes to loaders, queries, or server functions.
- No color additions to `src/styles.css` — reuse existing `ink-*`, `line-*`, `paper-*`, `gold-*` tokens already in the file.

## Out of scope

- No changes to the onboarding page badges (already handled).
- No changes to the six destination routes themselves.
- No permission gating beyond what the existing `_authenticated/admin` layout already enforces.
