## Remaining corpus-miss gaps

After Phase A/B (unified writers + six domain searchers) and the recent instrumentation pass, the remaining gaps fall into three buckets. None are new production bugs — they're all "silent empty" read paths that would still return `[]` without landing in `/admin/corpus-audit`.

### 1. Read sites still un-instrumented (silent empties)

Reads that can legitimately return empty but currently log nothing:

- **`src/lib/ledger.functions.ts`**
  - `~L1168–1172` — sectors + capital_flow_nodes fan-out (ledger reconcile view)
  - `~L1450–1452` — sectors + sector_dossiers + series_freshness (trust-signals aggregate)
- **`src/lib/country-viz/viz.functions.ts`**
  - `~L111–116, 140` — the country-pack fan-out (`sectors`, `country_sectors`, `country_kpis`, `ministries`, `ministry_profiles`, `ministry_sectors`) has 4 audit calls but not one per domain
- **`src/lib/audits.functions.ts`** `~L62–75` — probe reads for admin audits page (low priority; admin-only)
- **`src/lib/config.functions.ts`** `~L33–34` — instance_bindings + countries (user config; not a corpus domain)

### 2. Searchers wired but not yet invoked via `corpusRead`

Phase B built `searchers/{kpi,sector,ministry,dossier,flow,citation}.server.ts` + matching writers, but no read site actually calls `corpusRead({ search: searchSectors, writeBack: upsertSectorDossier, ... })`. Today they're dead code — the waterfall only fires when a caller opts in.

Highest-leverage first callers:
- `viz.functions.ts` country-pack sectors → `searchSectors` + `replace_country_sectors` RPC
- `viz.functions.ts` ministries/ministry_profiles → `searchMinistries`
- `ledger.functions.ts` sector_dossiers read → `searchDossier`
- `flows.functions.ts` capital_flow_nodes → `searchFlows`

### 3. Structural enforcement (Phase D from prior plan)

No lint gate exists, so any new `supabaseAdmin.from(...).select(...)` slides in without audit. Deferring this until §1 and §2 land keeps the gate from firing mid-migration.

---

## Proposed next step (single batch)

**Batch 1 — Wire the six searchers into their top read sites** (closes §2 + the highest-value §1 items in one pass):

1. `viz.functions.ts` country-pack: wrap the 6-way fan-out in `corpusRead` per domain (sectors, ministry, kpi). Miss → `searchSectors` / `searchMinistries` / `searchKpis` → write-back → return fresh data.
2. `ledger.functions.ts` trust-signals + reconcile: wrap sector_dossiers + capital_flow_nodes reads in `corpusRead` with `searchDossier` / `searchFlows`.
3. `flows.functions.ts` capital_flow_nodes: promote existing `recordCorpusReadOutcome` call to full `corpusRead` with `searchFlows`.

Every wrapped call:
- Uses natural key `${domain}:${countryCode}` (or `${domain}:${countryCode}:${slug}` for sub-scoped).
- Sets `budget.maxMs = 30_000`, default 30m cooldown.
- Passes `actor: context.userId`.
- Idempotent write-back via the Phase-A writers.

Verification: `bunx tsgo --noEmit` + a manual /admin/corpus-audit inspection after one country reload to confirm new `external` outcomes appear.

**Batch 2 (later)** — instrument the remaining `audits.functions.ts` + `config.functions.ts` reads with `recordCorpusReadOutcome` only (no waterfall — they aren't corpus domains).

**Batch 3 (last)** — Phase D lint gate (`no-raw-corpus-read`) with allow-list for writers/searchers/gateway.

Skip: `traceability`, `settings`, `admin`, `country-admin`, `cadence`, `media`, `items`, `galleries`, `idle-images`, `categories`, `factcheck`, `narrative` update paths, `mandate` insert paths, `onboarding` insert paths, `corpus.functions.ts` writes, `remediate.functions.ts` — all inserts/updates or non-corpus reads.
