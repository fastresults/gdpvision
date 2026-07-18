
# Chamber 04 — The FDI Transition Studio (Threat → Resilient Strategy)

## Value proposition (locked, distinct from other chambers)

**"A shock hits one sector. What does our FDI strategy need to become?"**

Chamber 04 is a **resilience workbench**: the user names a threat (tariff, hurricane, CBI wind-down, tourism collapse, key-employer exit, commodity price shock, sanctions, treaty change), points it at one or more sectors, and the tool computes the FDI exposure, then interactively builds a **resilient replacement strategy** — reallocating FDI targets across sectors, staging packages over a horizon, and stress-testing the resulting plan against the shock.

Distinct from siblings:
- **02** = accountability for what exists now.
- **03** = free-form policy simulation across any lever.
- **04** = shock-in → strategy-out. The threat is the input primitive; a resilient, staged FDI reallocation is the output. CBI wind-down is one preset among many, not the framing.

## Product flow (three acts, one chamber)

Left-to-right pipeline visible at all times as a numbered stepper:

**Act 1 — Name the threat** → **Act 2 — Rebuild the strategy** → **Act 3 — Stress-test & commit**

### Act 1 — Threat Composer
- **Threat picker**: preset chips (Tariff, Hurricane / Climate, CBI wind-down, Tourism demand collapse, Anchor employer exit, Commodity shock, Sanctions, Treaty / rules-of-origin change) + "Custom threat" free-text.
- **Targets**: multi-select sectors from this country's `sectors` table (color-coded, sorted by GDP share).
- **Shape** three sliders: **Severity** (0–100%), **Horizon** (1–10 yrs), **Onset** (immediate / phased / tail-risk).
- **AI framing (one call)**: on submit, Lovable AI writes a McKinsey-tone 3-bullet framing — mechanism, first-order FDI exposure, second-order sector spillovers — grounded in the country's corpus (sectors, ministry_profiles, kpis). Citations rendered as chips.
- Output: a **ThreatBrief** persisted to `fdi_threats` — the working record for Acts 2 & 3.

### Act 2 — Strategy Canvas (the money surface)
Split-pane canvas, always live:

- **Left rail — Exposure ledger**: for each sector, current GDP share, current FDI stock/flow (from `country_capital_flows` / `exposure_index`), and the AI-computed **exposure delta** the threat inflicts (pp of GDP at risk). Row order: highest exposure first. This is the "what breaks" column.
- **Center — Reallocation canvas**: a horizontal **Marimekko-style bar** representing 100% of the FDI envelope (current allocation on top, "resilient" allocation below). User drags handles between sectors to reallocate; each drag shows the new sector shares and the shortfall/surplus vs the exposure delta. Under the Marimekko, a **timeline strip** (year 1 → horizon) lets the user stage the reallocation by year (packages appear as blocks the user can slide across time).
- **Right rail — Resilience actions**: auto-suggested and user-editable packages, each with `{sector, target_pp, staging_year, action_type, sponsor_ministry}`. Action types: `attract_new_fdi`, `expand_existing`, `retain_at_risk`, `substitute_domestic`, `exit_wind_down`. Every action links back to the exposure row it's answering.
- **AI co-pilot (loop, not one-shot)**: "Suggest a resilient allocation" runs a Lovable AI pass that reads the ThreatBrief + current allocation + sector KPIs + ministry_profiles and returns a proposed reallocation + action set. The user accepts, edits inline, or re-prompts with a constraint ("no reduction in tourism sponsorship", "keep manufacturing under 15%"). Every AI-authored value is flagged with a small "AI" badge and its citations.

### Act 3 — Stress Test & Commit
- **Impact strip** (reuse `StatStrip`): Exposure closed (pp), Residual risk (pp), Diversification index change (HHI delta), Time-to-resilience (years), Ministries engaged.
- **Waterfall**: Baseline FDI exposure → sector-by-sector mitigation contributions → residual. Same visual grammar as Chamber 03's GdpFanChart family so numbers feel native.
- **Scenario table**: side-by-side vs. "Do nothing" and vs. current plan of record. Delta columns tabular-nums.
- **Commit**: three exit ramps, chosen explicitly:
  1. **Save as Draft strategy** (stays in Chamber 04).
  2. **Promote to Plan of Record** — writes each Action as a `packages` row (existing table), tagged with the source `fdi_threat_id`; visible in Chamber 02 as ministry commitments.
  3. **Model as Scenario** — deep-links to Chamber 03 with the reallocation pre-seeded.

## Country-scoped route tree

Mirror the Chamber 02/03 pattern (params-based, breadcrumbs back to `/onboard`):

- `/admin/countries/$code/studio` — layout, `SuperAdminShell wide`, sub-nav: **Threats · Strategies · Board**.
- `/studio/index.tsx` — **Threats list** + `+ New threat` (empty state guides straight into Act 1).
- `/studio/threats.new.tsx` — Act 1 composer.
- `/studio/threats.$id.tsx` — Acts 2 + 3 on one page (the stepper toggles the view; state persists so users can iterate).
- `/studio/strategies.tsx` — all committed / draft strategies for the country.
- `/studio/board.tsx` — kanban of promoted packages by status (Draft · Proposed · Approved · Active), grouped by originating threat.

`ChambersLauncher` Chamber 04 tile switches from the current `/instrument/studio/packages` search-param link to `/admin/countries/$code/studio` (params) — same pattern as Chambers 01–03. Legacy `/instrument/studio/*` routes stay; they aren't the launcher target anymore.

## Data model

Two new tables (both country-scoped, RLS-gated). Verified `packages`, `country_capital_flows`, `exposure_index`, `sectors`, `ministry_profiles`, `country_kpis` already exist.

- `fdi_threats` — one row per Act 1 submission: `id, country_code, name, threat_type, target_sector_codes text[], severity_pct, horizon_years, onset, brief jsonb (bullets + citations), created_by, created_at, updated_at, visibility, owner_country_code, uploaded_by`.
- `fdi_strategies` — one row per Act 2 canvas state: `id, fdi_threat_id, country_code, name, allocation jsonb (per-sector current/target/staging), actions jsonb (per-action shape above), metrics jsonb (Act 3 impact strip), status enum(draft, plan_of_record, superseded), promoted_scenario_id uuid null, promoted_at, created_by, created_at, updated_at, visibility, owner_country_code, uploaded_by`.

Both migrations include the mandatory `GRANT` block (see cloud-db rule), `ENABLE ROW LEVEL SECURITY`, and country-scoped policies using `has_country_access(auth.uid(), country_code)` for read/write plus admin-any policies — mirrors existing `packages`, `capital_flow_nodes` policies. Private/public split honored via the shared `enforce_private_ownership` trigger.

Reuse the existing `packages` table for Act 3's "Promote to Plan of Record" — insert one row per action with `country_code, sector_code, name, target_gap_pct, status='proposed', summary` referencing the source `fdi_threat_id`. No schema change to `packages`.

## Server functions (new, in `src/lib/fdi-resilience.functions.ts`)

All authed via `requireSupabaseAuth`.

- `createThreat({countryCode, threatType, targetSectorCodes, severity, horizon, onset, name?})` — inserts `fdi_threats`, runs the AI framing pass (Lovable AI, model default per project convention), grounds against country corpus via existing `country_chunks_search`, returns the row with `brief`.
- `listThreats({countryCode})` / `getThreat({id})`.
- `suggestResilientStrategy({threatId, constraints?})` — AI loop: reads threat + current allocation (derived from `country_capital_flows` + `country_sectors`) + KPIs + ministry_profiles, returns proposed `allocation` + `actions` shape. Idempotent; never mutates until `saveStrategy`.
- `saveStrategy({threatId, name, allocation, actions, status})` — upserts `fdi_strategies`; computes and stores `metrics`.
- `promoteToPackages({strategyId})` — inserts one `packages` row per action, tagged with the source threat/strategy id in `summary`, sets `fdi_strategies.status='plan_of_record'`.
- `promoteToScenario({strategyId})` — inserts a `scenarios` row with the reallocation preloaded, returns id for redirect to Chamber 03.

AI orchestration follows the project rule: Lovable AI Gateway via `src/lib/ai-gateway.server.ts`; corpus grounding via `country_chunks_search`; every AI-produced value carries citations rendered by `<PrettyJson>` with the ordered `citations` array (per the project memory rule).

## Components (new, under `src/components/studio/`)

- `ThreatStepper.tsx` — 3-step numbered stepper (Threat · Strategy · Stress test).
- `ThreatComposer.tsx` — Act 1 form + AI brief renderer.
- `ExposureLedger.tsx` — sector rows with exposure deltas and sparklines.
- `ReallocationMarimekko.tsx` — draggable 100%-width bar showing current vs resilient allocation.
- `StagingTimeline.tsx` — horizontal year-by-year strip with draggable action blocks.
- `ResilienceActionsRail.tsx` — right-rail action list with inline edit + AI badges.
- `StressTestPanel.tsx` — StatStrip + waterfall + comparison table.
- `CommitBar.tsx` — sticky footer with the three exit ramps.
- `StudioSubnav.tsx`, `ThreatCard.tsx`, `StrategyCard.tsx` for the index views.

Reuse: `StatStrip` (Chamber 03), `EvidenceRail` (Chamber 02), `SectorColor` helper, `PrettyJson`.

## Cross-links (mirror Chamber 02/03 discipline)

- 04 → 02: each Action's sponsor chip links to the ministry Delivery Dossier.
- 04 → 03: "Model this strategy as a scenario →" on Act 3.
- 02 → 04: on ministry dossiers with high exposure, one quiet link: "Under-resilient? Open the FDI Transition Studio →".
- 03 → 04: on scenario detail, if the scenario was promoted from a strategy, "Baseline: {Threat name} in Chamber 04".

## Technical notes

- Files: routes at `src/routes/_authenticated/admin/countries.$code.studio*.tsx`; components at `src/components/studio/`; server fns in `src/lib/fdi-resilience.functions.ts`; two DB migrations for `fdi_threats` + `fdi_strategies` with the required GRANT + RLS blocks.
- Country resolution via `useChamberCountry` (route param).
- AI grounding uses existing corpus RAG (`country_chunks_search`); do not build a new retriever.
- Numeric UI: all pp/% values `tabular-nums`, 1 decimal, right-aligned; JSON payloads render via `<PrettyJson>` with citations.
- Drag interactions: native HTML5 DnD for Marimekko handles and timeline blocks; no new dep.
- Auth: all new fns `requireSupabaseAuth`; routes under `_authenticated/`.
- Do NOT delete legacy `/instrument/studio/*` routes.

## Out of scope

- No changes to Chambers 01/03/05/06 beyond the two small cross-links noted.
- No new corpus ingest — Chamber 04 reads what onboarding has already committed.
- No multi-country / regional shocks in this pass (single-country only; regional in a follow-up).
- No PDF export in this pass (add to Narrative Chamber later).
