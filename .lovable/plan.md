We are closing the v1.0 PRD gap using a dependency-ordered sequence of waves. Each wave is independently shippable and must pass its stated definition-of-done before the next wave begins.

## Wave A — Provisioning & Identity (Phase 0 finish)
1. **A1. Country Configuration** (`/config`): CARICOM/OECS registry browser, country-pack review, portfolio→sector mapping, activation toggle. Admin-gated.
2. **A2. National Signature generator**: AI-generated country signature stored in `countries.signature_json`, surfaced on Config and Ledger home.
3. **A3. Universal keying audit**: `runKeyingAudit()` scanning all domain tables for null/invalid `country_id`/`sector_id`; route `/admin/audits/keying` with rerun + export.

## Wave B — Signal→Strategy Traceability (Phase 4 milestone)
1. **B1. Context Dossier (Screen 10)**: deepen `/narrative/signal/$id` with facts, coverage, precedents, open questions, and a "draft strategy" CTA.
2. **B2. Retrieval citation rail**: persist citation bindings per statement/artifact; inline markers in Strategy/Comms/Counsel editors.
3. **B3. Ledger fact-check at generate + approve**: red/amber/green claim chips with override modal writing to `data_revisions`.
4. **B4. Source suppression enforcement**: wrap all retrieval paths through `applySourceSuppressions`.
5. **B5. End-to-end traceability view**: route `/narrative/trace/$signal_id` and `narrative_lineage` table (already implemented).

## Wave C — Transparency & Self-Serve (Screens 17, 18)
1. **C1. Admin (Screen 18)**: user delegation, portfolio mapping editor, instance config, invite flow, audit log viewer.
2. **C2. Codex (Screen 17)**: browsable methodology store with anchored entries seeded via migration.
3. **C3. Methodology transparency drill-downs**: `WhyThisNumber` component on Ledger KPIs, CBI Exposure, Scenario outputs (already implemented).

## Wave D — Counsel GA & Mobile
1. **D1. Counsel Mobile (Screen 12b)**: hold-to-record waveform, slide-up answer sheet, source drawer, offline/reconnect states.
2. **D2. Counsel hardening for GA**: rate limits, budget caps, audit trail (already implemented); verify auth on every voice endpoint.

## Wave E — Engine Depth (Cadence, Goal-Seek, Ripple)
1. **E1. Cadence engine**: daily cron closing monthly/quarterly/annual/term windows; `kpi_snapshots` + `cadence_closes` tables.
2. **E2. Goal-seek**: `solveForTarget(kpi_id, target_value, horizon)` lever search in Scenario Builder.
3. **E3. Ripple propagation**: `sector_edges` adjacency matrix; scenario simulator shows first/second-order decomposition.

## Wave F — Documents & Decisions
1. **F1. Decisions register**: `/cabinet/decisions` first-class list with filters and export; extend `decisions` table with export status.
2. **F2. Document export system**: `renderDocument(kind, id)` → PDF/HTML for Cabinet decision, Briefing pack, FDI package, Term report, State-of-the-Mandate.
3. **F3. Onboarding seed flow**: Second Brain templates seeded per Country Pack activation.

## Wave G — State Coverage & GA Hardening (Phase 5)
1. **G1. State coverage sweep**: empty / loading / error / stale states on every `_authenticated/*` route using shared `<RouteState>` primitives.
2. **G2. Accessibility audit**: WCAG 2.2 AA (AAA for Session Mode + headline numbers), reduced-motion parity, axe CI check.
3. **G3. Performance budget**: route-level bundle audit; lazy-load heavy widgets; target LCP < 2.5s.
4. **G4. Security audit**: `requireSupabaseAuth` + role checks on all privileged server functions; run `supabase--linter`; no `supabaseAdmin` at module scope in `.functions.ts`.
5. **G5. External reviews & award prep**: methodology export, comms doctrine review packet, award-submission assets.

## Current status
- Implemented: A1–A3, B5, C3, D2.
- Next in sequence: B1–B4 (Dossier + citations + fact-check + suppression), then C1–C2 (Admin + Codex), then D1 (Counsel mobile), then E1–E3 (engine depth), then F1–F3 (documents/decisions), finally G1–G5 (GA hardening).

## Technical guardrails
- Every new public table gets a GRANT block + RLS + policies in the same migration.
- Server functions live in `src/lib/*.functions.ts`, protected via `requireSupabaseAuth` + `has_role` for privileged ops; `supabaseAdmin` only imported inside handler bodies.
- AI calls use Lovable AI Gateway (`openai/gpt-5.5` default).
- Citations use the shared `citations` table + `<CitationsRail>` across Strategy, Comms, and Counsel.
- Source suppression uses a single `applySourceSuppressions` helper wrapping every retrieval path.

