# Plan: make Chamber 01 v2 self-heal truly AI-first and acceptance-grade

## What actually happened

The current **Self-heal to ship** did not fail because the web lacks the data. It failed because the workflow is not yet the workflow you described.

Current behavior:

```text
read step → if warn/fail → run one shallow backfill → log “healed” if the function resolved → re-read → move on
```

Required behavior:

```text
consult corpus → if missing/invalid, research deeply → validate → write to corpus → verify committed rows → repeat/escalate → only move on when the step is actually pass or explicitly exhausted with evidence
```

The screenshot exposes the key defect: it says **“Wrote 3 flow node(s)”**, then immediately says **“0 committed flows.”** That means the workflow counted attempted writes, not database-confirmed writes.

## Confirmed root causes

1. **Silent write failures**
   - The corpus writers call `insert/update/upsert` but do not check returned `.error` values.
   - Backend client writes do not necessarily throw; they return `{ error }`.
   - Result: a failed foreign-key/check/RLS write can look successful to the caller.

2. **Flow node key drift**
   - The canonical capital-flow registry uses uppercase keys like `FDI_NET`, `TOURISM_SPEND`, `IMPORT_LEAKAGE`.
   - The simple flow searcher’s Gemini hint shows non-canonical lowercase examples like `fdi_in`.
   - A hallucinated or mis-cased `node_key` fails the foreign key into `country_capital_flows`.

3. **The self-heal uses a weaker capital-flow path**
   - There is already a stronger capital-flow workbook path with per-node attempts, deterministic derivations, source validation, GDP plausibility clamps, coverage checks, and reconciliation.
   - The self-heal bypasses that and uses the simpler `searchCapitalFlows` path.

4. **No post-write verification before declaring healed**
   - The heal step increments a local `wrote` counter when a function resolves.
   - It does not verify that rows actually exist after the write before logging success.

5. **Corpus audit can be poisoned by false success**
   - Because “wrote” is based on attempts, `corpus_fetch_attempts` can record `external` even when no rows committed.
   - Then `corpus-miss` thinks the gap was resolved when it was not.

6. **Redrive does not actually redrive research**
   - Corpus miss redrive currently clears cooldown markers and waits for a future natural read.
   - Your mission requires the workflow to continue researching now, inside the sequence.

## Implementation plan

### 1. Make all corpus writes fail loudly

Update `src/lib/corpus/writers.server.ts` so every writer checks backend errors and returns a real write result.

Changes:
- Add a small helper such as `assertDbWrite(result, label)`.
- Update all writers, especially:
  - `upsertCapitalFlow`
  - `upsertKpi`
  - `upsertMinistryProfile`
  - `upsertSectorDossier`
  - memory/citation helpers
- Convert `upsertCapitalFlow` to a true `upsert(..., { onConflict: "country_code,node_key,period" })` with checked error/result.
- Return `{ wrote: boolean, id?, action: "insert" | "update" | "upsert" }` where useful.

Acceptance:
- A bad `node_key` surfaces as a visible timeline failure, not a fake “healed.”
- No writer silently no-ops.

### 2. Canonicalize and validate capital-flow node keys before writing

Update the flow research/write boundary so only registry-valid node keys can be committed.

Changes:
- Load `capital_flow_nodes` once for the country flow step.
- Normalize only safe casing/whitespace differences.
- Reject unknown keys with an explicit reason.
- Fix the flow searcher prompt/schema hint to use only canonical keys.
- Include rejected keys in the self-heal timeline and audit detail.

Acceptance:
- `fdi_in` or any non-registry key cannot be counted as written.
- Flow failures explain exactly which keys were rejected and why.

### 3. Replace the shallow flow self-heal with the mature workbook path

Make **flows** use the existing evidence-workbook pipeline instead of the simple one-shot searcher.

Changes:
- In the self-heal flow step, call the capital-flow workbook builder used by onboarding.
- Commit only when the workbook meets the existing Stage 12 criteria:
  - at least 3 input nodes
  - at least 4 output nodes
  - reconciliation residual ≤ 10%
  - valid source URL per committed flow
  - GDP plausibility clamps respected
- If the workbook is incomplete, do not pretend success. Persist attempts and show missing nodes/residual.
- Where needed, add a server helper that performs “build draft → if eligible → commit” without manual UI review, while still preserving the draft/audit record.

Acceptance:
- The self-heal cannot pass flows with only 3 arbitrary rows.
- The flow path is evidence-based, per-node, validated, and reconciled.

### 4. Turn self-heal into a real sequential workflow engine

Refactor `runSelfHealingAcceptance` from one-shot remediation into a step engine.

New step contract:

```text
preflight → read corpus → decide gap → research plan → execute research → validate → write → verify committed state → next step
```

Changes:
- Each step returns structured state:
  - `pass | needs_research | needs_more_research | blocked | exhausted`
  - row counts before/after
  - evidence gathered
  - citations
  - rejected candidates
  - next action
- Use verified database reads for `rows_after`, not local counters.
- Allow multiple attempts per step with a sensible budget, not exactly one attempt.
- Do not move past a dependency if it blocks downstream quality, unless the downstream step can still validly infer from other evidence.

Acceptance:
- The timeline tells the truth: attempted, rejected, committed, verified.
- A step is marked healed only after the pass criterion is verified.

### 5. Implement “research until answer or reliable inference” per domain

For each acceptance domain, enforce the same AI-first pattern.

#### Sources
- Corpus first: use existing active sources.
- If sources are missing/broken, research official primary sources for the country/domain.
- Add valid sources via the canonical deduped source upsert.
- Do not just quarantine bad rows and stop.

#### Sectors
- Corpus first: existing sector composition.
- If missing or not summing properly, deep research official statistics/multilateral sources.
- Commit only if shares validate and sum to the accepted range.

#### Ministries
- Corpus first: existing ministry list and profiles.
- If ministries are missing, research/seed ministries before profiles.
- Profile every required ministry, not just the first capped batch, within budgeted loops.

#### Flows
- Use the mature capital-flow workbook path.
- Research missing nodes individually.
- Derive/model only with explicit formulas and source-backed assumptions.

#### KPIs
- Corpus first: existing required KPIs.
- Search authoritative orgs per KPI.
- If a KPI remains unavailable, record evidence of exhaustion and whether a reasonable source-backed inference is allowed.

#### Corpus misses
- Do not just clear cooldown.
- Resolve each unresolved `(domain, key)` by invoking its mapped domain searcher immediately.
- Mark resolved only after a hit/external success follows the empty attempt.

Acceptance:
- Every missing data condition has a mapped research/write/verify path.
- “No answer found” includes attempted sources, model tiers, citations, and why inference was or was not reliable.

### 6. Align all acceptance gates to the same truth

Make the UI banner, public hook, invariant script, and self-heal final verdict use the same criteria.

Changes:
- Replace weak checks like “flows count > 0” with acceptance-grade checks:
  - flow coverage and residual
  - ministry profile completeness
  - required KPI coverage
  - source validity
  - unresolved corpus misses
- Ensure the public hook and local invariant script report the same blockers as `/admin/ledger-qa`.
- Keep write probes separate, but make read acceptance strict.

Acceptance:
- If the banner says **SHIPPABLE**, the scripts agree.
- If scripts fail, the banner shows the same blocker class.

### 7. Add first-class telemetry and forensic output

The workflow must show why it failed without guessing from screenshots.

Changes:
- Log every step to `ledger_qa_actions` with:
  - phase
  - before/after verified counts
  - search tier
  - citations count
  - rejected candidates
  - exact backend write errors
  - elapsed time
- Add server logs only for unexpected exceptions.
- Expand the self-heal timeline UI to show:
  - `RESEARCHING`
  - `FOUND`
  - `REJECTED`
  - `COMMITTED`
  - `VERIFIED`
  - `EXHAUSTED`
- Keep JSON-like payloads rendered through the existing `PrettyJson` rule if shown in UI.

Acceptance:
- A future failure tells us whether the problem is search, validation, write, verification, or acceptance criteria.

### 8. Add regression checks for this exact failure

Update the QA harness so fake healing cannot pass again.

Changes:
- Add a test/assertion that intentionally attempts an invalid flow key and confirms the writer throws.
- Add a self-heal assertion: any timeline row saying `healed` must be followed by a pass recheck or be considered failure.
- Strengthen `ledger-qa:invariants` for flows:
  - ≥3 inputs
  - ≥4 outputs
  - residual ≤10%
  - no unknown node keys
- Make `ledger-qa:all` fail on any strict country warn/fail.

Acceptance:
- “Wrote 3, then 0 committed” becomes impossible to report as success.

## Definition of done

For LCA and BRB:

1. User clicks **Self-heal to ship** once.
2. The workflow researches, writes, validates, and verifies each required domain in sequence.
3. The top banner reaches **SHIPPABLE** only when all acceptance-grade criteria pass.
4. `MUST_SHIP=LCA,BRB npm run ledger-qa:all` exits 0.
5. If a country cannot be completed, the system shows an evidence-backed **EXHAUSTED** state with exact missing data, attempted sources, rejected candidates, and next required engineering/data action.

## Scope guard

This plan does **not** lower thresholds or fake green status. It makes the workflow self-healing by improving research, write-back, verification, and escalation until the acceptance result is trustworthy.