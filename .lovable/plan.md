
# GDPVision — Phased Build Plan

Maps PRD §17 roadmap into concrete, buildable increments on this stack (TanStack Start, Lovable Cloud/Supabase, Tailwind v4). Each phase lists scope, schema, routes, components, exit criteria. Marketing site (`/`) is already shipped; `/kiosk` hosts the existing SEDE-style demo.

## Guiding invariants (applied to every phase)
- **Universal key on every table**: `country_code` + `sector_code` NOT NULL, indexed. Enforced at write time. `country_code = 'REGIONAL'` for Regional Commons.
- **Design tokens as source of truth**: extend `src/styles.css` `@theme` with the full Sector Spectrum (12 hues), Paper + Chamber environments, motion tokens (§10, §11). No component may hardcode hex.
- **Provenance is P0**: every numeric-bearing row carries `source_id`, `vintage`, `confidence_grade` (A–D). UI renders grade encoding universally (§10.6).
- **Auth from Phase 1 onward**: Lovable Cloud auth + `user_roles` table + `has_role()` SECURITY DEFINER; RLS + GRANTs on every public table.
- **No third-party trackers** anywhere in-instance (§14.6).
- **Definition of Done gate** (§19) enforced at each phase exit.

---

## Phase 0 — Instrument Definition (Weeks 1–4)
Goal: token system, identity, registry, and SEDE re-skin usable in a Cabinet demo.

**Deliverables**
- **Design tokens**: extend `src/styles.css` with `--sector-01..12`, Paper/Chamber palettes, `ease-sovereign/exit/inertia`, `dur-*`, `stagger`, tabular-lining numeric utilities. Ship `Fraunces`, `IBM Plex Sans/Mono` via `<link>` in `__root.tsx`.
- **Sector taxonomy**: `src/lib/sectors.ts` — 12 canonical sectors (Appendix A) with ISIC code, hue token, portfolio hint.
- **Country registry & Country Packs**: extend `src/lib/caricom-registry.ts` with fiscal calendar, currency, NSO/ECCB source map, portfolio→sector default map for the 5 CBI states (SLU, KNA, DMA, ATG, GRD) first.
- **National Signature ring generator**: promote current `SignatureRing` to a reusable primitive that takes a sector composition array; supports master (balanced) and instance (from Ledger) modes; SVG, 3 scales (favicon, wordmark, hero).
- **SEDE re-skin under `/kiosk`**: apply new tokens to existing kiosk surfaces (already migrated). No behavior changes — pure re-skin pass.
- **Methodology Codex v1**: `src/routes/codex.tsx` (marketing-adjacent, static MDX-style content) — versioned, plain HTML sections.

**Schema (migration bundle 0)**
- `countries` (code PK, name, iso3, currency, fiscal_year_start, is_caricom, is_oecs, is_cbi_state)
- `sectors` (code PK, name, isic, hue_token, sort_order)
- `country_sectors` (country_code, sector_code, share_pct baseline) — seed idealized ring
- `sources` (id, name, kind, grade, url, country_code, sector_code)
- `user_roles` (+ `app_role` enum: `principal`, `steward`, `advisor`, `line_minister`, `comms_director`, `cabinet_secretary`, `data_steward`, `admin`) + `has_role()` fn

**Exit**: token system published; Signature Ring renders per nation; roles + RLS scaffolding live; SEDE demo runs on new tokens.

---

## Phase 1 — The National Ledger (Weeks 5–12)
Goal: a real Cabinet sees its own economy in the instrument.

**Routes** (`src/routes/_authenticated/instrument/*`)
- `/instrument` — Instance Home (composition ring, headline indices, currency strip)
- `/instrument/sector/$code` — Sector Detail (series, dependency web stub, related scenarios placeholder)
- `/instrument/exposure` — CBI Exposure Index + decomposition + methodology drill-down
- `/instrument/stewardship` — Data Stewardship (ingestion queue, validations, revisions)

**Components**: `LedgerHeader`, `SectorRing` (interactive), `SeriesChart` (bespoke D3 layer wrapping `visx` or raw SVG — no default themes), `ConfidenceBadge`, `ProvenanceFooter`, `NumberTreatment` (serif hero + Plex Mono metadata), `DataCurrencyStrip`.

**Schema (bundle 1)**
- `series` (id, country_code, sector_code, metric, unit, frequency, source_id, confidence_grade)
- `series_points` (series_id, period, value, revised_from, revised_at)
- `exposure_index` (country_code, period, value, decomposition jsonb, methodology_ref)
- `data_revisions` (audit table)

**Server fns** (`src/lib/ledger.functions.ts`): `getInstanceOverview`, `getSectorDetail(code)`, `getExposureIndex`, `ingestSeriesCsv` (steward-only via `requireSupabaseAuth` + role check).

**Milestone**: Saint Lucia Ledger loaded; PM can absorb national position in <5 min.

---

## Phase 2 — Engine & Portfolio Workspaces (Weeks 13–22)
Goal: ministerial scenario modeling with ripple effects.

**Routes**
- `/instrument/portfolio/$ministry` — per-ministry Workspace
- `/instrument/scenarios` — scenario list
- `/instrument/scenarios/new` — Scenario Builder (lever console + live projection canvas)
- `/instrument/scenarios/$id` — artifact view
- `/instrument/scenarios/compare` — 2–4 side-by-side

**Compute service**: `src/lib/engine/` — versioned model modules (`v1_macro.ts`), pinned per scenario artifact. Runs in a `createServerFn` with input Zod validation; returns deterministic outputs for identical inputs.

**Components**: `LeverConsole` (keyboard-steppable, ARIA-announced), `ProjectionCanvas` (P10/P50/P90 bands, scenario violet tint on projected region), `DependencyWeb` (ripple pulse per §11.2.4), `ScenarioCompareGrid`, `AssumptionsDrawer`.

**Schema (bundle 2)**
- `levers` (id, country_code, sector_code, name, bounds jsonb, response_fn_ref, methodology_ref)
- `scenarios` (id, country_code, sector_code, author_id, horizon, model_version, status, lever_settings jsonb, assumptions jsonb, results jsonb, attribution jsonb, created_at)
- `scenario_promotions` (audit)
- Pre-built national scenarios seeded per Country Pack.

**Exit**: 60% of a mock Cabinet has ≥1 saved scenario; ripple visualization passes design review.

---

## Phase 3 — Studio, Room & Mandate (Weeks 23–32)
Goal: FDI transition + governing rhythm + Session Mode.

**Routes**
- `/instrument/studio/gap` — The Gap (wind-down selector, anchor viz)
- `/instrument/studio/packages` — Package Builder & Readiness Gates
- `/instrument/mandate/studio` — KPI definition + goal-seek invocation
- `/instrument/mandate/scorecard` — National Scorecard
- `/instrument/cabinet` — Cabinet Room (ring, agenda, commitments)
- `/instrument/cabinet/session` — Chamber (dark, full-bleed Session Mode)

**Components**: `GapChart`, `PackageBuilder`, `ReadinessGates`, `KPIRow` (§10.6 target/pace treatment), `ScorecardTable`, `SessionShell` (dark env, classification strip, keyboard/clicker nav), `DecisionSeal` motion, `CommitmentsRegister`.

**Schema (bundle 3)**
- `packages` (id, country_code, sector_code, gates jsonb, enabling_actions jsonb, status)
- `kpis` (id, country_code, sector_code, ministry, metric_ref, baseline, target, classification, cadence, owner_id, plan_scenario_id)
- `goal_cycles` (kpi_id, period, status, figures jsonb, commentary, snapshot_at)
- `mandates` (unified: kpi_id or scenario_id or package_action_id, status, cadence)
- `sessions` (id, agenda jsonb, minutes, held_at)
- `decisions` / `commitments` (audit-immutable)
- `exports_log` (watermark, classification, user, timestamp)

**Document renderer**: server-side PDF endpoint under `/api/public/exports/*` (webhook-safe path; token-guarded) using tokenized styles — no Word templates.

**Milestone**: a Cabinet session opens with a Scorecard walk against ratified targets; adopted decisions post to Commitments Register.

---

## Phase 4 — Narrative Chamber & Counsel (Weeks 33–42)
Goal: signal → dossier → strategy → approved release in one working day; voice-first Counsel to GA.

**Order (per PRD)**: Second Brain spine → Harvest pipeline → Signal Desk + Context Research → Counsel hardening → Strategy Composer → Comms Studio.

**Routes**
- `/narrative/signal` — Signal Desk (issue cards, risk radar)
- `/narrative/dossier/$id` — Context Dossier
- `/narrative/brain` — Second Brain browser (Country Silo / Regional Commons tabs)
- `/narrative/queue` — Curation Queue (keyboard-first triage)
- `/narrative/ingest` — URL/text ingest + research briefs
- `/narrative/coverage` — Coverage & Gaps
- `/narrative/strategy/$id` — Strategy Composer (7-part)
- `/narrative/comms/$id` — Comms Studio (artifact suite + tiered approval)
- `/counsel` (desktop console) and `/counsel/mobile` (hold-mic shell)
- `/counsel/archive`

**Schema (bundle 4)**
- `memory_objects` (id, scope_key [country_code or REGIONAL], sector_code, kind [audience/position/statement/outlet/precedent], payload jsonb, weight 1–5, verified bool, source_id, embedding vector(1536)) — pgvector + HNSW
- `harvest_runs` (id, cadence_slot, started_at, counts jsonb, failures jsonb)
- `intake_items` (id, harvest_run_id, source_id, scope_key, sector_code, topic, summary, proposed_weight, final_weight, state)
- `curation_batches` (id, curator_id, committed_at, item_count, weight_distribution jsonb)
- `research_briefs` (id, prompt, sector_hint, recency, results jsonb)
- `source_suppressions` (source_id, country_code, reason, actor_id, active bool)
- `strategy_statements` (id, seven_part jsonb, sources jsonb, approvals jsonb, version)
- `comms_artifacts` (id, strategy_id, kind, audience, channel, body, draft_state, approvals jsonb, released_at)
- `counsel_answers` (id, user_id, question, spoken_block, written_block, citations jsonb, tags, scenario_snapshot jsonb, content_hash)

**Server infrastructure**
- **Harvest cron**: pg_cron → `/api/public/harvest/run` (HMAC-signed), executes collectors, runs Filter chain, writes `intake_items`. Default 06:00 + 16:00 instance-local.
- **Embeddings**: `match_chunks(query_embedding, k)` RPC; chunker (~1000 chars, 120 overlap).
- **AI Gateway** (Lovable AI): RAG generation with mandatory retrieval-citation contract; model version pinned per artifact.
- **Voice loop** (port SEDE): streaming chat + tool calls; STT multipart; TTS streamed; iOS Safari unlock primed on gesture; bounded step cap; finalized-only research notices with promise-chained queueing.
- **Rate limits + budget caps** per instance on all external research/scrape providers (Appendix B hardening).
- **Auth on every voice/admin endpoint** via `requireSupabaseAuth` + role check — closes prototype's open endpoints.

**Approval doctrine**: Comms release gated by role tier + automatic Finance sign-off on fiscal figures; blocked release if any figure diverges from live Ledger at approval time.

**Milestone**: simulated breaking-news drill completes end-to-end within one working day with zero unsourced factual claims.

---

## Phase 5 — GA Hardening (Weeks 43–48)
- Security audit (RLS coverage, endpoint auth, secret handling, watermarking, audit-log immutability).
- Accessibility audit (WCAG 2.2 AA everywhere; AAA on headline numbers + Session Mode, verified on physical projector).
- Performance passes: LCP < 1.5s on Instance Home over 10 Mbps; Ledger interactive < 3s; exports < 8s.
- External economist methodology review; comms-doctrine review with a former govt principal.
- Award-submission asset preparation (Awwwards/FWA/Red Dot).
- Fast-follow P1s queued: ministry feed API, benchmark overlays, briefing exports, trusted-source fast lane, Regional Commons reference feed, crisis mode, KPI-narrative linkage, State-of-the-Mandate export, CIS27 summit pipeline export.

---

## Cross-cutting workstreams (run parallel across phases)

- **Provisioning / Country Config screen** — required before Phase 1 has real data; ships with Phase 0.
- **Audit log** — immutable append-only table + trigger, established in Phase 0, extended each phase.
- **Export/document system** — introduced in Phase 3, reused by Comms Studio (Phase 4) and State-of-the-Mandate (P1).
- **Design review gate per phase** — six Experience Principles checked on every screen (§9, §19).
- **Reduced-motion parity** — added alongside every signature moment.

## Sequencing rationale
Phases are strictly dependent: Ledger → Engine reads from it → Studio quantifies its Gap → Cabinet Room rolls up Mandate over both → Narrative Chamber reads all prior chambers + external signal. Building out-of-order forces mock data that violates the provenance principle (§8.3).

## Immediate next step
Kick off Phase 0 bundle: extend `src/styles.css` tokens, seed `countries`/`sectors`/`user_roles` migrations, generalize `SignatureRing` into a data-driven primitive, and re-skin `/kiosk` on the new tokens.
