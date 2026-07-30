# The Sovereign Value Instrument

A featured call-out on `/business-case` opens a dedicated, shareable calculator at `/business-case/calculator`. Sliders on the left, a sticky verdict on the right. The arithmetic is instant and auditable; the AI writes the counsel around it.

## 1. The call-out on /business-case

A full-width bordered panel placed immediately after the Executive Summary (and echoed near "What it is worth"), with a `bc-seal`-style engraving, a one-line proposition — *"What is instrumented decision-making worth to your economy? Model it in ninety seconds."* — and a `btn-primary` **Open the value calculator**. A secondary text link sits in the sticky top nav next to "Business case".

## 2. The calculator: three moves, one number

```text
┌── Step 1 · Your economy ──────────┬─────────────────────┐
│  Country (or manual GDP)          │   STICKY VERDICT     │
│  GDP · population · public spend  │   ─────────────      │
│                                   │   +US$ 412 M         │
├── Step 2 · Four framing questions ┤   GDP uplift, yr 3   │
│  ▸ Decisions per quarter          │                      │
│  ▸ Months from question→decision  │   +0.41 pp growth    │
│  ▸ Share of budget on programmes  │   34× return         │
│    with no measured outcome       │   Payback: 7 months  │
│  ▸ Concentration in top sector    │                      │
├── Step 3 · Eight chamber sliders ─┤   [waterfall bar     │
│  01 Ledger        ▁▃▅▇  ← adopt   │    by chamber]       │
│  02 Portfolios    ▁▃▅▇             │                     │
│  …08 Mandate      ▁▃▅▇             │   AI counsel ▸      │
└───────────────────────────────────┴─────────────────────┘
```

**Step 1 — Your economy.** Pick a Caribbean/SIDS country from a preset list (GDP, population, public spend seeded) or enter GDP manually. This anchors everything in real currency, not abstractions.

**Step 2 — Four questions, four sliders.** Each is a plain-language question a Principal can answer from memory: decision cadence, decision latency, unmeasured programme share, single-sector concentration. These set the *size of the addressable loss* — the pool the instrument can act on.

**Step 3 — Eight chamber sliders.** One per chamber, 0–100, labelled `Not adopted → Piloted → Institutionalised`. Each carries a one-line value proposition drawn from the existing `CHAMBER_LINES` copy, plus the specific mechanism it monetises:

| Chamber | Monetised mechanism |
| --- | --- |
| 01 National Ledger | Decision latency reduction × decisions per quarter |
| 02 Portfolios | Reallocation yield on unmeasured programme spend |
| 03 Scenarios | Avoided cost of a wrong large commitment |
| 04 FDI Studio | Incremental FDI capture + concentration de-risking |
| 05 Narrative | Reduced policy-reversal / stalled-programme rate |
| 06 Cabinet Room | Commitment follow-through on Cabinet decisions |
| 07 Persona Lab | Programme design hit-rate before spend |
| 08 Mandate Compact | Mandate delivery rate across the term |

Each slider shows its own live contribution in dollars beneath the track, so the user sees exactly which chamber is moving the number.

## 3. The sticky verdict

Fixed on desktop (right rail), sticky bottom sheet on mobile. It never leaves the screen:

- **Headline:** GDP uplift at year 3 in USD (large serif, verdict-first).
- **Secondary:** growth in percentage points, return multiple vs. instrument cost, payback in months.
- **Waterfall:** a horizontal stacked bar attributing the total across the eight chambers, using existing `sector-01..12` tokens.
- **Three-year path:** a small sparkline (year 1 / 2 / 3), since chambers ramp rather than land at once.
- **Honesty line:** a conservative/central/optimistic toggle, and a permanent note that this is a *decision-framing model, not a forecast* — consistent with the paper's `NOT_CLAIMED` posture.

## 4. AI-first, without being unreliable

The **arithmetic is deterministic** — instant on every slider move, reproducible, and fully shown in an "Open the arithmetic" drawer rendered with `PrettyJson`. Nothing waits on a model.

The **intelligence is AI**, invoked on a debounced pause (~1.2s) after the user stops moving sliders:

1. **Counsel** — three to five sentences in the sovereign voice of the paper: what this configuration means, the single highest-leverage chamber left untouched, and the one assumption most likely to be wrong.
2. **Sequencing** — an AI-ordered 30-day / 6-month / year-one adoption order for the chambers the user has raised, with the reason for the order.
3. **Sensitivity** — the model names which one slider, moved one notch, changes the verdict most.

If the AI call fails or rate-limits, the numbers and the page remain fully intact and a quiet line replaces the counsel. AI never blocks the calculator.

## 5. The gated one-pager

Sliders and verdict are open to everyone. **Download the justification** opens the existing lead form (name, role, organisation, email, honeypot) and, on submit, generates a one-page PDF: the configuration, the verdict, the chamber waterfall, the AI counsel, and the five approvals from the paper — a document a permanent secretary can carry into a Cabinet meeting. Leads land in the same table pattern the op-ed gate uses, tagged `source: calculator`, with the configuration stored so we know what each prospect modelled.

## 6. Trust rails

- Every coefficient has a stated basis and a visible band; nothing is a black box.
- Cost side uses a published instrument price band, so the return multiple is honest in both directions.
- The verdict caps at defensible ceilings (no chamber can claim more than a bounded share of GDP) — an over-claiming calculator destroys the paper's credibility.
- Mobile-first: sliders are 44px touch targets, the verdict becomes a persistent bottom sheet, the waterfall stacks vertically.

---

## Technical notes

**Route** `src/routes/business-case.calculator.tsx` → `createFileRoute("/business-case/calculator")`, inside `MarketingShell`, own `head()` metadata, `FloatingBackToTop`. Requires promoting `business-case.tsx` to also serve `/business-case` — done by adding `business-case.index.tsx` for the paper and turning `business-case.tsx` into an `<Outlet />` layout.

**Model** `src/lib/calculator/model.ts` — pure, versioned (`v1_value`), no RNG, same discipline as `src/lib/engine/v1_macro.ts`. Exports `CHAMBER_COEFFICIENTS`, `COUNTRY_PRESETS`, and `computeValue(input): ValueResult` returning per-chamber contributions, three-year path, totals, and the arithmetic trace.

**AI** `src/lib/calculator/counsel.functions.ts` — unauthenticated `createServerFn({ method: "POST" })` (public marketing surface, no PII), reads `LOVABLE_API_KEY` inside the handler, uses `createLovableAiGatewayProvider` from `src/lib/ai-gateway.server.ts` with `openai/gpt-5.6-sol`, `providerOptions: { lovable: { reasoningEffort: "none" } }`, `Output.object` with a flat constraint-free schema, guarded by `NoObjectGeneratedError` with a static fallback. Called from the component via `useServerFn` + debounced `useQuery` keyed on the rounded slider state.

**Lead + PDF** `src/lib/calculator/request.functions.ts` mirrors `op-eds/request.functions.ts`; a migration adds `calculator_leads` (with GRANTs, RLS, service-role insert path) storing email, attribution, and the configuration JSON. PDF rendered client-side from a print-styled `PrintableValueCase` component, reusing the `ExportPdfDialog` approach already in `mandate-compact/plan/`.

**Components** under `src/components/calculator/`: `ValueCalculator`, `EconomyStep`, `QuestionSliders`, `ChamberSliders`, `VerdictRail`, `ChamberWaterfall`, `ArithmeticDrawer`, `CounselPanel`, `PrintableValueCase`. All buttons use `btn-*` utilities; only registered `@theme inline` tokens; any illustration goes through `<Illustration>` in the engraved house style.

**Maps** run `bun run headers && bun run map`, and add the calculator row to `docs/map/routes.md`.
