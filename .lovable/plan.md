## Chamber 01 — The National Ledger

Right now "National Ledger" on the launcher points at `/admin/countries/$code/data`, which is a data-management console (tabs for Sources / KPIs / Dossiers / Ministries / Corpus / Second brain / Viz). That's the workbench, not the chamber. The chamber must be a **read-first, evidence-anchored, cinematic view of the country's economy** — the surface a Minister opens on a Monday morning.

### What each chamber must do (framework)

Every chamber has the same skeleton and inherits the same shell:

1. **Ceremonial header** — country crest, name, live "as-of" clock, headline figure, one-line stewardship state.
2. **Hero visualization** — one signature chart that answers the chamber's single question.
3. **Answer bar** — 3–5 pinnable numbers with confidence grade and last-verified date.
4. **Evidence rail** — right-side sticky column of citations for whatever is on screen.
5. **Ask this chamber** — natural-language box that queries only the chamber's slice.
6. **Deep dives** — 3–4 expandable sections with domain-specific data views.
7. **Handoff dock** — buttons to send the current view into Scenarios, Narrative, or Cabinet.

The National Ledger is the reference implementation. The other five chambers will inherit the shell.

### Chamber 01 — the single question

> "What is our economy made of right now, how confident are we in that, and where is it going?"

### Route & wiring

- New route: `/admin/countries/$code/ledger` (file `countries.$code.ledger.tsx`).
- Update `ChambersLauncher` tile #01 to point here.
- `/admin/countries/$code/data` stays — repurposed as "Manage data stores" (already linked from the onboard overflow menu).

### Screen composition

```text
┌──────────────────────────────── Ceremonial header ────────────────────────────────┐
│  Crest  Antigua & Barbuda        GDP  $2.21 B  (2024, A-grade)   ⏱ as of 08:14  │
│  ATG · XCD · fiscal year starts Jan · CBI state · 12/12 pipeline committed        │
└───────────────────────────────────────────────────────────────────────────────────┘

┌──── Hero: Composition of the economy ─────────────────┐  ┌── Evidence rail ─────┐
│  Interactive treemap (sectors sized by GDP share).    │  │  Live citations for  │
│  Hover → sector card. Click → deep-dive drawer.       │  │  every figure on     │
│  Time-slider bottom: 2019 → 2024, tween shares.       │  │  screen. Grouped by  │
│                                                       │  │  ministry / period.  │
│  Answer bar under hero:                               │  │  Click → source      │
│  [ GDP $2.21B ] [ Real growth +5.1% ] [ CBI 22% of   │  │  modal with quote,   │
│   revenue ] [ Debt/GDP 78% ] [ Reserves 4.2 mo ]     │  │  URL, retrieved-at.  │
└───────────────────────────────────────────────────────┘  └──────────────────────┘

┌──── Ask the Ledger ────────────────────────────────────────────────────────────┐
│  > "How much of GDP is tourism and how has it moved since 2019?"                │
│  Answer streams with inline [1][2] citation refs into the evidence rail.        │
└─────────────────────────────────────────────────────────────────────────────────┘

┌── Deep dive 1 ─────────────┐  ┌── Deep dive 2 ─────────────┐
│  Sector detail             │  │  Capital flows sankey      │
│  (uses GdpTreemap +        │  │  (uses SovereignSankey)    │
│  KpiSmallMultiples per     │  │  Inputs → Government →     │
│  selected sector)          │  │  Outflows                  │
└────────────────────────────┘  └────────────────────────────┘

┌── Deep dive 3 ─────────────┐  ┌── Deep dive 4 ─────────────┐
│  Ministry × Sector heatmap │  │  Debt & fiscal horizon     │
│  (MinistrySectorHeatmap)   │  │  (DebtHorizon +            │
│                            │  │  MacroStrip)               │
└────────────────────────────┘  └────────────────────────────┘

┌──── Handoff dock (sticky) ─────────────────────────────────────────────────────┐
│  [ Rehearse this in Scenarios → ]  [ Draft a statement → ]  [ Send to Cabinet ]│
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Data sources (already exist — no new backend)

- `getInstanceOverview`, `getSectorDetail`, `getExposureHistory` — hero + answer bar.
- `getLedgerEnrichment`, `getTrustSignals`, `getReconciliationReport` — trust chips + evidence.
- `askTheLedger` (streamed) — Ask box.
- `getSourceHealth`, `listFigureSnapshots` — evidence rail.
- Viz components: `GdpTreemap`, `SovereignSankey`, `MinistrySectorHeatmap`, `DebtHorizon`, `MacroStrip`, `KpiSmallMultiples`.
- Ledger components: `WhyThisNumberPanel`, `TrustSignals`, `LedgerEnrichments`, `AskTheLedger`.

All chamber pages will use TanStack Query `ensureQueryData` in the loader and `useSuspenseQuery` in the component.

### Award-winning design system for chambers

Reuse existing tokens (`paper-0`, `ink-950`, `line-200`, `gold-500`, serif display, mono labels) with these chamber-specific rules:

- **Typography**: Serif hero numbers at 72px+ (`font-serif tabular-nums`), mono for labels and units, sans for prose. Numbers get an underline-on-hover that opens `WhyThisNumberPanel`.
- **Color**: Neutral paper background, one accent per chamber (Ledger = gold). Sector colors reuse `sector-color.ts` for continuity across charts.
- **Motion**: 300ms ease-out on chart mounts; treemap tiles morph on time-slider drag (Framer Motion `layout`); numbers count-up on first paint (`useReducedMotion` respected).
- **Trust chips**: Every figure carries a confidence letter grade (A/B/C/D) as a small square swatch; A = filled ink, D = outlined muted. Same visual vocabulary already used in the codebase.
- **Empty & partial states**: If a KPI is missing, show a discreet "Not yet ledgered — request via onboarding" affordance instead of an error.
- **Print/export**: `@media print` renders the hero + answer bar + evidence rail as a one-page briefing.

### Files touched

New:
- `src/routes/_authenticated/admin/countries.$code.ledger.tsx` — Chamber 01 page
- `src/components/chamber/ChamberShell.tsx` — reusable ceremonial header + evidence rail + handoff dock (basis for chambers 02–06)
- `src/components/chamber/AnswerBar.tsx` — pinnable-number strip
- `src/components/chamber/HeroTreemap.tsx` — treemap + time slider wrapper around `GdpTreemap`
- `src/components/chamber/AskThisChamber.tsx` — thin wrapper around `askTheLedger`

Edited:
- `src/components/country/ChambersLauncher.tsx` — retarget tile 01 to `/admin/countries/$code/ledger`

Out of scope for this pass:
- Chambers 02–06 (built next once the shell is proven on 01)
- Any new server functions or schema changes
- Write actions on the chamber page (writes still live in Manage data stores)

### Acceptance

- Ledger page loads without loaders in the header ("as-of" clock present).
- Treemap renders sectors for ATG at correct shares and animates across 2019–2024.
- Every visible figure has a confidence chip and at least one citation reachable in ≤2 clicks.
- Ask the Ledger streams an answer with citation refs that highlight the correct evidence-rail entries.
- Lighthouse a11y ≥ 95; reduced-motion honored; page prints as one clean briefing.
