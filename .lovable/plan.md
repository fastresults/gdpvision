# Caribbean peer comparison in the "What this means" panel

## Recommendation

Calling the AI on every hover is too slow for the panel's 1.5-second window, costs money on every pass of the mouse, and gives different wording each time. So the work is split into two layers:

1. **The numbers:** a fixed peer benchmark, worked out from stored data. It shows instantly on hover and gives the same answer every time.
2. **The explanation:** the AI writes why each gap exists. It runs ahead of time for each country and indicator, is saved, and is shown on hover alongside the numbers. Nothing waits on the AI while you hover.

The AI only explains gaps that pass a statistical test. It never decides whether a gap exists.

## What the user sees

The panel gets a new **"Versus the Caribbean"** row, placed between Current reading and Trend, in the Regional, Global flows and Globe views:

- **Position:** rank and percentile, e.g. "4th of 14 · 72nd percentile", plus the peer median and range.
- **Gap:** the difference from the peer median, in the indicator's own units (2 decimals), with a positive/negative tag. It is marked **"Meaningful"** only when it passes the test below. Otherwise it reads "Within the normal Caribbean range".
- **Likely drivers:** 2–3 short reasons from the AI, each with a source number [N] that opens the source, and labelled "Inference".
- **Coverage:** how many peer countries have comparable data, and for which period. If fewer than 5 peers have data, it reads "Not enough peer data to compare".
- A small strip chart: each peer is a dot, and the selected country is shown in gold.

What is compared, by layer:
- **Macro and sector marks:** the same indicator or sector share.
- **Capital flows:** flows as a share of GDP, so countries of different sizes can be compared.
- **Legend items:** what the comparison means.
- **Ministry, source-document and live-conditions marks:** no comparison. The panel says why.

## How "meaningful" is decided (fixed rules)

- **Peer group:** the Caribbean countries in the existing country list. OECS-only is offered as a switchable option.
- **Like for like:** only the same indicator key and unit, with each peer's latest reading no more than 2 years apart.
- **Robust z-score:** \((x - \text{median}) / (1.4826 \cdot \text{MAD})\).
- **Meaningful** means |z| ≥ 1.5, at least 5 peers, and a gap larger than the noise level set for that indicator.
- Every figure is registered with "Explain this" (formula, peers used, periods).

## Step 1 — Data scrub (first finding already in)

A read-only check of the current data found:
- **Coverage is good:** 22 countries, and each has economic indicators, capital flows and sector data. 18 indicators are recorded for 21–22 countries each, so every indicator is well above the 5-peer minimum.
- **Units don't match:** unemployment is recorded in 4 different units, and most other indicators in 2. The same indicator can't be compared until these are standardised.
- **Periods are written as free text:** for example "2026 (projection)", "FY2024/25", "January–April 2024" and "latest available (IMF …)". Periods have to be converted to a single year, and projections separated from actual figures.
- **Some data is old or missing:** poverty figures go back to 2006, and each indicator has 0–3 blank values.

The scrub will:
1. Convert units to one standard unit per indicator, using a fixed conversion table (for example percent vs ratio, USD vs USD millions).
2. Convert each period to one reference year, and flag projections.
3. Leave out of the comparison any figure that is blank, a projection, or more than 3 years older than the peer median. Nothing is deleted; each figure is just marked as excluded, with the reason.
4. Flag extreme outliers (possible data-entry errors) for an admin to review, rather than treating them silently as real gaps.
5. Produce a one-page data quality report for each indicator: countries included, reasons for exclusion, and unit fixes. It sits alongside the peer analysis.

The scrub only adds cleaned copies of the figures. The original records are never changed.

## Step 2 — AI explanations of gaps, on a schedule

- **First run now:** as soon as this is built, do a full regional run covering the scrub, the statistics and the AI explanations for the meaningful gaps.
- **Monthly refresh at 02:00 UTC on the 1st of each month:** re-scrub, recalculate, and re-explain only the gaps whose inputs have changed. That is one run per month, so the extra running cost is minimal.
- **Safeguards:**
  - Each run handles a limited number of countries.
  - A database lock stops two runs from overlapping.
  - Finished items are recorded, so a re-run skips them.
  - An AI credit or permission error (402/403) pauses the job and tells admins why. Rate limits (429) wait until the next run.
- Admins can still start a run with a "Refresh peer analysis" button. The last run's time and status are shown.
- The AI uses the existing source library first, then web research, then the AI gateway fallback. It must cite sources and say what is unknown. Output that does not fit the expected format, or has no citations, is thrown away.
- If no explanation has been saved yet, the panel shows the numbers and "Explanation pending", and never shows made-up text.

## Privacy and access

- Peer figures use only public records from other countries. A country user never sees another country's private data. Only summary statistics and public values are shown.
- Shared public scenes include a saved copy of the public comparison only.

## Technical section

- New table `peer_benchmarks`. One row per country, indicator and period, holding median, MAD, n, rank, percentile, z, the meaningful flag, the peer set and an input hash. It includes GRANTs, row-level security and a read policy checked against country access.
- New table `peer_gap_explanations`, keyed on country + indicator + input hash, with drivers and ordered citations. It is updated in place rather than duplicated.
- `src/lib/sovereign-eye/peer-benchmark.server.ts` does the fixed statistics and is a pure function. `peer-benchmark.functions.ts` provides `getPeerBenchmarks` (protected, all records for one country in a single request, added to the workspace data) and `refreshPeerAnalysis` (admins only, runs the AI batch).
- The `MapFeature` data gets a `peer` block. `InterpretationPanel` gets a `PeerRow` and the strip chart. `GlobeView` and the Global flows view use the same features, so they need no separate code.
- The Explain entry `sovereign-eye.peer-gap` is added to `sovereign-eye-entries.ts`.
- Scrub output goes in `peer_kpi_normalized` (country, kpi_code, value_std, unit_std, ref_year, is_projection, excluded_reason, outlier_flag, source kpi id), filled by upsert on (country, kpi_code). A job-status table, `peer_analysis_runs`, holds the lock and lease, progress, and pause reason.
- The job runs from the public route `src/routes/api/public/hooks/peer-analysis.ts`, which checks for `x-hook-secret` using the existing `verify-hook.server.ts`. It is scheduled with pg_cron `0 2 1 * *`, added with the same secret pattern as the existing cron jobs, and triggered once by hand after it is deployed.
- Run `bun run headers && bun run map`. Check with type checks, unit tests on the statistics (ties, fewer than 5 peers, MAD = 0) and on unit and period parsing, and a signed-in Playwright run of hover in all three views.

## Open question

Should the peer group default to all Caribbean countries in the system, or to the OECS only?
