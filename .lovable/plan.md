## Goal
Turn the Chamber 01 v2 PRD into working software the **Super Admin can test end-to-end** at `/instrument` (Ledger home), `/instrument/sector/:code` (dossier), and `/instrument/stewardship` (data-quality). Every new figure surfaced is AI-explainable and cites the Second Brain.

## What already exists (build on, don't recreate)
- Ledger home (`/instrument`) with `SignatureRing`, 12-sector composition table, CBI Exposure Index tile.
- `sector.$code` four-layer dossier route.
- `exposure.tsx`, `stewardship.tsx`, `portfolio.$ministry`, `scenarios.*`, `cabinet.*`, `narrative.*`, `counsel.*`.
- `ledger.functions.ts`, `sector-composition.ts`, `caricom-registry.ts`, `codex-entries.ts`.
- Viz: `SovereignSankey`, `MinistrySectorHeatmap`, `GdpTreemap`, `MacroStrip`, `KpiSmallMultiples`, `EvidenceRail`.
- Second Brain corpus tables + citation contract (`onboarding_citations`, `country_source_chunks`, `memory_objects`, `sector_dossiers.citations`, `ministry_profiles.citations`).
- AI wired via `ai-gateway.server.ts` + Lovable AI Gateway.
- Auth via `_authenticated` layout; Super Admin shell exists.

## What we're adding (v2 features → phases)

### Phase 1 — AI-first "Why this number?" (foundation, everything else uses it)
The instrument's spine. Every figure surfaced anywhere becomes a click-target that opens the WhyThisNumber panel, now backed by AI + Second Brain retrieval.
- Extend `<WhyThisNumber>` (already exists in `components/marketing/`) into `components/ledger/WhyThisNumberPanel.tsx`: source URL, grade, revision history, provenance chain, and a **Second-Brain-grounded AI explanation** ("in one paragraph, using only cited corpus chunks").
- New server fn `explainFigure` in `src/lib/ledger.functions.ts`: takes `{ country, series_ref }`, pulls the series point + top-K matching `country_source_chunks` and `memory_objects`, streams a grounded explanation via Gemini through `ai-gateway.server.ts`. Refuses to answer if no citations retrieved.
- New table `figure_snapshots` (immutable pins) + migration; GRANTs.
- Wire the panel from: composition table row, CBI Index tile, sector dossier figures.

### Phase 2 — Ledger home enrichments (readers)
On top of the existing `/instrument` page:
- **Time-scrubber** over the composition ring (reads `series_points` history; missing years shown as gaps).
- **"What changed since last visit"** strip (reads `data_revisions` since the user's last visit; persisted per-user).
- **Peer comparator strip** (OECS / CARICOM / CBI states via `caricom-registry.ts`).
- **Reconciliation banner** if sector shares don't sum to 100.
- **CBI Exposure sparkline** + "Simulate 20% wind-down" one-click into `/instrument/scenarios/new` pre-loaded.
- **Capital-flows Sankey** panel (reuses `SovereignSankey` + `capital_flow_nodes`) with visible residual.
- **Ministry ↔ sector heatmap** panel (reuses `MinistrySectorHeatmap`).

### Phase 3 — Freshness, downgrades, and citation coverage (trust signals)
- `series_freshness` view/table: `source_date`, `next_expected_release`, `age_days`. Freshness meter on every wedge and figure.
- Grade-downgrade alerts: when a revision drops grade, emit a row in a new `grade_alerts` table and surface as a banner on citing chambers.
- Citation coverage badge on sector dossiers (% of claims backed by an `onboarding_citations` row); jump-to-edit list of unbacked claims.

### Phase 4 — Second Brain always present ("Ask the Ledger" rail)
A persistent AI rail on every Ledger surface, powered exclusively by the Second Brain.
- New `<AskTheLedger>` right-rail component (collapsible), rendered from a shared `InstrumentShell` on Ledger + sector + exposure + stewardship routes.
- Server fn `askTheLedger` (streaming): retrieval-only, cites 3–5 chunks with `[N]` markers that resolve to source modals.
- Refuses ungrounded questions. No autonomous action. Every answer offers "Pin to scenario / brief" (uses `figure_snapshots`).

### Phase 5 — Steward tools (data quality)
On `/instrument/stewardship`:
- Reconciliation checker (cross-source residuals with steward note requirement).
- Source-health monitor: nightly cron via `src/routes/api/public/hooks/*` polling registered URLs; `source_health_checks` table; broken-link surface.
- Bulk-recompute preview: dependency graph of downstream figures moved by a candidate revision, before commit.
- Confidence composition score per country (readout tile).
- Publish gate: extends existing keying audit; disables "GA" toggle until green.

### Phase 6 — Handoffs + snapshots + press-safe view
- "Speak this number" → Counsel + Narrative with figure/grade/citation pre-loaded.
- "Save to scenario / brief" writes `figure_snapshots` (immutable).
- Press-safe view toggle on Ledger home (hides grade-D + non-exportable; watermarks any export).

### Phase 7 — Super Admin test surface
A dedicated QA route so the Super Admin can exercise every v2 feature without hunting:
- New route `/admin/ledger-qa` (super-admin only, existing role gate).
- Checklist UI that runs each capability against a chosen country and reports pass/fail:
  - Signature ring renders, time-scrubber years discovered
  - "Why this number?" returns grounded AI answer with ≥1 citation
  - Ask-the-Ledger streams and refuses ungrounded queries
  - Freshness meter + at least one grade-downgrade alert visible on a test revision
  - Source-health monitor last-run status
  - Reconciliation banner shows when shares ≠ 100
  - CBI sparkline + wind-down handoff opens Scenario draft
  - Sankey renders inputs ≥3, outputs ≥4, residual ≤10%
  - Ministry ↔ sector heatmap coverage gaps listed
  - Citation coverage ≥95% on committed dossiers
  - Snapshot pin round-trips (create → retrieve → immutability)
  - Press-safe view hides grade-D
- Each row has a "Run" button and links to the exact UI surface for manual verification.

## Data model additions (single migration per phase, GRANTs included)
- `figure_snapshots` (Phase 1)
- `series_freshness` (Phase 3)
- `grade_alerts` (Phase 3)
- `source_health_checks` (Phase 5)
- `provenance_chain` view over existing revision/ingest tables (Phase 1/3 as needed)
- `ledger_last_visits (user_id, country_code, visited_at)` (Phase 2)

All new public tables get RLS + `GRANT`s per project convention. RBAC via existing `has_role`.

## AI-first contract (applies everywhere)
- All model calls use `createLovableAiGatewayProvider` + `google/gemini-3-flash-preview` default.
- All answers are **retrieval-augmented from the Second Brain only** — no free-form generation about numbers. If retrieval returns nothing, the answer is "I don't have grounded evidence for this."
- Every AI response returns `{ answer, citations[] }`; UI refuses to render answers without citations.
- Streamed via AI SDK `streamText` + `toUIMessageStreamResponse` where interactive; `generateText` with `Output.object` for structured extractions (schemas kept small).
- Prompts, tools, keys stay server-side.

## Files to add / edit (high level)
- `src/components/ledger/WhyThisNumberPanel.tsx` (new)
- `src/components/ledger/AskTheLedger.tsx` (new)
- `src/components/ledger/InstrumentShell.tsx` (new — wraps ledger routes with rail)
- `src/components/ledger/TimeScrubber.tsx`, `WhatChanged.tsx`, `PeerStrip.tsx`, `ReconciliationBanner.tsx`, `CbiSparkline.tsx`, `FreshnessMeter.tsx`, `GradeAlertBadge.tsx`, `CitationCoverageBadge.tsx`, `PressSafeToggle.tsx` (new)
- `src/lib/ledger.functions.ts` (extend: `explainFigure`, `getHistoricalComposition`, `getWhatChanged`, `getPeers`, `getCbiHistory`, `pinFigureSnapshot`, `getFreshness`, `getGradeAlerts`, `getCitationCoverage`, `getPublishGate`)
- `src/routes/api/chat.ledger.ts` (new — streaming Ask-the-Ledger)
- `src/routes/api/public/hooks/source-health.ts` (new — cron)
- `src/routes/_authenticated/instrument/index.tsx`, `sector.$code.tsx`, `stewardship.tsx` (extend to use `InstrumentShell` and new components)
- `src/routes/_authenticated/admin/ledger-qa.tsx` (new — Super Admin QA)
- One migration per phase under `supabase/migrations/` with GRANTs + RLS.

## Definition of done
- All v2 PRD FRs (FR-LG-01 … FR-LG-25) have at least one working UI surface or server endpoint.
- Super Admin `/admin/ledger-qa` shows every row green for the LCA pilot country.
- No ungrounded AI answer can render.
- `bun run build` clean; no client-side leak of `LOVABLE_API_KEY` or service role key.

## Execution order
Phase 1 → 2 → 4 (rail depends on `explainFigure`) → 3 → 5 → 6 → 7. Each phase ends with a self-contained testable slice.

**Approve to start Phase 1** — I'll ship Phase 1 completely (migration, server fn, panel, wiring on Ledger home + sector page), then check in before continuing.