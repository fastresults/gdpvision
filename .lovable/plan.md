# GDPVision v1.0 — Gap Closure Plan

Sequenced to unblock dependencies first (provisioning → traceability → transparency → depth → hardening). Each wave is independently shippable and ends in a verifiable DoD check.

## Wave A — Provisioning & Identity (Phase 0 finish)

**A1. Screen 0 — Country Configuration**
- Route: `/config` (upgrade existing stub).
- Sections: CARICOM/OECS registry browser, Country Pack review (macro seed, sectors, ministries), portfolio→sector mapping confirmation, activation toggle.
- Server fns: `listCountryPacks`, `previewCountryPack(iso)`, `activateCountryPack`, `confirmPortfolioMapping`.
- Admin-gated via `has_role('admin')`.

**A2. National Signature generator**
- Server fn `generateNationalSignature(country_id)` using Lovable AI (`openai/gpt-5.5`) with Ledger + sector seed as context, stored in `countries.signature_json`.
- Migration: add `signature_json jsonb`, `signature_generated_at timestamptz` on `countries`.
- Surfaced on Config screen + Ledger home header.

**A3. Universal country+sector keying audit**
- Server fn `runKeyingAudit()` scanning every domain table for null/invalid `country_id`/`sector_id` and reporting violations.
- Route: `/admin/audits/keying` with rerun + export.

## Wave B — Signal→Strategy Traceability (Phase 4 milestone)

**B1. Context Dossier (Screen 10) — deepen**
- Extend `/narrative/signal/$id` with: Facts panel (Ledger series pulled by sector), Coverage map (recent `comms_artifacts` filtered by sector+topic), Precedent (prior `strategy_statements`), Open Questions (AI-generated w/ persist), Prior Statements timeline.
- Migration: `dossier_questions` table (signal_id, question, status, answer_ref).
- "Draft strategy from dossier" CTA prefilling Strategy Composer with citations.

**B2. Retrieval citation rail — bind to Second Brain**
- Extend existing `CitationsRail` to persist citation bindings per statement/artifact block.
- Migration: `citations` table (owner_type, owner_id, memory_object_id, quote, offset).
- Render inline citation markers in Strategy/Comms editors with hover source card.

**B3. Ledger fact-check at generate + approve (FR-NC-11)**
- Extend `factCheckBody` to run on generation (blocking warnings) AND on approval (hard gate unless override with reason).
- UI: red/amber/green claim chips, override modal writes to `data_revisions`.

**B4. Source suppression enforcement**
- Wrap all retrieval paths (`listCitationCandidates`, Counsel retrieval, Composer retrieval) through `applySourceSuppressions(user_id, sector_id)`.
- Add integration test asserting suppressed sources never appear.

**B5. End-to-end traceability view**
- Route: `/narrative/trace/$signal_id` showing Signal → Dossier → Strategy → Artifact → Approval chain.
- Migration: `narrative_lineage` table linking artifacts back to source signal.

## Wave C — Transparency & Self-Serve (Screens 17, 18)

**C1. Admin (Screen 18) — complete**
- Extend `/admin` with: user delegation, portfolio mapping editor, instance config (feature flags, provider caps), invite flow, audit log viewer.
- Server fns: `delegateRole`, `updatePortfolioMapping`, `getInstanceConfig`, `updateInstanceConfig`.
- Migration: `instance_config` (key, value_json, updated_by), `audit_log` if not present.

**C2. Codex (Screen 17) — deepen**
- Expand `/codex` from static handbook to browsable methodology store with anchor links.
- Migration: `codex_entries` (slug, title, body_md, category, version).
- Seed via migration with Confidence, CBI Index, Ripple, Cadence, Release Doctrine, Fact-check policy.

**C3. Methodology transparency drill-downs (FR-SE-09)**
- "Why this number?" popover on Ledger KPIs, CBI Exposure rows, Scenario outputs → deep-links to matching Codex entry + source series.
- Reusable `<WhyThisNumber target="cbi.exposure">` component.

## Wave D — Counsel GA & Mobile

**D1. Counsel Mobile (Screen 12b) — harden**
- Existing shell exists; add: hold-to-record with waveform, slide-up answer sheet with citation chips, drawer to open source instrument (Ledger/Scenario/Mandate).
- Verify offline/reconnect states.

**D2. Counsel hardening for GA**
- Rate limit middleware (per user, per instance) on all Counsel server fns.
- Instance provider budget caps read from `instance_config`; hard stop + surface message on exceed.
- Full audit trail: every Counsel Q/A writes to `counsel_answers` with scenario snapshot ref.
- Verify `requireSupabaseAuth` on every voice endpoint; add integration tests.

## Wave E — Engine Depth (Cadence, Goal-Seek, Ripple)

**E1. Cadence engine**
- Cron `/api/public/hooks/cadence-close` (daily 00:15 UTC) closing monthly/quarterly/annual/term windows.
- Migration: `kpi_snapshots` (immutable), `cadence_closes` (period, kind, closed_at).
- Mandate Studio surfaces closed periods with diff vs prior.

**E2. Goal-seek**
- Server fn `solveForTarget(kpi_id, target_value, horizon)` running lever search using existing scenario simulator.
- UI in Scenario Builder: "Set target → discover levers" mode returning ranked lever bundles.

**E3. Ripple propagation across sectors**
- Extend scenario simulator with sector adjacency matrix (`sector_edges` migration: from_sector, to_sector, elasticity).
- Seed default matrix; expose in Codex + Admin.
- Scenario Detail shows first/second-order ripple decomposition.

## Wave F — Documents & Decisions

**F1. Decisions register**
- Route: `/cabinet/decisions` first-class list with filters, export.
- Extend `decisions` table with export_status, exported_at.

**F2. Document export system (Phase 3)**
- Server fn `renderDocument(kind, id)` → PDF via headless (or HTML+print) honoring doctrine.
- Kinds: Cabinet decision, Briefing pack, FDI package, Term report, State-of-the-Mandate.
- `exports_log` already exists — wire it.

**F3. Onboarding seed flow — Second Brain**
- Migration seeding Position Library / Statement Record / Audience Registry templates per Country Pack activation.
- Trigger from Wave A1 activation flow.

## Wave G — State Coverage & GA Hardening (Phase 5)

**G1. State coverage sweep**
- Add empty / loading / error / stale states to every `_authenticated/*` route using shared `<RouteState>` primitives.
- Loading uses skeletons; stale surfaces last-refresh + refresh CTA.

**G2. Accessibility audit**
- WCAG 2.2 AA project-wide; AAA for Session Mode + headline numbers.
- Reduced-motion parity, motion-token conformance sweep.
- axe CI check.

**G3. Performance budget**
- Route-level bundle audit; lazy-load Cabinet/Scenario/FDI heavy widgets.
- Target LCP < 2.5s on preview URL.

**G4. Security audit**
- Verify `requireSupabaseAuth` + role check on every server fn touching admin/counsel/writes.
- Run `supabase--linter`; resolve all warnings.
- Confirm no `supabaseAdmin` at module scope in `.functions.ts`.

**G5. External reviews & award prep**
- Package methodology for external economist review (Codex export).
- Comms doctrine review packet.
- Award-submission asset prep (screenshots, narrative, metrics).

---

## Technical notes

- **Migrations**: every new public table gets GRANT block + RLS + policies in the same migration.
- **Server fns**: `.functions.ts` in `src/lib/`, protected via `requireSupabaseAuth` + `has_role` checks for privileged ops; `supabaseAdmin` only imported inside handler bodies.
- **Cron**: `pg_cron` calling `/api/public/hooks/*` with `apikey` header (publishable key).
- **AI**: Lovable AI Gateway via `createLovableAiGatewayProvider`, `openai/gpt-5.5` default.
- **Citations**: shared `citations` table + `<CitationsRail>` reused across Strategy, Comms, Counsel.
- **Suppression**: single `applySourceSuppressions` helper wraps every retrieval path.

## Sequencing rationale

```text
A (provisioning) → B (traceability) → C (transparency)
                                    ↘ D (counsel GA)
                                    ↘ E (engine depth) → F (docs/decisions)
                                                       → G (GA hardening)
```

A blocks credible new-instance provisioning. B closes the DoD chain called out in the PRD's Phase 4 milestone. C unblocks self-serve. D–F can proceed in parallel once B lands. G is the final GA gate.

## Suggested first execution slice

Wave A (A1 + A2 + A3) in one build turn — small, high-leverage, unblocks every downstream demo.
