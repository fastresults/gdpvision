# Put a "By Chamber" entry on the homepage, above the fold

## What you will see

Two engraved plates side by side in the homepage hero, both fully visible the moment the page loads — no scrolling:

```text
┌───────────────────────────────┐   ┌───────────────────────────────┐
│  ◎  DATA & DECISION FLOW      │   │  ▦  BY CHAMBER                │
│     Engage the National       │   │     Follow one decision       │
│     Decision Engine           │   │     through its Chamber       │
└───────────────────────────────┘   └───────────────────────────────┘
        opens the national map              opens the twenty
                                            chamber journeys
```

Clicking either plate opens the same full-screen presentation, already in that view. The "National system / By Chamber" tabs stay inside the dialog, so you can switch once it is open.

## How it works

- One dialog, two entries. Both plates live inside the same dialog container, so opening is instant and the view you clicked is the view you land in — no landing on the national map and hunting for a tab.
- The engraved plate look is unchanged: same graphite border, gold inner frame, corner etchings, gold shadow on hover, reduced-motion respected. Only the emblem differs — the lens for the national view, a small ten-cell grid for the chamber view — so the pair reads as siblings, not duplicates.
- The existing caption under the plates becomes a single shared line so it is not repeated twice.

## Above-the-fold placement

The current plate sits at about 854px down a 936px window, so only its top edge shows. To bring both plates into the first view:

- Trim the hero's vertical padding slightly.
- Make the circular ring behind them smaller (480 → about 400) and reduce the upward pull, so the row of plates rises.
- Place the two plates side by side rather than stacked, so adding the second one costs no extra height.

Verified at your current window (1399 × 936) and at a 1280 × 800 laptop; on phones the pair stacks and the ring hides, as it does today.

## Copy

| Plate | Headline | Supporting line |
| --- | --- | --- |
| National | Data & Decision Flow | Engage the National Decision Engine |
| By Chamber | By Chamber | Twenty scenarios — two for every Chamber |

## Technical details

- `src/components/marketing/DataDecisionFlowDialog.tsx`: extract the plate markup into an internal `FlowLensPlate` component taking `mode`, `headline`, `caption` and an `emblem` variant; render two `DialogPrimitive.Trigger` elements inside the existing single `DialogPrimitive.Root`, each with `onClick={() => setMode(mode)}` so the dialog opens in the chosen mode. Default state stays `"national"`. Dialog title, description and the in-dialog tabs are unchanged.
- `src/components/marketing/MarketingHome.tsx` (hero, `section#top`): reduce `md:py-24` to `md:py-16`, change `SignatureRing size={480}` to `400`, and relax the `-mt-24` pull so the plate row sits higher. Both plates render from the one dialog component, placed side by side in a two-column row that collapses to one column on narrow screens.
- No new styles beyond an emblem variant; `btn-flow-lens`, `btn-ghost` and `btn-filter-active` are reused as-is, so the button contract holds.
- No database, route or server-function changes; `bun run check:maps` is unaffected.
- `roadmap.md`: add and tick the entry-point item.

## Verification

1. Playwright at 1399 × 936 and 1280 × 800: both plate bounding boxes sit fully inside the viewport with no scrolling; screenshot each.
2. Click "By Chamber": the dialog opens with the "By Chamber" tab active and the chamber sidebar (featured cards, Chamber 01–10 selector, scenario list) visible.
3. Click "Data & Decision Flow": the dialog opens on the national map.
4. Phone width 390: plates stack, document width equals viewport width, no horizontal overflow.
5. `bun run lint` and `bunx tsgo --noEmit` on touched files, plus the preview build log.
