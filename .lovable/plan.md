# Differentiating Chamber 02 vs Chamber 03

## The problem

Today Chamber 02's ministry page ends in a "Scenarios" section with a **New scenario** CTA that hands off to Chamber 03's builder. That makes 02 read as "a lightweight scenario launcher" — a diet version of 03 — instead of a chamber with its own reason to exist. A cabinet-tier user opening 02 and 03 back-to-back sees the same primitives (sectors, KPIs, a scenarios list) and rightly asks why both exist.

## The two value propositions (locked)

Rewrite the mental model so each chamber owns one job:

- **Chamber 02 — Portfolio Workspaces → "Who owns what, and how is it performing *today*?"**
  Backward- and present-looking. The permanent record of ministerial accountability: who the minister is, which sectors they own, how those sectors are performing against KPI targets, where delivery is at risk, what evidence backs each claim. Read-heavy, evidence-heavy, no simulation.

- **Chamber 03 — Scenario Engine → "What happens *if* we change a lever?"**
  Forward-looking only. Pure hypothesis workspace: pick levers, run a projection, compare, narrate. Never the system of record for a ministry's current state.

The dividing line: **actuals + accountability live in 02. Counterfactuals + projections live in 03.** No exceptions.

## What changes in Chamber 02

Rebuild `countries.$code.portfolio.$ministry.tsx` around a Delivery Dossier, not a scenario launcher:

1. **Minister & mandate header** (keep, tighten). Portrait, name, party, appointed date, contact, plus a new one-line **mandate statement** pulled from `ministry_profiles`.
2. **Portfolio scorecard strip** — 4 tiles: total GDP share owned, # sectors, # KPIs on/near/off-track (from `country_kpi_points` vs targets), evidence coverage % (share of KPIs with a cited source in the last 24 months). This is the "how is it performing today" answer at a glance.
3. **Sectors table** (keep) — add an on/near/off-track pill per sector derived from its KPIs.
4. **KPI performance panel** — replace the current small-multiples strip with a delivery-oriented table: KPI, latest value, target, variance, trend sparkline, last-updated, source chip. Sorted by variance so risk floats to the top.
5. **Programmes & commitments** — render `ministry_profiles.programmes` and any mandate items already in the corpus, each with citation chips. This is Chamber 02's unique surface; 03 doesn't touch it.
6. **Evidence rail** — collapsible list of `onboarding_citations` scoped to this ministry, so an admin can audit *why* the dossier says what it says.
7. **Remove** the "Scenarios (N) / New scenario" block entirely from the ministry page. Replace with a single quiet cross-link at the bottom of the page: *"Model a change to this portfolio → Chamber 03"* that deep-links to `/scenarios/new?ministry=…`. Chamber 02 stops being a scenario surface.

Chamber 02 index (`portfolio.index.tsx`) becomes a **cabinet-wide accountability grid**: one row per ministry with the same on/near/off-track counts and evidence coverage %, sortable — the Prime Minister's view of delivery across the whole cabinet.

## What changes in Chamber 03

Mostly reinforcement — make sure 03 doesn't drift back into "system of record" territory:

1. Every scenario view labels itself **Projection** in the header chip; baseline values are labeled **Actual (Chamber 02)** with a link back to the source ministry dossier.
2. Remove any UI in 03 that lets a user edit ministry composition, KPI targets, or sector weights — those are 02's job. 03 reads them.
3. Add a "Baseline from" line on every scenario referencing the ministry/portfolio it's projecting against, with a link to Chamber 02.

## Cross-linking rules

- 02 → 03: single "Model a change" link per ministry, bottom of page.
- 03 → 02: every scenario shows "Baseline: {Ministry}" linking back.
- Neither chamber embeds the other's primary workspace.

## Technical notes

- Files to edit: `src/routes/_authenticated/admin/countries.$code.portfolio.$ministry.tsx`, `countries.$code.portfolio.index.tsx`, `countries.$code.portfolio.tsx` (nav copy), and the Chamber 03 scenario detail/new/index routes for the labeling/baseline changes.
- New components: `PortfolioScorecard`, `KpiDeliveryTable`, `ProgrammesList`, `EvidenceRail` under `src/components/country/portfolio/`.
- Data sources are already present: `ministry_profiles` (mandate, programmes, citations), `country_kpis` + `country_kpi_points` (actuals vs target for on/near/off-track), `onboarding_citations` (evidence rail), `getPortfolio` (composition). No schema changes required.
- On/near/off-track thresholds: on = variance within ±5% of target, near = ±5–15%, off = >15%. Configurable constant, not per-country.
- Keep existing routes and URLs; this is a surface rewrite, not a routing change.

## Out of scope

- No changes to Chambers 01, 04, 05, 06.
- No new AI research passes; uses corpus data already committed by onboarding.
- No schema migrations.
