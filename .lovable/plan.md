
# Ledger-QA — bulletproof pass #2

Stress-tested each surface end-to-end. The last round shipped Phases 1–6 and 8; the following gaps still make "Run All" lie or leave the operator without a receipt. This plan closes them and finishes Phase 7 (write-probe hygiene).

## Gaps found in the current build

### A. "Run all" still not honest
- `runAll(includeWrites)` fires `c.run()` in a tight loop and returns immediately. React-Query refetches are in flight but the UI has no per-run receipt.
- The plan called for a `Promise.allSettled` + `run_id` + summary strip (`10 pass · 1 warn · 1 fail`); we render only the standing header counts, which don't reflect *what this click did*.
- No detection of "silent no-op" (verdict unchanged after run) — user can't tell if the click did anything.

### B. Cold-start simulator is a fake clock
- The loop does `c.run()` then `await sleep(800)` and snapshots the verdict. Reads that take >800ms record `idle`; fast reads still show the *previous* verdict because React-Query hasn't rendered yet.
- No await on `q.isFetching → false`. No cancel button. No aggregated latency budget.

### C. Findings still ignore live state for two big cases
- `overview` only handles missing sectors — never surfaces "sectors present but no ministry_profiles", so the ministry backfill is unreachable from the drawer.
- `enrichment` warns "run Stage 12 in onboarding" as the fallback copy even though `backfillCapitalFlows` is wired — the string should mention the button.

### D. Cascade fix under-invalidates
- After `cascadeFix` finishes, only `["ledger-qa", cc]` prefix is invalidated. Recent Actions + attempts panels don't refresh; the gate row updates but the upstream rows (sources/trust/overview) stay stale until the operator re-clicks.
- No dedup across chains: if two blocked keys map to the same remediator, we run it twice per click.

### E. AI Diagnose is read-only
- When the AI returns a `remediator_key` that matches the registry, we render text but don't offer a "Run suggested remediator" button. Dead end for the operator.

### F. Write probes still leak (Phase 7 unfinished)
- `snapshot-rt` inserts a new `figure_snapshots` row every click.
- `handoff` inserts a new `intake_items` row every click.
- `explain`, `ask`, `ask-refuse` burn AI credits on every click with no cache.
- Ten "Run everything" clicks = 10 probe rows in each surface, indistinguishable from real work.

### G. Public hook is over-scoped and wrong-keyed
- Uses `SUPABASE_SERVICE_ROLE_KEY` to compare against the publishable anon key — a mismatch of intent (service role reads bypass RLS with a public bearer). Should use a dedicated `LEDGER_QA_HOOK_KEY` secret and read via publishable client.
- Missing `explain`, `ask`, `snapshot-rt`, `handoff`, `recon`, `gate` — only 5 of 12 checks, so CI parity is broken.

### H. Confirm-gap on writes
- Every remediator button (backfills cost credits, retry HEAD checks fires 20–40 outbound requests) fires on a single click with no confirmation.

---

## Fix plan — 8 focused edits

### 1. Honest Run-all + per-click summary
`ledger-qa.tsx`
- Replace the fire-and-forget loop with `Promise.allSettled(checks.filter(...).map(c => c.refetchPromise()))`. Each hook exposes `refetch: () => Promise<QueryObserverResult>` (React-Query already returns a promise; wire it through the `Check` type).
- Snapshot verdicts BEFORE and AFTER the batch; render a `Last run: 10 pass · 1 warn · 1 fail · Δ 3 flipped (2 warn→pass, 1 pass→fail)` strip with timestamp and a "Copy JSON" button.
- Same treatment for `Run everything` (adds write probes and shows credit tally at the end).

### 2. Real cold-start simulator
- Convert the loop to `for (const c of reads) { const t0 = Date.now(); const res = await c.refetchPromise(); timeline.push({...}) }`.
- Add per-step Cancel (aborts the loop, keeps prior rows).
- Show cumulative ms budget vs 30s ceiling; red-flag any read >5s.

### 3. Wider overview + friendlier enrichment copy
`deriveFinding`
- `overview`: if sectors present but any ministry lacks a `ministry_profiles` row, downgrade to `data-quality` and map to `backfillMinistryProfiles` (already in registry).
- `enrichment` (`data-missing`): rewrite `rootCause` to "No capital_flows committed for {cc} — click *Backfill capital flows* below (3-pass Perplexity waterfall, ~60s, writes to `country_capital_flows`)."

### 4. Cascade fix — dedup + full invalidation
- `cascadeFix`: deduplicate the remediator chain (`Array.from(new Set(chain))` across all blocked keys) before running.
- `onSuccess` for every remediator mutation invalidates: `["ledger-qa", cc]`, `["ledger-qa-actions", cc]`, and every `["ledger-qa", cc, "attempts", *]` domain used by open drawers.
- After the cascade completes, force `refetch` on all read checks so the header counts settle without a manual second click.

### 5. AI Diagnose → dispatchable
- In `AiDiagnoseButton`, when `mut.data.remediator_key` is a valid `RemediatorKey`, render a secondary "Run suggested remediator" button that calls `runRemediatorByKey` (already exported) and invalidates like the primary path.
- Keep the 10-min in-memory cache; add a "Force fresh diagnose" toggle for debugging.

### 6. Phase 7 — credit-safe write probes
- New migration `qa_probe_cache(cc text, check_key text, response jsonb, created_at timestamptz default now(), primary key (cc, check_key))` + grants + admin-only RLS.
- Wrap `explainFigure`, `askTheLedger` calls behind a `runProbe(cc, key, fn)` helper that reads the row if `< 10 min` old, else calls the fn and upserts.
- `snapshot-rt`: before insert, delete probe rows in `figure_snapshots` where `label LIKE 'QA snapshot probe · %'` and `id NOT IN (top 3)` for this cc. Cache result 10 min.
- `handoff`: same treatment on `intake_items` tagged `note='Ledger-QA handoff probe'`.
- Add a "Force fresh probe" checkbox in each probe drawer (bypasses cache).

### 7. Public hook — parity + dedicated key
- Add secret `LEDGER_QA_HOOK_KEY` (via `secrets--add_secret`); compare that instead of the anon key.
- Extend the GET to emit all 12 verdict rows by calling the same server functions the UI uses (`getPublishGate`, `getReconciliationReport`, `getSourceHealth`, `getTrustSignals`, `getCorpusMissStatus`) via `supabaseAdmin` inside the handler, plus a "skipped" placeholder for the 4 write probes.
- Add `run_id` (uuid) and `wall_ms` per verdict in the JSON shape so cron/CI can chart trend.

### 8. Confirm before spending
- Wrap every remediator button in a lightweight confirm: `window.confirm('Run <label>? This calls Perplexity/AI and writes rows.')`. Skip confirm for `repairInvalidSourceUrls` and `retryUnreachableSources` (idempotent, no external cost).
- Show estimated cost class next to each button (`~10 credits`, `HEAD-only, free`, `writes ~30 rows`).

---

## Verification

- `bunx tsgo --noEmit` after each edit batch.
- On `/admin/ledger-qa` for LCA: click *Run all reads*, confirm summary strip appears and rows settle without a second click.
- Click *Simulate cold-start*, confirm timeline shows actual latencies and no `idle` entries for reads that succeed.
- Trigger *Backfill capital flows*, confirm `RecentAttemptsPanel` refreshes within 20s and enrichment row flips to pass on next Run All.
- `curl -H "apikey: $LEDGER_QA_HOOK_KEY" 'https://gdpvision.lovable.app/api/public/hooks/ledger-qa?country=LCA'` returns 12 verdicts.

## Rollout order

1. Fix D (cascade invalidation) — 1 file, 15 lines.
2. Fix C (overview + enrichment copy).
3. Fix 1 + 2 (honest run-all + real cold-start).
4. Fix 5 (AI diagnose dispatch).
5. Fix 6 (Phase 7 write-probe hygiene) — includes migration.
6. Fix 7 (public hook parity + dedicated key).
7. Fix 8 (confirm modals + cost hints).

Each phase is independently shippable; no phase depends on a later one.
