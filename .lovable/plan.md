# Chamber 01 v2 acceptance — mission status

`/admin/ledger-qa` titled **"Chamber 01 v2 acceptance"** is the ship gate for
Chamber 01 v2. The product is shippable when — for the canonical country
(LCA, the default binding) — every acceptance row is **pass**, on cold-start,
without manual intervention. This doc reports that ship-readiness — nothing
else.

## Ship criteria (a country counts as "shippable" when all 6 are true)

1. Every read-check row renders `pass` (no warns, no fails).
2. Every write-probe, when run once, renders `pass`.
3. Publish gate → `pass` (no blocked upstreams).
4. `npm run ledger-qa:invariants <CC>` exits 0 (5/5 invariants OK).
5. `MUST_SHIP=<CC> npm run ledger-qa:verify <CC>` exits 0 (strict mode: 0 warn, 0 fail).
6. Cold-start ends with the summary strip matching the header, 0 warn / 0 fail.

The top-of-page **Acceptance** banner in `/admin/ledger-qa` is the single north-star
verdict — SHIPPABLE (green) or NOT SHIPPABLE (red) with the blocker list.

## Roster status

| Country | Ship state | Blockers (as of last sweep) |
|---|---|---|
| LCA (canonical) | NOT SHIPPABLE | `country_capital_flows` empty → `enrichment` warn, `gate` blocked, invariant `I5 flows` ERR. One click of **Backfill capital flows** closes this. |
| BRB | NOT SHIPPABLE | `0/12 ministry_profiles`, `0 capital flows`. Click **Backfill ministry profiles** then **Backfill capital flows**. |
| JAM, GUY, GBR | Out of scope for this gate | Not onboarded (separate mission: Chamber 01 v2 roster expansion). |

## Harness (grades the mission, not just the plumbing)

| npm script | Purpose |
|---|---|
| `ledger-qa:verify` | Fast-lane: hits the public hook per country, asserts 12-verdict contract. In strict mode (`MUST_SHIP=LCA,BRB`) a warn on those countries exits non-zero. Default arg list: BRB LCA JAM GUY GBR. |
| `ledger-qa:invariants` | Read-only DB sweep: asserts the 5 invariants each cascade remediator would restore. |
| `ledger-qa:e2e` | Signs in with the injected Supabase session, opens `/admin/ledger-qa`, clicks **Run all reads** + **Simulate cold-start**, screenshots each step, asserts parity between header and run-strip. |
| `ledger-qa:all` | Runs all three in sequence, short-circuits on the first failure. |

Recommended CI wiring: `MUST_SHIP=LCA,BRB npm run ledger-qa:all`. Exit 0 =
Chamber 01 v2 is shippable for the canonical roster; exit 1 = not shippable,
consult the failing row.

## Definition of done for the acceptance gate

`MUST_SHIP=LCA,BRB npm run ledger-qa:all` exits 0 **and** the top-of-page
**Acceptance** banner reads *SHIPPABLE* for both LCA and BRB on a fresh page
load, with no manual intervention beyond the initial one-click backfills.

## Out of scope

- Onboarding JAM / GUY / GBR (separate mission).
- Loosening any threshold to force green — a red row is fixed by fixing the
  data or the code, not by lowering the bar.
