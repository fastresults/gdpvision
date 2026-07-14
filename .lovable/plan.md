## Deliverable
A single downloadable file:

`/mnt/documents/chamber-01-national-ledger-prd-v2.md`

Surfaced in chat as a `<presentation-artifact>` for preview and download. No app code changes.

## Structure of v2

1. **Purpose** — unchanged core principle: no number without a source, source, or grade.
2. **Users & jobs-to-be-done** — PM/Cabinet, Permanent Secretary, CBI Unit, Comms Director, Data Steward (expanded jobs).
3. **Reader-facing feature set (Ministers, Advisors, Comms)**
   - 12-sector composition + National Signature ring hero
   - Time-scrubber over ~10 years of history
   - Peer comparator strip (OECS/CARICOM/CBI states)
   - "What changed since last visit" digest
   - Confidence grade A/B/C/D with pattern (not hue)
   - Freshness meter + next-expected-release per series
   - Grade-downgrade alerts propagated instrument-wide
   - CBI Exposure Index with historical sparkline + inline 20% wind-down handoff to Scenarios
   - Capital-flows Sankey with visible reconciliation residual
   - Ministry ↔ sector heatmap on the Ledger
   - Persistent reconciliation banner (never silently rescale)
   - Four-layer sector dossiers (Economic / Policy / Comms / OECS)
   - "Why this number?" drill-down
   - "Speak this number" — one-click handoff to Counsel and Narrative
   - Save-to-scenario / save-to-brief with immutable snapshot
   - Ledger changelog feed
   - Public/press-safe view toggle
4. **Steward-facing feature set (Data Stewards, Analysts)**
   - Reconciliation checker as a first-class stage
   - Source-health monitor (auto-poll, broken-link flags)
   - Bulk-recompute with dependency-graph preview
   - Citation coverage report per dossier
   - Confidence composition score per country
   - Definition-of-Done gate integrated into publish
   - Global-deduped source registry
   - Revisions, suppressions, full audit log
5. **User stories** — one per persona, expanded.
6. **Non-goals (v1.0)** — carried from v1.
7. **Functional requirements** — FR-LG-01 … FR-LG-25 covering all new features (grades, freshness, dedup, propagation, source-health, snapshots, export controls, provenance).
8. **Data model summary** — v1 tables + additions for freshness, source_health_checks, figure_snapshots, provenance_chain, export_classifications.
9. **UX surfaces** — Ledger home, sector page, ministry pages, Stewardship, Admin > Countries, plus handoffs to Chambers 03/06/08.
10. **Governance & compliance**
    - Data-source classification
    - Provenance chain (ingest run ID, model, reviewer)
    - Retention policy for revisions & suppressions
    - Export controls per grade/source
    - Country pack methodology block (versioned)
11. **Trust & governance principles** — stage gates, grade + pattern, suppression audit, chambers cite by ID.
12. **Success metrics (expanded)** — 100% figures resolve to series_point; ≥90% A/B on top-5 sectors; 0 dup sources; <2 clicks to source; median series age ≤ 12 months; 100% grade-D carry reviewer note; 0 broken source URLs; ≥95% citation coverage; time-to-explain ≤ 15s; 100% capital-flow commits pass clamp.
13. **Dependencies** — onboarding stages 1–12, Second Brain corpus, Codex methodology, design system, Scenarios/Counsel/Narrative handoffs.
14. **Open questions** — annotations by non-stewards; peer default (OECS vs CARICOM vs SIDS); Signature release cadence; plus v1 open questions.

## Notes
- Everything traces back to what's already built or clearly wired in the codebase (SignatureRing, SovereignSankey, MinistrySectorHeatmap, capital_flow_nodes, onboarding_citations, data_revisions, keying audit, Scenarios/Counsel/Narrative chambers).
- Documentation artifact only — no changes to the running app.

**Approve to generate the file.**