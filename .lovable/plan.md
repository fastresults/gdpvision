# Make Portfolio delivery status valid and auditable

## Audit finding
The current **On / At risk / Off** display is not yet a defensible performance measure.

- Antigua has 18 verified headline readings, but **0 targets** and **0 historical observations**.
- There are **0 ministry-owned delivery KPIs**, **0 goal-cycle actuals**, and **0 cadence snapshots** in the database.
- The page calculates status from one latest value versus one target, using fixed 5% and 15% bands. With no targets, every item falls into a hidden fourth state, so the table misleadingly shows `0 / 0 / 0`.
- Sector-to-KPI selection uses the first keyword match rather than a governed ministry scorecard.
- Direction handling is incorrect for stored values such as `down`: debt, inflation, unemployment, and poverty can be interpreted backwards.
- Freshness, trend, source quality, target date, and statistical volatility do not affect the current result.
- The index and ministry dossier duplicate the scoring logic and use different roll-up rules.

## Recommended approach
Replace the present counters with a **Qualified delivery scorecard**. No KPI receives a green, amber, or red status until it passes a visible qualification gate.

### 1. Correct the page immediately
- Replace misleading `0 / 0 / 0` with **Not yet measured** when no KPI qualifies.
- Add a visible fourth count, **Unscored**, so missing targets or actuals never disappear.
- Rename the heading to **On / At risk / Off / Unscored** and show the qualified denominator.
- Correct direction handling through one shared scoring module used by both the Portfolio index and minister dossier.

### 2. Establish a qualification gate
A KPI is qualified only when it has:
- a ministry owner and explicit sector mapping;
- a baseline value and baseline period;
- a target value, target period, direction, and reporting cadence;
- a named target basis: approved policy commitment, peer benchmark, or approved scenario;
- a source URL or internal evidence reference;
- a current actual for the expected reporting period;
- a verification timestamp and no unresolved data-quality failure.

Anything failing the gate remains **Unscored**, with the missing fields listed. AI-inferred values may support research but cannot qualify a performance status until approved.

### 3. Score progress against the delivery path
For qualified numeric KPIs, assess current progress against where the KPI should be now—not merely against the final target.

- Normalize progress from baseline toward target, respecting `up`, `down`, and bounded/target-range measures.
- Compare actual progress with elapsed time between baseline and target period.
- Use KPI-specific tolerance bands when approved; otherwise use conservative defaults.
- **On track:** inside or ahead of the expected path.
- **At risk:** behind the expected path but within the warning tolerance, or moving in the wrong direction for one reporting cycle.
- **Off track:** beyond the critical tolerance, moving adversely for two cycles, or materially overdue.
- **Unscored:** qualification failed, evidence is too old, or there is insufficient observation history.

Where at least four comparable observations exist, add a volatility-adjusted check so ordinary noise does not trigger red. Until then, label the assessment **provisional** and use approved tolerance bands rather than pretending statistical confidence.

### 4. Add confidence and evidence quality
Show each status with a confidence level based on:
- target and baseline governance;
- source verification;
- recency versus cadence;
- number of observations;
- consistency of the ministry/sector mapping.

Freshness must be calculated from the observation period and cadence at read time. Do not trust the existing static `fresh` label indefinitely.

### 5. Use governed ministry KPIs
- Use the existing ministry KPI and goal-cycle workflow as the authoritative scorecard source, not keyword-selected national headline indicators.
- Extend the KPI record additively with the missing qualification fields: baseline period, direction, target basis, evidence reference, tolerances, and verification metadata.
- Add a guided **Set up measurement** action from each unmeasured portfolio to the existing KPI workspace.
- Require review before a KPI becomes qualified; preserve every status change in the audit history.

### 6. Present an executive but honest roll-up
- Keep the colored counts, but count only qualified KPIs.
- Show **Qualified X of Y** beside them and make Unscored prominent.
- Rank ministries by severity only after minimum coverage is met; otherwise rank them by measurement readiness rather than inferred delivery risk.
- In each dossier, list the KPI, actual, expected value, variance, direction, trend, freshness, confidence, and evidence.
- Add **Explain this** to every derived status and aggregate, including the exact arithmetic and exclusions.

## Technical implementation
- Add an additive database migration for KPI qualification metadata and auditable review state; retain existing columns and policies, with grants and row-level access matching the current `kpis` table.
- Build a pure shared scoring module with tests for up/down/flat, missing values, stale evidence, insufficient history, target dates, tolerance boundaries, and volatility.
- Extend the authenticated Portfolio data function to return governed KPIs, goal-cycle actuals, qualification failures, and computed status evidence.
- Replace both duplicated page classifiers with the shared result.
- Do not use the existing synthetic trend generator for accountability status; only real observations may affect classification.
- Update the KPI setup form to collect and validate every qualification field, then update Portfolio index and dossier displays.

## Validation
- Confirm Antigua initially shows **Not yet measured / 0 qualified** rather than three zeros.
- Create test fixtures covering all four states and both positive and negative KPI directions.
- Verify stale or unsupported evidence automatically becomes Unscored.
- Verify the same KPI has the same status on the index and dossier.
- Test desktop/mobile layouts, keyboard access, explanation dialogs, type checks, map checks, and the live authenticated flow.
