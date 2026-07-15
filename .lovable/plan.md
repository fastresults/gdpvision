# Chamber 01 v2 acceptance — mission model

## Mission (one sentence)

Pressing **Self-heal to ship** on `/admin/ledger-qa` must walk every
acceptance step top-to-bottom for the selected country and, wherever data is
missing or invalid, do the research (Perplexity → Gemini waterfall), commit
what it finds to the corpus, and re-verify — sequentially, no manual
intervention — until the top banner reads **SHIPPABLE**. Anything short of
that is Chamber 01 v2 not being ready.

## The sequencer

`runSelfHealingAcceptance({ countryCode })` in
`src/lib/ledger-qa/self-heal.functions.ts` runs these steps in dependency
order. For each step: **read → verdict**; if not `pass`, **heal** (invoke
the mapped searcher→writer path), then **re-read → verdict**; then move on.

| # | Step | Heal path | Pass criterion |
|---|---|---|---|
| 1 | `sources` | Quarantine any active row whose `url` isn't `http(s)://` (`repairInvalidSourceUrls`) | 0 invalid · 0 broken active sources |
| 2 | `sectors` | `searchSectors` → `replace_country_sectors` RPC | ≥1 sector, sum(share_pct) ∈ [95, 105] |
| 3 | `ministries` | For each missing slug (cap 8): `searchMinistry` → `upsertMinistryProfile` | every ministry has a profile |
| 4 | `flows` | `searchCapitalFlows` → `upsertCapitalFlow` per node | ≥1 committed flow |
| 5 | `kpis` | For each missing required kpi (cap 6): `searchKpi` → `upsertKpi` | ≥1 kpi with `latest_value` |
| 6 | `corpus-miss` | Log a redrive action so the next natural read re-attempts | 0 empty attempts in 24h |

Every heal writes to `ledger_qa_actions` and `corpus_fetch_attempts`, so the
audit trail is authoritative and the invariants sweep + public hook agree
with the UI immediately.

`maxHealAttempts` defaults to 1 — one honest attempt, not retry loops.
A heal that fails (searcher returns empty, writer rejects) surfaces as
`heal-failed` in the timeline with the raw error message. The step keeps
its non-pass verdict and the sequencer moves on. **We do not lower a
threshold to force green.** If capital flows come back with < 3 inputs
or > 10 % residual, the check stays red and the searcher/prompt gets
diagnosed — the bar does not move.

## Ship criteria (a country is shippable when all 6 hold)

1. Every read-check row `pass` (0 warns / 0 fails).
2. Every write-probe, when run once, `pass`.
3. Publish gate `pass` (derived).
4. `npm run ledger-qa:invariants <CC>` exits 0 (5/5 invariants OK).
5. `MUST_SHIP=<CC> npm run ledger-qa:verify <CC>` exits 0 (strict: 0 warn/fail).
6. Cold-start ends with summary strip matching header, 0 warn / 0 fail.

The top-of-page **Acceptance** banner in `/admin/ledger-qa` is the single
north-star verdict: SHIPPABLE (green) or NOT SHIPPABLE (red) with blockers.

## Harness

| Script | Purpose |
|---|---|
| `ledger-qa:verify` | Public hook per country, 12-verdict contract. Strict mode via `MUST_SHIP=` treats warns as failures. |
| `ledger-qa:invariants` | Read-only DB sweep of the 5 cascade invariants. |
| `ledger-qa:e2e` | Signs in, opens the page, clicks Run all reads + cold-start, asserts parity, screenshots. |
| `ledger-qa:all` | Runs all three, short-circuits on first failure. |

Recommended CI: `MUST_SHIP=LCA,BRB npm run ledger-qa:all`.

## Definition of done

`MUST_SHIP=LCA,BRB npm run ledger-qa:all` exits 0 **and** the Acceptance
banner reads SHIPPABLE for both LCA and BRB after one **Self-heal to ship**
click each, on a fresh page load, with no manual intervention.

## Out of scope

- Onboarding JAM / GUY / GBR (separate mission: Chamber 01 v2 roster expansion).
- Loosening any threshold to force green.
