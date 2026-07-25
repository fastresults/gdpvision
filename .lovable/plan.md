
# Chamber 04 · FDI Transition Studio — v2 (Macro ↔ Micro, FDI-first)

Feedback: current studio (threat → strategy → stress) is a mechanical workbench. It doesn't answer the two questions a PM/Investment Minister actually asks: *"What's our FDI posture right now?"* and *"What do we do — by ministry, this quarter, this year — to attract the capital that closes the gap?"*

v2 reframes the chamber around **FDI attraction as the operating goal**, adds a **Macro Board** entry point above the current threat flow, and turns strategies into a **timeboxed, ministry-owned playbook** (30d / 3m / 6m / 12m) — cabinet-ready.

## Two-tier architecture

```text
/admin/countries/$code/studio
├─ (index)               ← NEW: Macro FDI Board (national posture)
├─ /sectors/$code        ← NEW: Micro sector transition dossier
└─ /threats/$id          ← existing threat→strategy flow, refit as one lens
```

### Tier 1 · Macro FDI Board (new landing)
One screen a Prime Minister can read in 60 seconds:

- **FDI Posture Score** (0–100) — composite of concentration risk (HHI), sector diversification vs. peers, active pipeline value, and mitigation coverage. Big number + trend arrow.
- **Concentration Map** — treemap of current GDP by sector, tinted by FDI dependency and shaded red where exposure > threshold. Click → Micro dossier.
- **Peer Benchmark Strip** — 3 Caribbean peers (from `countries` + `country_sectors`) side-by-side on 4 metrics: FDI/GDP, sector HHI, top-3 concentration, diversification velocity.
- **Capital Gap** — target vs. current FDI inflow, with the *"what we must attract"* number front and center (USD, % of GDP).
- **Active Transitions** — chips for every open threat/strategy with status, ministries engaged, residual risk.
- **Investor Value Proposition** (AI, one paragraph, cited from the corpus) — plain-English pitch to prospective FDI, refreshed per session.

### Tier 2 · Micro Sector Transition Dossier (new)
Per-sector deep dive when a user drills in from the map or a threat:

- Header: sector share, FDI dependency, top source countries (from `capital_flow_nodes`), grade.
- **Transition Thesis** (AI) — "From what → to what," e.g. *"From cruise-dependent tourism → high-value stay-over + med-tourism."*
- **FDI Attraction Angles** — 3-5 investable propositions with target investor archetypes, ticket sizes, precedents (cited).
- **Ministry Web** — force-directed mini-diagram: which ministries must move together (from `ministry_sectors`).
- **Playbook Timeline** (below).

## The 30d / 3m / 6m / 12m Playbook (core new artifact)

For every strategy (and available at macro level as a rolled-up cabinet plan), generate a **timeboxed transition playbook** owned by named ministries.

```text
┌ 30 DAYS ────────────────────── Signal & unblock
│  • Investment Promotion Agency: launch expression-of-interest for X
│  • MoF: table fiscal incentive amendment (draft)
│  • MoT: publish revised sector roadmap
├ 90 DAYS ────────────────────── Structure & de-risk
│  • Legal reforms filed; PPP framework adopted
│  • 2 anchor investor meetings booked
├ 6 MONTHS ───────────────────── Land & anchor
│  • First MOU signed (target USD X)
│  • Skills program with MoE launched
└ 12 MONTHS ──────────────────── Compound & measure
   • FDI inflow +Y% vs. baseline
   • Exposure reduced Z pp
```

Each horizon lists: **owner ministry**, **action**, **investor signal**, **KPI + target**, **evidence citation**. Statuses roll up to the Cabinet Room (Chamber 06) and can be published to Narrative (Chamber 05).

## AI pipeline (3-pass, cited)

1. **Posture pass** — Gemini reads `country_sectors`, `capital_flow_nodes`, `exposure_index`, `country_kpis` → produces FDI Posture Score inputs, peer benchmark selection, capital gap number.
2. **Thesis pass** — Perplexity `sonar-reasoning-pro` deep-research per sector: transition thesis, investable angles, precedents, target investor archetypes. Every claim must carry a corpus citation via the standard writers/searchers.
3. **Playbook pass** — Gemini structured-output into the 30/3/6/12 schema, keyed to ministries from `ministry_sectors`, with KPI targets pulled from `country_kpis`.

All outputs render via `<PrettyJson>` where they surface as JSON, and via `<CitedMarkdown>` for prose.

## Data model additions

New tables (each with GRANTs + RLS + `has_country_access`):

- `fdi_posture_snapshots` — per-country score, components, peer refs, capital_gap_usd, generated_at, citations jsonb.
- `fdi_transition_theses` — per (country_code, sector_code): thesis, angles jsonb, investor_archetypes jsonb, precedents jsonb, citations jsonb.
- `fdi_playbooks` — parent row per strategy or macro rollup.
- `fdi_playbook_actions` — child rows: horizon (`30d|3m|6m|12m`), ministry_id, action, investor_signal, kpi_id, kpi_target, status, evidence_citation_id.

## UI components (new under `src/components/studio/`)

- `MacroFdiBoard.tsx` — landing hero + posture score + capital gap.
- `ConcentrationMap.tsx` — FDI-tinted treemap.
- `PeerBenchmarkStrip.tsx`.
- `InvestorValueProp.tsx` — AI paragraph with citations.
- `SectorTransitionDossier.tsx` — micro page shell.
- `MinistryWeb.tsx` — small force graph.
- `PlaybookTimeline.tsx` — horizontal 4-horizon rail with ministry swimlanes; editable inline; owner chips.
- `PlaybookActionRow.tsx`.
- `PublishToCabinetButton.tsx` / `PublishToNarrativeButton.tsx` — reuse existing handoff pattern.

All buttons use `btn-primary/secondary/ghost`; all JSON via `<PrettyJson>`; timeline uses `sector-*` and `signal-*` tokens only.

## Server functions (new under `src/lib/fdi-studio/`)

- `posture.functions.ts` → `computeFdiPosture`, `refreshFdiPosture`.
- `thesis.functions.ts` → `researchSectorThesis` (Perplexity + corpus writes).
- `playbook.functions.ts` → `generatePlaybook(strategyId | {countryCode})`, `updatePlaybookAction`, `rollupToCabinet`.
- `peers.functions.ts` → `pickPeers(countryCode)` (region + GDP band).

All `.middleware([requireSupabaseAuth])`, called from components via `useServerFn` + `useQuery` (never public loaders). Deep research uses the existing corpus gateway/writers; no direct Perplexity from components.

## Routing

- `studio/index.tsx` — replaced by Macro Board. The current "Name the threat" landing moves to `studio/threats/new`.
- `studio/sectors/$sectorCode.tsx` — new micro dossier.
- Existing `studio/threats/$id` kept and enhanced: its Stress panel gains the Playbook Timeline as the primary artifact; old panels move under "Analyst view" (same pattern as Chamber 03 v3).

## Cross-chamber wiring

- **Chamber 06 Cabinet** — playbook actions surface as Decisions/Commitments (`decisions`, `commitments`), grouped by horizon.
- **Chamber 05 Narrative** — Investor Value Prop + top angles publish as a comms artifact draft.
- **Chamber 08 Mandate Compact** — playbook actions link back to pillars/deliverables where sector maps.

## Rollout

1. Migrations (tables + GRANTs + RLS) + type regen.
2. Posture + peers server fns + Macro Board.
3. Thesis pass + Sector Dossier route.
4. Playbook generator + Timeline component; wire into existing threat page.
5. Cabinet/Narrative/Compact handoffs.
6. Update `docs/map/chambers.md` + Chamber 04 row; run `bun run headers && bun run map`.

## Explicitly out of scope

- No changes to Chamber 03 engine.
- Existing threat CRUD stays; only its result surface changes.
- No new secrets; uses existing `LOVABLE_API_KEY` and `PERPLEXITY_API_KEY`.
