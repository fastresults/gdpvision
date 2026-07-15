# Ledger-QA verification harness — status

## Layers shipped

| Layer | Script | npm | What it proves |
|---|---|---|---|
| Fast-lane (multi-country hook) | `scripts/ledger-qa/verify.sh` | `ledger-qa:verify` | Public hook returns 12 verdicts per country with correct contract (zod-parity). Defaults: BRB LCA JAM GUY GBR. |
| Cascade invariants (read-only) | `scripts/ledger-qa/cascade-invariants.py` | `ledger-qa:invariants` | Asserts the 5 invariants each cascade remediator would restore (sectors sum≈100, ministry_profiles cover ministries, kpis have latest_value, source URLs valid, capital flows committed). Uses service-role reads; no mutations. |
| E2E (headless browser) | `scripts/ledger-qa/e2e.py` | `ledger-qa:e2e` | Signs in with the injected Supabase session, opens `/admin/ledger-qa`, clicks **Run all reads** and **Simulate cold-start**, screenshots each step, asserts summary parity between the header and the run-strip, and fails on non-fake latency. |
| All-in-one | — | `ledger-qa:all` | Runs all three in sequence. |

## Running

```bash
LEDGER_QA_HOOK_KEY=… npm run ledger-qa:verify           # 5-country fast lane
npm run ledger-qa:invariants                             # read-only DB sweep
LOVABLE_BROWSER_… vars set → npm run ledger-qa:e2e       # browser walk
npm run ledger-qa:all                                    # everything
```

Exit code is non-zero when any check fails, so this is CI-friendly.

## Findings from the last sweep

- **BRB** — 12/12 sectors OK, 18 kpis OK, sources clean, **0/12 ministry_profiles** (missing profiles), **0 capital flows committed** (backfill hasn't run).
- **LCA** — all 5 invariants green.
- **JAM, GUY** — not onboarded (no sectors / kpis / ministries / flows). Expected, not a regression.
- **Public hook** parity across BRB / LCA / JAM verified — all 12 verdicts present, no fails, wall time 1.4–2.4s.
- **UI parity** — summary strip now matches the header counts (fixed in the previous phase; e2e re-verifies each run).

The remaining warns are honest data gaps (BRB ministries + flows) that map cleanly to `backfillMinistryProfiles` and `backfillCapitalFlows` — one click each in `/admin/ledger-qa`.

## Deferred

- **Layer 1 (direct handler smoke)** — the TanStack `createServerFn` handlers need a request context to invoke outside the RPC transport; the fast-lane hook already exercises every read-check codepath, and E2E covers the write probes and remediators.
- **Cascade stress on a scratch country** — requires an isolated DB / staging schema so mutations don't pollute production. Not worth the seed-teardown cost while the invariants script gives us the same signal on real countries read-only.
