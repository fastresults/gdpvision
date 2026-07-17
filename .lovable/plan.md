## Root cause (verified)

"Run all pending" hit **"Failed to fetch"** at stage 6 (source_registry). The UI card shows `last run planning`, meaning the `onboarding_runs` row is still open — the server-side handler never finished (from the client's perspective).

What actually happened:
- `runSourceRegistryAgent` uses `sonar-reasoning-pro` as its primary model (`corpus.functions.ts:300`), and if the first pass returns <10 valid URLs it does a second `sonar-pro` retry (`:325-334`).
- `callSonar` in `perplexity.server.ts:95` allows **240s** per call, so the worst case is ~8 minutes of a single synchronous server function.
- The browser/edge proxy in front of `createServerFn` aborts long-lived POSTs well before that (~60–120s). The abort surfaces to the client as **`TypeError: Failed to fetch`** — nothing to do with Perplexity or the DB.
- The client-side `runAllPending` loop (`countries.$code.onboard.tsx:433-447`) only retries on `RUN_LOCKED` / "already in progress". A `Failed to fetch` is thrown out as a hard stop, and the row is left in `planning`, blocking the next attempt until the 10-minute stale-lock sweep.

This is the same class of failure we already fixed for `ministry_deep_dive` — a single long server call vs. a short-lived edge proxy — and it will hit any future stage that leans on `sonar-reasoning-pro` twice in one call.

## Fix (generalizes to every stage, not just source_registry)

### 1. Shorten the source_registry server call so it fits one proxy window
`src/lib/country-onboarding/corpus.functions.ts` `runSourceRegistryAgent`:
- Primary model: `sonar-pro` (fast, ample citations for a link registry — reasoning tokens add nothing here).
- Retry tier only if the primary produced `<10` valid URLs: switch to `sonar-reasoning-pro` with `noDomainFilter: true`, but **cap that retry with a hard `AbortController` at 55s** so the total handler stays under the proxy budget. If the retry aborts, keep the primary result.
- Keep the existing "≥1 valid URL required" gate; drop primary result to a draft even if the retry aborted.

### 2. Make the client resilient to transient proxy disconnects (any stage)
`src/routes/_authenticated/admin/countries.$code.onboard.tsx` `runSequential`:
- Extend the existing recoverable-error branch (currently just `RUN_LOCKED` / "already in progress") to also treat `Failed to fetch` / `NetworkError` / `AbortError` / HTTP 502/504 as **transient**.
- Recovery sequence when transient:
  1. `await clearOnboardingLocks({ countryCode: code, stage })` — release the `planning` row so the resume path is clean.
  2. Wait 8s, then call `advanceStep` again. Because the disconnected handler often *does* complete server-side and write a draft, the orchestrator will usually return `commit_ready_draft` on the next tick — we commit for free with no extra AI spend.
  3. If no draft is ready, re-invoke the runner once (max 1 retry).
- Update the "Stage failure" banner copy to say `transient network error — retried` when this path recovers, so operators see it worked.

### 3. Recover the current TCA run
Immediately after the code change, one manual click of **Run all pending** on `/admin/countries/TCA/onboard`:
- Clears the stuck `planning` lock (new client logic auto-clears; if the user prefers, they can hit the existing **Clear locks** button first).
- Resumes from `source_registry` with `sonar-pro`, commits, and continues through stages 7–12.

## Why this prevents recurrence

- **Budgeted server work.** No source_registry call can exceed ~60s wall time regardless of retry, so it fits the edge proxy.
- **Uniform transient handling.** Every stage in the sequential runner now survives a dropped POST the same way — clear lock, prefer commit-ready draft, single retry — instead of each stage needing bespoke resume plumbing.
- **No wasted spend.** When the server did finish behind a dropped connection, the retry finds the draft and commits instead of re-running Perplexity.

## Files touched

- `src/lib/country-onboarding/corpus.functions.ts` — swap primary/retry models and add AbortController budget in `runSourceRegistryAgent`.
- `src/routes/_authenticated/admin/countries.$code.onboard.tsx` — broaden transient-error recovery in `runSequential`, add lock-clear-then-advance step.

No schema changes, no new tables, no new secrets.