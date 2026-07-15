
# Make "Run 1→12" actually ship-ready

## Current gap (why the answer is "not yet")

Two pipelines exist and neither closes the loop on its own:

1. **Onboarding orchestrator** (`getNextOnboardingStage`) walks stages 1-12, but only advances when a committable draft exists. When a stage produces a draft that fails its gate (e.g. capital_flows residual >10%), it stops and waits for a human.
2. **Acceptance self-heal** (`runSelfHealingAcceptance`) is meant to close residual gaps, but:
   - Covers 6 of 12 UI acceptance rows (no explainFigure, askLedger, trust, reconciliation, publishGate, snapshot, handoff).
   - `includeWriteProbes` is dead code.
   - `maxHealAttempts` caps at 1; ministry/KPI heals slice at 8/6 per run.
   - `corpus-miss` heal writes an audit row but does not clear cooldowns or re-fetch.
   - Two different definitions of "shippable" (self-heal vs UI banner).

Result: pressing "Run all pending" completes stages 1-11 optimistically, stage 12 parks as `needs_review`, and self-heal reports SHIPPABLE while the on-page banner says NOT SHIPPABLE.

## Plan — one converging pipeline

### 1. Unify the acceptance contract
- Extract the 12 acceptance checks into a single registry `src/lib/ledger-qa/acceptance-registry.ts` with `{ id, read, heal, requiredForShip }`.
- Both the UI (`ledger-qa.tsx`) and `runSelfHealingAcceptance` iterate this registry. One source of truth for "shippable".

### 2. Add the missing 6 heal steps
For each of `explainFigure, askLedger(+refusal), trustSignals, reconciliation, publishGate, snapshotRoundtrip, handoff`:
- Implement a `heal()` that identifies the underlying deficit (missing citations, missing sector composition, missing publish-gate fields, stale snapshot) and calls the existing writer or re-runs the specific onboarding stage that produces it.
- Wire `includeWriteProbes: true` to actually branch into these steps.

### 3. Make self-heal actually converge
- Replace the `maxHealAttempts=1` single-shot with a per-step budget (default 3) and a global wall-clock (e.g. 10 min) so long-tail ministries/KPIs finish.
- Remove the `slice(0, 8)`/`slice(0, 6)` caps; heal all missing items in a single step, chunked internally with backoff.
- `corpus-miss` heal: after logging the redrive, actually invalidate cooldown rows and call the domain searcher for each stuck `(domain,key)`, then re-count.

### 4. Wire stage 12 into the same self-heal loop
- Move `researchAndCommitCapitalFlowsForAcceptance` behind a `capital_flows` acceptance step.
- On `needs_review`, self-heal re-runs the 3-pass Perplexity fan-out with expanded queries until it meets the ≥3/≥4/≤10% gate OR exhausts a budget — then records `EXHAUSTED` with the rejected candidates as evidence (never lowers thresholds).

### 5. Fuse onboarding + acceptance in the UI
- "Run all pending" on `/admin/countries/$code/onboard` becomes: run stages 1-12 → then run acceptance self-heal against the unified registry → loop until all 12 pass or every step reports `EXHAUSTED` with logged evidence.
- Stream the timeline (already implemented for self-heal) to cover both phases.

### 6. Forensic telemetry
- Every step logs `RESEARCHING | REJECTED | COMMITTED | VERIFIED | EXHAUSTED` to `ledger_qa_actions` with the candidate URLs/values considered.
- Post-run summary shows per-step verdict, attempts used, and evidence for any EXHAUSTED step so a human knows exactly what to unblock.

### 7. Regression harness
- Extend `scripts/ledger-qa/verify.sh` to assert the 12-row registry is fully green for a canary country (LCA or BRB) after `Run all pending` completes on a clean slate.
- CI-friendly exit codes.

## Deliverable

A single click on "Run all pending" for any country walks stages 1→12, then runs the 12-step acceptance loop with real research/write-back, and finishes with either **SHIPPABLE** (all 12 green, banner + self-heal agree) or a per-step **EXHAUSTED** report with evidence — no silent failures, no divergent verdicts, no manual backfills.

## Files touched (planned)

- `src/lib/ledger-qa/acceptance-registry.ts` (new)
- `src/lib/ledger-qa/self-heal.functions.ts` (rewrite around registry, remove caps, honor `includeWriteProbes`)
- `src/lib/ledger-qa/heals/*.ts` (new per-step heals for the missing 6)
- `src/lib/corpus/gateway.server.ts` (real cooldown invalidation for corpus-miss heal)
- `src/lib/ledger-qa/capital-flow-acceptance.server.ts` (loopable, budgeted)
- `src/routes/_authenticated/admin/ledger-qa.tsx` (read verdicts from registry)
- `src/routes/_authenticated/admin/countries.$code.onboard.tsx` ("Run all pending" chains into self-heal)
- `scripts/ledger-qa/verify.sh` + `verify_assert.py` (12-row assertion)

Approve this and I'll implement it end-to-end.
