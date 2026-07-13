## Forensic finding — "nothing happens" is misleading

Reading the network log for the LCA onboard page proves the click does fire. Timeline for the last press on stage 10 (Corpus ingest):

- `14:51:34` — `POST /_serverFn/…runCorpusIngest…` sent with `{countryCode:"LCA"}`.
- `14:52:47` — response `{ok:true, totalChunks:0, okCount:3, failCount:22, results:[…]}` (73 seconds later).
- `14:52:48` — auto-refresh POSTs `getOnboardingStatus`.

So the button worked, the run executed, the DB was updated. What broke is the **feedback loop and the underlying data quality** — not the click.

### Why admin perceives "nothing"

1. **No visible progress.** During those 73 s only the small dark button on the far right of a *collapsed* accordion row changes to "Researching…". No page-level banner, no toast, no elapsed timer, no per-source ticker. On a long stage this looks frozen.
2. **Auto-commit hides the result.** `runCorpusIngest` writes a summary draft and immediately `markDraftCommitted`s it. The accordion header only shows the "committed" pill — which was already there from the previous run — so nothing visibly changes. The detailed `results[]` (`okCount`, `failCount`, per-URL errors) live inside the collapsed body.
3. **The "success" is a lie.** Of 25 active `country_sources`, the response shows:
   - 22 × `Firecrawl 400: Invalid URL` — because the source_registry agent (stage 6) stored *search-hint strings* like `"Invest Saint Lucia official website (search: \"Invest Saint Lucia\")"` in the `url` column.
   - 3 × `ok:true, chunks:0` — WB / IMF country pages returned <200 chars of markdown on the first run, so the "too short" guard fired earlier; on this rerun the dedup path (same `content_hash`) short-circuits and reports `ok:true, chunks:0`. Zero new embeddings, zero new brain content.
4. **`refresh()` invalidates queries but nothing surfaces at the top of the page.** The bulk-runner has an error banner (`bulkErr`); a single-stage run has none.

Combined effect: admin waits 60–90 s, sees the small button return to "Re-run agent", scrolls the page, sees no change → concludes "nothing happens".

## Plan — three concurrent fixes

### 1. Frontend: make the run visible end-to-end (`src/routes/_authenticated/admin/countries.$code.onboard.tsx`)

- Lift a `activeRun: { stage, startedAt } | null` state up to `OnboardWizard`. Pass a `onRunStart(stage)` / `onRunFinish(stage, result)` pair to each `StageCard` so per-stage clicks report up.
- Render a **sticky run banner** below the header while `activeRun` is set: stage label, elapsed seconds (updates via `setInterval`), and a Cancel-disabled note. Non-dismissable until the promise resolves.
- On resolve, replace the banner with a **result banner** for ~15 s (or until dismissed): `okCount`/`failCount`/`totalChunks` for corpus_ingest, plus `View details` that opens that stage's accordion and scrolls to it (reuse the `scroll-mt-2` behavior already added).
- On reject, keep the banner red with the error message and a `Retry` action.
- Inside `StageCard`, when the current stage matches `activeRun.stage`, auto-open the accordion so the results panel is visible when the run finishes.
- In stage 10's expanded body, always render a **Last ingest report** panel (from `lastRun.plan` / the committed draft payload): grid of source rows with `ok` / `error` / `chunks`. Currently this data is fetched but never rendered outside `<PrettyJson>` inside a draft block — for auto-committed stages there is no draft after commit.

### 2. Server: expose live progress for long stages (`src/lib/country-onboarding/corpus.functions.ts`)

- Keep `runCorpusIngest` returning the same shape (so the UI change works immediately), and **update the run's `plan` column after each source** with `{ processed, total, lastUrl, okCount, failCount }`. The wizard already invalidates `onboarding` status on refresh, so a short poll (every 3 s) from the frontend while `activeRun` is set surfaces heartbeat progress. No new endpoint, no streaming complexity.
- Add a small `getRunProgress({ runId })` server function that returns just `{ status, plan, finished_at }` for that runId, used only by the banner poll to avoid re-fetching the whole onboarding status.

### 3. Data quality: stop garbage URLs entering `country_sources` (`corpus.functions.ts` → `commitSourceRegistry`, plus stage 6 UI)

- In `commitSourceRegistry`, validate each row's `url` with a strict check: `new URL(u)` must succeed **and** the hostname must contain a `.`. Reject strings that contain `(search:` or don't parse. Return a `rejected[]` array in the response so the reviewer sees them.
- Extend the draft-review UI for stage 6 to show a "⚠ not a URL — will be dropped" chip per row and let the admin either edit the URL inline or delete the row before committing. This is the root cause of the 22 Firecrawl 400s.
- One-shot backfill for existing rows: add `cleanInvalidCountrySources({ countryCode })` (admin-only) that deactivates any `country_sources` row whose `url` fails the same validator, and expose it as a "Clean invalid URLs" button on stage 10 above the run button. Run it once on LCA and the next `Run AI research` will actually scrape.

## Verification

1. Click **Clean invalid URLs** on LCA → expect ~22 rows flipped to `active=false`, banner reports the count.
2. Click **Run AI research** on stage 10:
   - Sticky banner appears immediately with `Corpus ingest · 0s elapsed`.
   - Elapsed counter ticks each second; every ~3 s "Processed n / m" updates from the `getRunProgress` poll.
   - On completion, green banner: `Ingested X chunks across Y sources (Z failed)`; accordion auto-opens; "Last ingest report" panel lists every URL with ok/error and chunk count.
3. Re-run without any URL changes → banner shows same result within seconds (dedup path); admin now sees the summary and understands why chunks:0.

## Out of scope

- Streaming SSE from the server function — poll on the run row is enough and stays inside the existing `createServerFn` contract.
- Migrating source_registry to a stricter Zod URL at the agent-output layer — belongs in a follow-up; for now we sanitize at commit and offer a cleanup pass.
- Any change to accordion scroll behavior, `PrettyJson`, or citations rendering.
