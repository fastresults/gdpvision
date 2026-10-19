# PRD · Caribbean Indices

**Product:** GDPVision (gdpvision.com), consumed by GDP Advisor (gdpadvisor.com)
**Status:** method version 0 (draft) — tables, runner, scoring and partner API shipped; first official edition pending sign-off
**Date:** 19 October 2026
**Code:** `drizzle/migrations/0040_caribbean_indices.sql` · `src/lib/indices/*` · `src/lib/public-data/indices.server.ts`
**API contract for GDP Advisor:** `docs/api/gdp-advisor-caribbean-indices.md`

GDPVision publishes four Caribbean indexes, each scored 0–100 for every registry state, built only
from cited, licensed source data and calculated by fixed formulas anyone can rerun. Every score
carries a **Sextant** rating of how well-measured its inputs are.

| Index | Code | Pillar | Question | Global benchmark it answers |
| --- | --- | --- | --- | --- |
| Caribbean Growth Index | CGX | GDP | How strong, diversified and well-measured is the economy? | IMD World Competitiveness (economic performance) |
| Caribbean Human Index | CHX | Human Quality | Does growth reach people? | UNDP Human Development Index |
| Caribbean Governance Index | CGV | Governance | Does the state deliver what it budgets, accountably? | World Bank WGI, TI CPI |
| Caribbean Capital Index | CCX | Investment | How easily can capital and firms enter, operate and stay? | World Bank B-READY |

Always published with the house name: "GDPVision Caribbean Growth Index".

Why: the global indexes leave Caribbean gaps. CPI 2025 does not score St. Kitts and Nevis, Antigua
and Barbuda or Belize; B-READY schedules no edition through 2027 for Dominica or St. Kitts and Nevis.

---

## 1. Where it lives

| Layer | Where | Who writes |
| --- | --- | --- |
| Method: indexes, pillars, indicators, goalposts, sources, licences | `index_specs`, `index_pillars`, `index_indicators` | Migrations only (versioned) |
| Documentary and external-assessment values | `index_evidence` (verified by a second person) | Data stewards via `saveIndexEvidence` / `verifyIndexEvidence` |
| Runs | `index_runs` | Runner (`run.server.ts`) |
| Frozen inputs (every value used or excluded, with reason) | `index_inputs` | Runner |
| Scores, pillars, coverage, Sextant | `index_scores` | Runner, via pure `scoring.ts` |
| Releases (tracker / edition, sign-off, publication) | `index_releases` | Runner drafts; admin publishes |

Evidence follows a two-person rule enforced by a database trigger (`index_evidence_guard`): new rows are unverified, the verifier cannot be the person who entered it, and any edit clears verification.

RLS: the method layer is readable by anyone. Runs, inputs, scores and releases are readable by
admins and data stewards, and by any signed-in user only once their release is a **published
official edition**. A database CHECK makes it impossible to publish a tracker or an unsigned edition.

## 2. Data flow

1. **Gather.** One request per active indicator: World Bank WDI and IMF WEO DataMapper are pulled
   directly (keyless, grade C). IMF projections and staff estimates are dropped — only years up to
   the cut-off year minus two.
   Registry KPIs (`kpi` source kind) are used only when public and verified or entered by a person. Documentary and
   external-assessment indicators read **verified** `index_evidence` rows only, each with an https
   document link. Nothing is AI-assembled.
2. **Score** (`src/lib/indices/scoring.ts`, no I/O, unit-tested).
3. **Freeze** every input in `index_inputs`; write `index_scores`.
4. **Release.** `tracker` runs draft a provisional, private tracker; `edition` runs (manual only)
   draft an official edition that an admin signs off and publishes (`publishIndexRelease`).

Triggers: pg_cron → `POST /api/public/hooks/indices` (`x-hook-secret`) — weekly `watch` (Mondays
05:10 UTC), monthly `tracker` (2nd, 05:20 UTC). Admins: `runIndicesNow({ mode })`.

## 3. Method

Built on the OECD/JRC *Handbook on Constructing Composite Indicators* (2008), ten steps.

- **Indicator score:** `100 × (x − worst) / (best − worst)`, clipped 0–100, log scale where flagged.
  Goalposts are fixed per method version so edition-to-edition moves are real.
- **Windows:** latest value; 5-year mean; 10-year standard deviation; distance outside a target band.
  A multi-year window needs ≥ 80% of its years.
- **Age tolerance:** per indicator (default 3 years). Older values are excluded as `stale`, never
  carried forward.
- **Pillar:** weighted mean of indicator scores, only if ≥ two-thirds of its indicators *with a live source* are valid. Pending-source indicators are listed in coverage and lower the Sextant; they never count as zero.
- **Index:** geometric mean of pillar scores (each floored at 1), only if every pillar is scored.
- **No imputation.** A state below coverage is `not_scored`, with the missing pillars named.
- **Grades:** A government current year · B government prior year/partial · C multilateral ·
  D analyst reconstruction. Values GDPVision itself estimates are never inputs; a multilateral's
  published series (including ILO estimates) is taken as reported, grade C.
- **External composites** (WGI, EGDI, UHC index) carry at most 20% of any index's weight; the scoring code scales them down within a pillar when they would exceed it, and a pillar made only of composites is not scored.
- **Sextant:** availability 30% · timeliness 25% · grade quality 30% · source health 15%;
  bands Clear ≥ 80 · Fair ≥ 60 · Hazy ≥ 40 · Obscured < 40.

The full indicator list — 49 indicators with source codes, fallbacks, goalposts, licence status and
age tolerances — is the seed in `0040_caribbean_indices.sql` and is served live by
`GET /api/public/v2/indices`.

## 4. Status of the indicator base (method v0)

| Index | Active | Pending source | Live from APIs today | Needs evidence entry |
| --- | --- | --- | --- | --- |
| CGX | 8 | 3 (diversification pillar) | 8 (WDI, IMF WEO) | — |
| CHX | 11 | 3 | 11 (WDI) | — |
| CGV | 12 | 0 | 1 (WGI via WB API) | 11 documentary / assessment |
| CCX | 11 | 1 | 3 (WDI) | 8 documentary / assessment |

Consequences, by design: CHX can score as soon as the first run completes; CGX shows the
diversification pillar `not_scored` until sector and export data have real sources; CGV and CCX
score once stewards enter verified evidence.

## 5. Governance

- Method version frozen and published ≥ 30 days before an edition's data cut-off.
- Factual-correction window of 10 working days: governments see their own inputs, never draft scores.
- Only public, licensed data enters a score; Mandate Compact, Cabinet records and the investment
  pipeline never do.
- Methodology panel ratifies goalposts before the first edition; external statistical audit (EU JRC
  or academic panel) requested before first public release.
- Published editions are never overwritten; corrections are numbered revisions with a changelog.

## 6. Not yet built (next phases)

- [ ] Freeze method v1 by migration after the methodology panel ratifies goalposts — `publishIndexRelease` refuses while any index is `draft`
- [ ] Uncertainty: 1,000-run sensitivity on weights, scoring and aggregation → published rank range
- [ ] External validation report (Spearman vs WGI, HDI, CPI, B-READY)
- [ ] Admin page for runs, evidence entry and sign-off (server functions exist)
- [ ] API clients for WHO GHO, UNCTADstat, UN Tourism / CTO, ECCB
- [ ] Replace AI-sourced sector shares and capital-flow ledger before they can feed CGX / CCX
- [ ] Licence confirmation for every `to_confirm` source; a release is blocked while any input lacks one
