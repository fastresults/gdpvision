
# Chamber 01 v2 acceptance — get the gate to pass

## Mission (restated in plain words)

`/admin/ledger-qa` titled **"Chamber 01 v2 acceptance"** is the ship gate for Chamber 01 v2. Every row is a criterion. The product is shippable when — for the canonical country (LCA, the default binding) — every row is **green**, on cold-start, without manual intervention. Anything less is "Chamber 01 v2 is not ready."

The harness I built proves the buttons wire up. It does **not** prove acceptance. Right now acceptance is **failing** on LCA (capital flows empty → `enrichment` warn, `gate` blocked, `I5 flows` ERR in invariants). That's the actual failure the user is pointing at.

## Ship criteria (what "pass" means)

For LCA (canonical country), all of these must be true in a single fresh page load:

1. Every read-check row renders `pass` (no warns).
2. Every write-probe, when run once, renders `pass`.
3. Publish gate → `pass` (no blocked upstreams).
4. `ledger-qa:invariants LCA` exits 0 (all 5 invariants OK).
5. `ledger-qa:verify LCA` returns 0 warns and 0 fails on the public hook.
6. Cold-start simulation ends with the summary strip matching the header, 0 warns / 0 fails.

The same six must hold for BRB next, then be repeatable via one-click onboarding for JAM / GUY / GBR.

## Current gaps against those criteria

| Country | Gap | Fix |
|---|---|---|
| LCA | `country_capital_flows` empty → `enrichment` warn + `gate` blocked + `I5 flows` ERR | Run `backfillCapitalFlows` for LCA, commit ≥3 inputs / ≥4 outputs, ≤10% residual. |
| LCA | Confirm `corpus-miss` stays green after backfill (no new empty attempts) | Re-run hook + invariants after backfill. |
| BRB | `0/12 ministry_profiles`, `0 capital flows` | `backfillMinistryProfiles` then `backfillCapitalFlows`. |
| JAM / GUY / GBR | Not onboarded (no sectors / kpis / ministries / flows) | Not blocking Chamber 01 v2 ship on LCA — track separately, not part of this plan. |

## Plan (in order — do not batch)

### Step 1 · Make the acceptance gate visible at the top of the page
Add a single **"Acceptance"** verdict at the very top of `/admin/ledger-qa` that reads *SHIPPABLE* only when all six ship criteria above are true for the selected country. This is the north-star signal — every other row exists to inform it. If it's red, Chamber 01 v2 is not shippable, period.

Implementation: derive from existing verdicts + a small server function that returns `{ invariants: 5, verdicts: N, blocked: [...] }`. No new checks; a compositor over what's already there.

### Step 2 · Close the LCA gap end-to-end
1. From the page, click **Backfill capital flows** for LCA. Await the sync-await response.
2. Re-run **Run all reads**. Confirm `enrichment` → `pass`, `gate` → `pass`, `recon` still `pass`.
3. Run **Run everything** (write probes). Confirm 12/12 pass.
4. From shell: `LEDGER_QA_HOOK_KEY=… npm run ledger-qa:verify LCA` — expect 0 warn, 0 fail.
5. From shell: `npm run ledger-qa:invariants LCA` — expect all 5 OK, incl. `I5 flows`.
6. **Acceptance verdict** at top of page reads *SHIPPABLE — LCA*.

If step 1 fails (Perplexity waterfall doesn't produce a commit-eligible draft: <3 inputs, <4 outputs, or >10% residual), do **not** widen the tolerance. Diagnose the searcher / prompt / node registry, fix the root cause, and re-run — the mission is a real green, not a lowered bar.

### Step 3 · Do the same for BRB
Run `backfillMinistryProfiles` → `backfillCapitalFlows` → re-verify. Acceptance verdict must reach *SHIPPABLE — BRB*.

### Step 4 · Wire ship-criteria into the harness
Change `npm run ledger-qa:all` to fail unless the **Acceptance** verdict for LCA (and BRB) is *SHIPPABLE*. Today it can pass with warns. That was the harness lying by omission — it should not.

Concretely: `verify.sh LCA` should exit non-zero on any `warn`, not only `fail`, when the country is in the "must-ship" list. Add `MUST_SHIP=LCA,BRB` env var; hook fails when any must-ship country has warns.

### Step 5 · Update `.lovable/plan.md`
Replace the current "harness status" doc with a **mission status** doc: the six ship criteria and the current state per country. The doc's job is to tell any future reader whether Chamber 01 v2 is shippable, not to inventory scripts.

## Out of scope (deliberately)

- Onboarding JAM / GUY / GBR. That's a separate mission (Chamber 01 v2 roster expansion), not the acceptance gate.
- Any new harness layers. The three we have are enough — the problem was grading criteria, not signal coverage.
- Loosening any threshold to force green. If a check is red, we fix the data or the code, not the check.

## Definition of done for this plan

`npm run ledger-qa:all` exits 0 **and** the top-of-page **Acceptance** verdict reads *SHIPPABLE — LCA* and *SHIPPABLE — BRB* on a fresh load, with no manual intervention beyond the initial one-click backfills. At that point Chamber 01 v2 is genuinely shippable and I can say so honestly.
