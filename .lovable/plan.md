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

## AI explanations of gaps

- The AI runs only for meaningful gaps, as a batch per country. It starts after onboarding is committed, and also from a "Refresh peer analysis" button for admins.
- It uses the existing source library first, then web research, then the AI gateway fallback. It must cite sources and say what is unknown. Output that does not fit the expected format, or has no citations, is thrown away.
- Results are saved with a version tag for the input data. They are refreshed only when a peer's figure changes, so there are no duplicates and re-running is safe.
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
- Run `bun run headers && bun run map`. Check with type checks, unit tests on the statistics (ties, fewer than 5 peers, MAD = 0), and a signed-in Playwright run of hover in all three views.

## Open question

Should the peer group default to all Caribbean countries in the system, or to the OECS only?
