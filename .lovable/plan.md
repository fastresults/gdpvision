## Goal

Prove — headlessly, before the user opens `/admin/ledger-qa` — that **Run All**, **Simulate Cold-Start**, every remediator, every AI Diagnose path, and the public hook all return green (or a known, explainable warn) on the current database. No more "ship and hope."

## Why this wasn't done yet

The previous phases wired the buttons and the public hook, but verification was limited to `bunx tsgo --noEmit` (types only). Nothing actually **invoked** the 12 checks, the cascade chains, or the remediators end-to-end against live data. That's the gap this plan closes.

## The harness (4 layers, fastest → slowest)

### Layer 1 — Server-fn smoke (no browser, ~5s)
A Node script under `scripts/ledger-qa/smoke.ts` that imports each `*.functions.ts` handler directly (bypassing the RPC wrapper) and calls it with a seed `country_code = 'GB'`.
- Asserts every check returns `{ status: 'pass' | 'warn' | 'fail', ... }` — never throws.
- Prints a 12-row table: `check | status | wall_ms | rowcount`.
- Exit code = number of unexpected `fail`s. CI-friendly.

### Layer 2 — Public hook contract test (~2s)
`curl` the deployed `/api/public/hooks/ledger-qa?cc=GB` with `LEDGER_QA_HOOK_KEY`, then assert:
- 12 verdicts present, each has `run_id`, `wall_ms`, `status`.
- Schema matches the UI's `VerdictRow` type (shared zod schema so drift = compile error).

### Layer 3 — Playwright end-to-end (~40s)
Headless Chromium against `http://localhost:8080/admin/ledger-qa` with injected Supabase session:
1. **Run All** → wait for summary strip → screenshot → assert `fail === 0` (or listed as known-warn).
2. **Simulate Cold-Start** → assert timeline renders 12 rows with real (non-800ms-fake) latencies.
3. For each remediator button visible: stub `window.confirm → true`, click, wait for React-Query to settle, re-read the verdict, assert it didn't regress.
4. Click **AI Diagnose** on any warn/fail finding → assert JSON response has `remediator_key` and the "Run suggested" button appears.
5. Screenshots saved under `/tmp/browser/ledger-qa/` for the closing summary.

### Layer 4 — Cascade stress (~60s)
Deliberately break state (delete a few `country_sectors` rows for a scratch country like `ZZ`), then run cascade-fix and assert the chain restored the invariant. Rolled back in a transaction so nothing sticks.

## Deliverables

- `scripts/ledger-qa/smoke.ts` — Layer 1
- `scripts/ledger-qa/hook-contract.test.ts` — Layer 2
- `scripts/ledger-qa/e2e.py` — Layer 3 (Playwright)
- `scripts/ledger-qa/cascade-stress.ts` — Layer 4
- `.lovable/plan.md` — updated with "How to verify" section referencing the 4 scripts
- A single `bun run ledger-qa:verify` npm script that runs Layers 1+2 (fast lane) and prints a green/red banner

## What I'll report back after running it

For each of the 12 checks: status, wall_ms, and (if warn/fail) the finding + which remediator the harness picked. Plus screenshots of the Run All summary strip and Cold-Start timeline. If anything fails I fix it before telling you it's ready — you should never be the one to discover a red status.

## Out of scope

- Load testing at concurrency > 1 (Ledger-QA is a single-admin tool; not needed).
- Testing across all countries — `GB` + one scratch `ZZ` is enough to exercise every code path.

Approve and I'll build the harness, run all 4 layers, and paste the results.
