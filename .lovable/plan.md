You're right — the current Ledger-QA is theater. "Run all" only invalidates cached reads, credit-costing probes stay `NOT RUN` forever, WARN copy is hand-coded strings that ignore live state, and the enrichment WARN still says "go run Stage 12 in onboarding" even though we just wired an inline capital-flows backfill. Below is an end-to-end fix.

## What's actually broken today

1. **"Run all" is a lie.** It calls `queryClient.invalidateQueries` on the row keys, so any check with `enabled: false` (explain / ask / ask-refuse / snapshot-rt / handoff) just re-shows `IDLE_VERDICT`. Five of twelve rows never run.
2. **Findings ignore live state.** `deriveFinding` is a `switch` over `check.key` returning hand-written copy. It doesn't peek at `corpus_fetch_attempts`, so a WARN row keeps saying "run Stage 12 in onboarding" 5 seconds after the background backfill already fired.
3. **No inline self-heal for the four biggest WARN classes** (missing capital_flows, missing KPI series, missing sector composition, missing ministry_profiles). Each one throws the operator back to `/admin/countries/$cc/onboard` — the loop the whole corpus-miss infra was built to avoid.
4. **Fire-and-forget backfill has no receipt.** `triggerCorpusBackfill` runs in the background but the drawer shows nothing about it. The user cannot tell "already tried, cooling down" from "never tried".
5. **Publish gate cascade is dead-end text.** It lists blocked upstream keys but offers no button that fixes them and re-runs the gate.
6. **Write-probes leak data.** `snapshot-rt` and `handoff` insert a fresh row every run. Ten `Run all`s = ten probe rows in `figure_snapshots` and ten narrative signals — noise indistinguishable from real work.
7. **No AI fallback.** When the fixture-shaped switch doesn't match, we render "No systemic fix registered." Dead end.

## Bulletproof plan — 8 phases

### Phase 1 · Make `Run all` real
- Two buttons: **Run all reads** (default; safe) and **Run everything (incl. write probes)** (behind a confirm modal; explains cost).
- Every check gets `runsWithRunAll: "always" | "reads-only" | "on-demand"`. Reads always run; write probes only when the second button fires.
- `refetch({ throwOnError: false })` in a `Promise.allSettled`; store per-run outcomes in a session-scoped `run_id` and display a summary strip (`10 pass · 1 warn · 1 fail`).

### Phase 2 · Universal remediator registry (`src/lib/ledger-qa/remediators.ts`)
Replace the `switch` in `deriveFinding` with a lookup table keyed by `(checkKey, findingClass)`:

```text
enrichment  / data-missing    → backfillCapitalFlows(cc)   sync-await
trust       / data-missing    → backfillKpiSeries(cc)      sync-await
overview    / data-missing    → backfillSectors(cc)        sync-await
overview    / data-quality    → backfillMinistryProfiles(cc) sync-await
sources     / data-quality    → repairInvalidSourceUrls    (exists)
sources     / external-outage → retryUnreachableSources    (exists)
gate        / config          → cascadeFix(blocked_keys)   compound
corpus-miss / *               → redriveCorpusMisses(domain) (exists)
*           / unknown         → aiDiagnoseFinding()         AI-shaped
```

Each remediator returns `{ summary, refetchKeys, wroteRows }` and writes a `ledger_qa_actions` row. UI dispatches by key — no more per-row `case` statements.

### Phase 3 · New sync-await backfill server fns
Wrap the Phase-B searchers with `.middleware([requireSupabaseAuth])` + admin check + inline `await search…() → writer`, returning row-counts:
- `backfillCapitalFlows` — `searchCapitalFlows` → `upsertCapitalFlow` (one per node), returns `{ period, wrote }`.
- `backfillSectors` — `searchSectors` → `replace_country_sectors` RPC, returns `{ wrote }`.
- `backfillMinistryProfiles(cc)` — loops `ministries` missing a profile, calls `searchMinistry` + `upsertMinistryProfile`.
- `backfillKpiSeries(cc)` — iterates `country_kpis` with `latest_value IS NULL`, calls `searchKpi` (Phase-B) + `upsertKpi/upsertKpiPoint`.

Each is admin-only, idempotent, budgeted (30s per call), logs a `corpus_fetch_attempts` row through `corpusRead` so the audit page stays authoritative.

### Phase 4 · AI Diagnose fallback (`diagnoseFinding` server fn)
For anything the registry doesn't handle:
1. Load `check.data`, `verdict`, the check's country_code, and the last 25 `corpus_fetch_attempts` rows for that (country, likely-domain).
2. Load table row-counts + last-updated timestamps for the tables the check touches.
3. Send bundle to Lovable AI (`google/gemini-3.1-flash`) with strict JSON schema:
   ```json
   {"root_cause": string, "class": "data-missing|data-quality|code-defect|external-outage|config", "remediator_key": string|null, "operator_steps": string[], "confidence": "low|med|high"}
   ```
4. UI renders the AI-shaped finding; if `remediator_key` matches a registry entry, offer that same button — otherwise show the operator steps.

Every non-registry WARN/FAIL drawer gets an **AI diagnose** button. Result is cached 10min per (check_key, cc) so repeated Run-Alls don't burn credits.

### Phase 5 · Backfill visibility in every drawer
- New server fn `getRecentCorpusAttempts(cc, domain)` — last 5 rows, small.
- Each `data-missing` drawer renders: `Last attempt: 2m ago · tier: perplexity · outcome: external (wrote 8 rows)`. Buttons: **Backfill now** (forceRefresh=true) and **Wait & re-check** (polls the query every 15s for 90s).
- If cooldown active, show `Cooling down — next attempt allowed at 14:32:15` with a **Force refresh** override.

### Phase 6 · Publish-gate cascade auto-fix
`gate/config` finding now maps blocked upstream keys → their remediator, and renders:
- **Fix upstream cascade** button: iterates blocked keys, dispatches each auto-applicable remediator serially, refetches the gate at the end.
- Non-auto items become a numbered checklist with deep links.

### Phase 7 · Credit-safe / dedup-safe write probes
- `snapshot-rt`: label pattern stays; before insert, delete any probe rows older than the latest 3. Cache result 10min so Run All doesn't re-pin.
- `handoff`: same treatment — tombstone signals tagged `qa-probe` beyond latest 3.
- `explain` / `ask` / `ask-refuse`: results cached 10min in a lightweight `qa_probe_cache` table keyed by `(cc, check_key)`; "Force fresh probe" toggle bypasses cache.

### Phase 8 · Cold-start simulator + CLI parity
- Top-of-page **Simulate cold-start** button: runs every check in sequence, showing a step-by-step timeline (`read → miss → remediator → re-read → verdict`). Proves the loop end-to-end in one click.
- Public route `src/routes/api/public/hooks/ledger-qa.ts` (HMAC-verified) returns the same 12-check JSON verdict list for cron / CI.

## Rollout order (each step ships independently)

1. **Phase 3** — backfill server fns ✅ shipped.
2. **Phase 2** — remediator registry ✅ shipped.
3. **Phase 5** — backfill visibility (RecentAttemptsPanel) ✅ shipped.
4. **Phase 6** — cascade fix ✅ shipped (client-side `useRemediator` cascadeFix loops `CASCADE_MAP` per blocked gate check).
5. **Phase 1** — real "Run all" (reads-only + everything) ✅ shipped.
6. **Phase 7** — write-probe hygiene ⏳ pending (probes still write per run; cache table not yet added).
7. **Phase 4** — AI diagnose fallback ✅ shipped (`diagnoseFinding` server fn + `AiDiagnoseButton` per drawer, 10min in-memory cache).
8. **Phase 8** — cold-start simulator ✅ shipped (button + step timeline) + public `/api/public/hooks/ledger-qa?country=XXX` GET returning verdict JSON (apikey-gated).

Verification each phase: `bunx tsgo --noEmit`, hit `/admin/ledger-qa` on LCA, watch the specific WARN row flip green after clicking its remediator, confirm one `ledger_qa_actions` row and one `corpus_fetch_attempts` row per action.
