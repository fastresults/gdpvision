## Yes — meaningful gaps remain

What's live today:
- Gateway (`corpusRead`), audit table, kill-switch, cooldown, write-back — done.
- Memory searcher (Perplexity → Gemini → inference) — done, wired into `counsel.askCounsel` and `narrative.getCoverage`.
- Lightweight audit-only instrumentation on `viz.getVizOverview`, `consume.listCountryKpis`, `ledger.getPublishGate`.
- Admin `/admin/corpus-audit` + Ledger-QA "Corpus fallback active" check — done.

Gaps that still leave silent misses possible:

### 1. Five of the six domain searchers do not exist yet
Only `memory` has an external waterfall. `kpi`, `sector`, `ministry`, `dossier`, `flow`, `citation` reads currently log `empty` to the audit table but have no auto-search → the corpus never self-heals for those domains.

### 2. ~30+ runtime read sites still bypass the gateway
Sampling only the non-writer/onboarding files, these still do raw `.from(...).select(...)` with no audit trail or fallback:

- `ledger.functions.ts`: lines 50, 135, 424, 681-711, 896, 1055, 1168-1172, 1320, 1384 (sectors, memory, flows, ministries, dossiers, sources)
- `ledger.functions.ts:1450` (sectors, still un-instrumented)
- `viz.functions.ts:218` (kpi_points), `:292` (sector_dossiers), `:298` (memory_objects)
- `flows.functions.ts:69, 71` (capital flow nodes + values)
- `dossier.functions.ts:101` (memory)
- `citations.functions.ts:143` (memory)
- `scenarios.functions.ts:34, 68` (ministries + ministry_sectors)
- `config.functions.ts:97, 102, 210` (sectors, ministries)
- `narrative.functions.ts:32` (`listMemoryObjects` — corpus not audited)
- `mandate.functions.ts` (unaudited)

### 3. No structural enforcement
There is no ESLint / grep gate. Any new PR can add another raw `supabase.from("memory_objects").select(...)` and it will silently degrade on miss with no signal.

### 4. Write-back paths are still per-domain-ad-hoc
`writers.server.ts` re-exports `upsertCountrySource` + `upsertMemoryObject`. It doesn't yet unify `upsertKpi / upsertKpiPoint / upsertSectorDossier / upsertMinistryProfile / upsertCapitalFlow / insertOnboardingCitation`. Domain searchers can't cleanly write back without those wrappers.

### 5. Admin visibility is partial
`/admin/corpus-audit` shows outcomes per domain, but has no "empty" list per domain and no per-key "Re-drive this miss" button (the redrive function exists — just not exposed row-by-row).

---

## Phased plan to close them

Each phase is a self-contained turn — approve one at a time.

**Phase A — Unify writers** (small, prerequisite)
Add to `writers.server.ts`:
- `upsertKpi` + `upsertKpiPoint` (delegate to existing `kpi-seed.server.ts` writer)
- `upsertSectorDossier`, `upsertMinistryProfile` (delegate to existing `corpus.functions.ts` writers)
- `upsertCapitalFlow` (delegate to `capital-flows.server.ts`)
- `recordCitation` (dedup on `(country_code, url)` unique index we already added)

**Phase B — Domain searchers** (one file each, wraps existing waterfalls)
- `searchers/kpi.server.ts` — targeted Perplexity + WB + IMF + Gemini for a single KPI
- `searchers/sector.server.ts` — Perplexity sector-share reasoning + WB validation
- `searchers/ministry.server.ts` — Perplexity minister-profile + gov site
- `searchers/dossier.server.ts` — Perplexity sector-dossier facts
- `searchers/flow.server.ts` — Perplexity capital-flow reasoning (already exists in `capital-flows.server.ts`, just wrap)
- `searchers/citation.server.ts` — Perplexity source discovery

**Phase C — Migrate the 30+ read sites** (batched by file)
- Batch 1: `ledger.functions.ts` (7 read groups) → `corpusRead()` where the read feeds user-visible output; `recordCorpusReadOutcome()` where it's an internal count.
- Batch 2: `viz.functions.ts` remaining reads (dossiers/memory/kpi_points).
- Batch 3: `flows.functions.ts` → `corpusRead` with flow searcher.
- Batch 4: `dossier.functions.ts`, `citations.functions.ts`, `scenarios.functions.ts`, `config.functions.ts`, `narrative.listMemoryObjects`, `mandate.functions.ts`.

**Phase D — Structural enforcement**
- Custom ESLint rule `no-raw-corpus-read`: forbids `.from("<protected-table>").select(...)` outside an allow-list (writers, admin QA, migrations, gateway itself).
- Add to `eslint.config.ts`. Fail CI on violation.

**Phase E — Admin polish**
- `/admin/corpus-audit`: add per-domain "empty keys" table with a per-row **Re-drive** button (hits existing `redriveCorpusMisses`).
- Show tier + latency histograms.

**Phase F — Optional: proactive backfill cron**
- Nightly server route reads unresolved-miss list and re-drives top N. Skip unless you want it — the on-demand loop already self-heals.

---

## Recommendation

Start with **Phase A + B together** (writers + all six searcher stubs) as the next turn — that closes the "no waterfall for 5 domains" gap and unlocks migrations. Then Phase C in 1-file batches. Phase D last so the lint gate doesn't fire mid-migration.

Reply "proceed" to run Phase A+B, or pick a specific phase.
