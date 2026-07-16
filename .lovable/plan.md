## Findings

Stage 12 is not mainly “stuck” because no data exists; for BLZ it produced a draft, but the draft is blocked by the current quality gates and draft lifecycle.

- **BLZ draft exists but is not committed:** 11 flow rows were generated, 0 committed rows exist.
- **Coverage gate is too literal:** Belize is not marked as a CBI country, so `CBI_INFLOWS` was correctly omitted, but the gate still reports `5/6 inputs` and treats that as incomplete.
- **Reconciliation gate is misfit for the current ledger model:** generated inputs total about **US$1.65B**, outputs about **US$5.04B**, residual about **67%**. This comes from mixing BOP/fiscal inflows with broad import/GDP-proxy outputs, especially `IMPORT_LEAKAGE` derived from total imports.
- **Residual handling cannot balance both directions:** the existing residual node is output-sided. When outputs exceed inputs, committing a residual as an output makes the chart less balanced instead of more balanced.
- **Duplicate draft failures still happen in the acceptance/self-heal path:** a later run failed on the “one live draft per stage” constraint after an existing `needs_review` capital-flow draft already existed.
- **There are two capital-flow implementations drifting apart:** the route file still contains older “3-pass” pass definitions, but the active runner now calls the newer per-node workbook builder. This makes behavior harder to reason about and test.

## Plan

### 1. Make the capital-flow gate understand applicable nodes
- Treat `CBI_INFLOWS` as **not applicable** for non-CBI countries instead of “missing.”
- Store omitted/non-applicable nodes separately in the draft payload.
- Compute coverage against applicable required nodes, not a fixed `6 inputs / 6 outputs` denominator.
- Keep the call-out in the summary: “CBI omitted because the country is not a CBI state.”

### 2. Fix residual balancing so drafts can commit safely
- Add/support a second residual direction for cases where **outputs exceed inputs**.
- Use:
  - output-side residual when inputs exceed outputs;
  - input-side “unattributed financing / unclassified inflow” when outputs exceed inputs.
- Exclude residual-balancer nodes from “missing required nodes” diagnostics.
- Update commit logic so the residual node actually lands on the smaller side of the Sankey.

### 3. Separate “bad draft” from “usable with disclosed inference”
- Keep hard rejection for drafts with no valid sources or too few applicable rows.
- Allow a draft to become commit-ready when it has:
  - enough applicable input/output coverage;
  - valid source URLs for each populated node;
  - an explicit residual/inference disclosure when reconciliation is above 10%.
- Mark the confidence lower when the ledger depends on balancing or modelled proxies.

### 4. Improve the research hierarchy for each node
Implement the intended order consistently:

```text
Committed corpus / KPIs / known public APIs
→ targeted deep research attempts
→ transparent inference/modelled fallback
→ explicit data-gap call-out
```

- Prefer committed corpus and official/multilateral sources before open web sources.
- Reject weak sources for high-impact nodes when a preferred source class exists.
- Keep formula, source basis, confidence grade, and data-gap notes on every inferred row.
- Use bounded per-node research so one bad node does not block the whole stage.

### 5. Remove duplicate-draft failure modes
- Harden both the onboarding runner and acceptance/self-heal path to update the existing live Stage 12 draft instead of failing on the live-draft uniqueness rule.
- If a race still hits the uniqueness constraint, re-read the existing draft and update it instead of failing the run.
- When a `needs_review` draft already exists, “Run all pending” should pause with the review reason instead of repeatedly generating another draft.

### 6. Consolidate the active Stage 12 implementation
- Remove or clearly retire the unused older 3-pass code path in the route function file.
- Keep one source of truth: the capital-flow workbook builder.
- Make the summary, attempts table, draft payload, and commit path all use the same coverage/reconciliation calculations.

### 7. Repair BLZ after the code fix
- Re-evaluate the current BLZ draft with the new applicability and residual rules.
- If the existing draft is usable, commit it with the residual/inference disclosure.
- If not, run the refined Stage 12 once and verify:
  - `country_capital_flows` has committed rows;
  - the Sankey has balanced totals or an explicit balancing node;
  - the onboarding page no longer loops on Stage 12.

### 8. Add regression checks
- Non-CBI country does not fail coverage for missing `CBI_INFLOWS`.
- Outputs-greater-than-inputs creates an input-side residual, not an output-side residual.
- Existing live capital-flow drafts are updated, not duplicated.
- “Run all pending” stops for true review blocks and does not spin or re-run indefinitely.