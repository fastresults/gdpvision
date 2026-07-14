# Ledger-QA — forensic triage & fix plan (country: LCA)

Investigation summary of what each row actually means today, then targeted fixes ordered by root cause.

## Findings

**A. "running…" checks that never resolve** (Why-this-number, Ask the Ledger, Ask refusal, Snapshot round-trip, Speak-this-number)
- Root cause: those `useQuery`s are declared with `enabled: false` (they cost credits or write data). `VerdictCell` treats `loading || !verdict` as "running…", so the idle state is indistinguishable from an in-flight fetch. They only fire when the user clicks **Run**, but the label lies and hides that.
- Fix: distinguish `idle` (never fetched, `enabled:false`, `fetchStatus==='idle'`) from `fetching`. Render `idle` as a neutral `— not run` chip so the operator knows to click Run.

**B. Sankey WARN 0→0, residual 0.0%**
- Root cause: `country_capital_flows` has **0 rows for LCA** (verified via DB). The Sankey enrichment sums to zero because no flow values were seeded yet — Stage 12 (capital_flows research) has not been committed for LCA.
- Fix: not a code bug — surface actionable detail. Change the enrichment check verdict to `warn: "No capital_flows committed — run Stage 12 for {cc}"` and add a link/CTA to the country's onboarding page so the operator can trigger it. No schema/logic change to the enrichment function itself.

**C. Freshness WARN "No series indexed yet"**
- Root cause: `getTrustSignals` counts series from `country_kpi_points` freshness buckets; LCA has no committed KPI points yet (only sectors/sources). Same class of missing-seed data as (B).
- Fix: same treatment — verdict copy reads `warn: "No KPI series committed — run KPI ingest for {cc}"` and links to the country onboarding surface. No behavior change in `getTrustSignals`.

**D. Source health FAIL 36/40**
- Root cause: 36 of 40 `country_sources` rows for LCA have `fetch_status='invalid_url'` because their `url` column contains **search-instruction prose** from the ingestion agent (e.g. `Saint Lucia National Trust official site (search: "…")`), not a real URL. HEAD fetches then fail. This is a data-quality bug upstream.
- Two-part fix:
  1. **QA row**: split the check into two: "Real URLs present" (fails on `invalid_url` count) vs "Reachable URLs" (only counts rows whose URL is a valid https URI). Report both counts explicitly so the operator sees "36 rows have non-URL text" separately from network reachability.
  2. **Data repair (one migration, safe)**: mark rows whose `url` does not match `^https?://` as `active=false` with `fetch_status='invalid_url'` (they already are). No delete. Follow-up (out of scope for this plan): patch the onboarding writer that persists these strings — flagged as a TODO in the plan output but not touched here to keep this change surgical.

**E. Publish gate WARN 1 blocked**
- Root cause: cascade of (B)/(C)/(D) — the gate correctly refuses to publish while sources are broken. Once B/C/D are surfaced, this row's `detail` should list *which* gates are blocked (not just count), so the operator can act.
- Fix: change verdict `detail` from `"1 gate(s) blocked"` to the joined names of the failing checks (`checks.filter(!pass).map(c=>c.key).join(", ")`).

## Changes (one file)

`src/routes/_authenticated/admin/ledger-qa.tsx` only. No server-function or schema changes.

1. Extend `Verdict` with `status: "pass"|"fail"|"warn"|"idle"`; update `VerdictCell` to render `idle` as neutral gray "— not run — click Run".
2. In the 5 `enabled:false` checks (`useExplainFigureCheck`, `useAskLedgerCheck`, `useAskLedgerRefusalCheck`, `useSnapshotRoundtripCheck`, `useHandoffCheck`): when `q.fetchStatus === 'idle' && !q.data && !q.error`, return `{status:"idle", detail:"Manual — costs credits / writes data"}` instead of leaving verdict `null`.
3. `useEnrichmentCheck`: when `capitalFlows.totals.inputs === 0`, verdict = `warn` with detail `"No capital_flows committed — run Stage 12"`.
4. `useTrustSignalsCheck`: keep current logic but improve the empty-corpus copy.
5. `useSourceHealthCheck`: compute `invalidUrls = rows.filter(r => !r.url || !/^https?:\/\//i.test(r.url)).length`; if `invalidUrls > 0` report `fail: "{invalidUrls}/{total} rows have non-URL text · {broken - invalidUrls} reachable failures"`.
6. `usePublishGateCheck`: list blocked check names in the detail string.

## Verification

- Reload `/admin/ledger-qa`; the 5 manual checks now show a gray "not run" chip instead of an ambiguous "running…".
- Click Run on each — verdict flips to pass/warn/fail with detail.
- Sankey, Freshness, Source health and Publish gate rows now explain *why* they are non-green and point at the corrective action.

## Out of scope (flagged for follow-up)

- The onboarding writer that persists search-instruction strings into `country_sources.url` for LCA is the real bug behind (D). Left untouched here; will file a separate plan once you confirm scope.
- Actually seeding capital_flows and KPI points for LCA is an operator action (Stage 12 + KPI ingest), not a code fix.
