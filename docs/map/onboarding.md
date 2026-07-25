# Country onboarding map

Canonical stage list + order lives in **`src/lib/country-onboarding/stages.ts`** — treat that file as the source of truth. This map is a fast reference for what each stage does and where its wiring lives.

## Common infrastructure

- **Orchestrator**: `src/lib/country-onboarding/orchestrator.functions.ts` — run one stage, "run all pending", stale-lock recovery (8-min heartbeat), self-heal retry loop.
- **Committer for structured stages**: `src/lib/country-onboarding/agents.functions.ts`.
- **Corpus writes**: `src/lib/country-onboarding/corpus.functions.ts`, `ingest.server.ts`, `seeds.server.ts`.
- **AI waterfall**: `fallback.server.ts` → `perplexity.server.ts` → `gemini.server.ts` → infer.
- **Country context**: `country-context.server.ts` (TLD, name, aliases, previously-committed data).
- **Dedup**: `memory-dedup.ts`, `memory-dedup.server.ts`. Every commit path upserts on the stage's normalized key.
- **UI panel**: `src/routes/_authenticated/admin/countries.$code.onboard.tsx` renders each stage card, its research payload (via `<PrettyJson>`), and its Commit button.
- **Countries queue**: `admin/countries.index.tsx` — per-country progress % pulled from `stages.ts` completion check.

## Stage index (short)

| # | Stage | Research (server-only) | Commit fn | Primary tables |
|---|-------|------------------------|-----------|----------------|
| 01 | Country profile | fallback via `agents.functions.ts` | `agents.functions.ts` | `countries` |
| 02 | Macro identity | fallback | agents | `country_macro` |
| 03 | Sector composition | `corpus/searchers/sector.server.ts` | agents | `sector_profiles` |
| 04 | KPI seed | `kpi-seed.server.ts`, `kpi-seed-flow.ts` | agents | `country_kpis`, `country_kpi_points` |
| 05 | Ministries + Ministers | `minister-research.server.ts` (4-pass loop) | agents | `ministry_profiles` |
| 06 | Ministry mandate/programmes | fallback | agents | `ministry_profiles.mandate` etc. |
| 07 | Sector dossiers | `sector-dossier/{prewarm,build}.functions.ts` | build | `sector_dossiers` |
| 08 | KPI research (deep) | `kpi-research.server.ts`, `kpi-inference.server.ts` | agents | `country_kpis`, `country_kpi_points` |
| 09 | Ministry × Sector | `ministry-deep-dive-flow.ts` | agents | `ministry_sectors` |
| 10 | Memory objects | `memory-dedup.server.ts` | agents | `memory_objects` |
| 11 | Citations | `corpus/searchers/citation.server.ts` | agents | `onboarding_citations`, `country_sources` |
| 12 | Capital flows | `capital-flows.server.ts` (3-pass: inputs / fiscal_out / imports, sonar-reasoning-pro, GDP plausibility clamp per `capital_flow_nodes.gdp_cap_multiplier`) | agents | `capital_flow_nodes`, `capital_flow_edges` |
| 13–20 | Domain promotion, summaries, viz packs, etc. | `domain-promotion.server.ts`, `summaries.functions.ts`, `summary-inline.ts` | agents / summaries | see `stages.ts` |

**Stage 12 gate**: draft is commit-eligible only when ≥3 inputs, ≥4 outputs, ≤10% reconciliation residual — otherwise finishes as `needs_review` and Commit is disabled.

## Backfill routines (separate triggers, run across all countries)

- **Ministers backfill**: `minister-backfill.functions.ts` — re-runs Stage 5 minister research for every country.
- **Parties + manifestos backfill**: `party-research.server.ts` (3-pass: identify parties → flag ruling party → ingest manifesto via Firecrawl) + `party-backfill.functions.ts`. Admin panel toggles a persistent background job.

## Self-healing

- `src/lib/ledger-qa/self-heal.functions.ts` — orchestrates redrive of failed stages. Stale-lock reclaim, deep-research retry with exponential fallback tier.
- Browser-driven retry loop in the "Run all pending" admin action mitigates server-side timeouts.

## When adding a stage

1. Add the definition to `stages.ts` (order + committer + completion predicate).
2. Add the research fn under `country-onboarding/*.server.ts`.
3. Add the commit path in `agents.functions.ts` (or a dedicated committer if non-trivial).
4. Migration: table + GRANTs + RLS + policies.
5. Extend `admin/countries.$code.onboard.tsx` panel rendering only if the payload shape needs a bespoke card.
6. Update the row above.
