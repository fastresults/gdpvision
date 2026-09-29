# Data & Decision Flow — full-screen explorable map

## What the visitor gets
1. A centred **"Data & Decision Flow"** button (btn-secondary) directly beneath the homepage sector ring / Second Brain illustration.
2. Pressing it opens a **full-screen modal** holding one large, animated, hand-drawn graphite flow diagram — "The National Decision Engine" — that shows how every part of GDPVision works together to make government decisions faster and better, and how that lifts GDP.

## Creative approach (recommended)
A left-to-right "engine room" drawn in the house graphite style, read as five bands, like a well-engineered schematic:

```text
 SOURCES  ->  SECOND BRAIN  ->  TEN CHAMBERS  ->  DECISIONS  ->  GDP OUTCOMES
 public data   Corpus + Vault    01 Ledger ... 10   Cabinet,       efficiency,
 ministries    dedup, citations  Sector Studio      Compacts,      investment,
 KPIs, uploads grades, Explain   (grouped by job)   delivery       elevation
        ^------------------ feedback: results re-enter as evidence ---------|
```

- **Band 1 — Evidence in:** public statistics, ministry profiles, KPIs, capital flows, manifestos, uploads, peer (Caribbean) benchmarks, 20-stage country onboarding.
- **Band 2 — Second Brain:** Corpus (deduplicated, cited, graded) and the Sovereign Vault (state-owned private data; only approved findings leave). Safeguards shown: citations, Explain, no duplicates, national control.
- **Band 3 — Ten Chambers**, grouped by purpose: Understand (01 Ledger, 02 Portfolios), Rehearse (03 Scenarios, 04 FDI Studio, 07 Persona Lab), Decide (06 Cabinet Room, 08 Mandate Compact, 05 Narrative), Deliver (09 Digital Government, 10 Sector Studio).
- **Band 4 — Decisions:** Decision Brief, Cabinet decisions, commitments, investor packages / OC4IDS syndication.
- **Band 5 — GDP outcomes:** less decision delay, better-targeted spending, investment attracted, delivery tracked — labelled as a pathway, never a forecast.
- **Return loop:** a gold feedback line carries delivery results back into the Corpus (The National Record / Global view).

Motion: evidence particles travel along drawn paths band by band (about 9s), the completed map holds 3 seconds, then replays while open — matching the other page animations. Gold is used only for the authorised decision route and GDP outcome.

Interaction: clicking or focusing any node pauses the flow, highlights its connected paths and opens a side panel with plain-language "What it does / What it feeds / Why it matters for GDP", plus a link to the relevant public page where one exists. Filter chips ("Show the path of: Evidence / Safeguards / Money / Delivery") highlight one route at a time. Escape or the close button exits.

Accessibility and devices: reduced motion shows the complete still map; on phones the map becomes a vertical stack of bands with the same panel; a hidden text outline lists every node and connection for screen readers.

## Technical details
- New `src/components/marketing/DataDecisionFlow.tsx` (SVG, node/edge data array, in-view replay timer, pause on engagement) and `DataDecisionFlowDialog.tsx` using existing `@/components/ui/dialog` styled full-screen (`max-w-none h-dvh w-screen`), paper/ink tokens only.
- Add `ddf-*` keyframes and reduced-motion rules to `src/styles.css`.
- `MarketingHome.tsx` line ~337: wrap `<SignatureRing>` so the button sits centred beneath it (accounting for the ring's -translate-y-1/4 offset).
- Verify with Playwright: open/close, replay with 3s hold, node panel, mobile stack, reduced motion, no console errors.
