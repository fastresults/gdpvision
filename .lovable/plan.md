## Goal

Make one **global rule** enforceable across the codebase: any code path that asks the corpus for data and comes up short MUST — automatically, in-line — trigger an external deep search (Perplexity → Firecrawl → World Bank / IMF → Gemini gateway → inference), and any usable result MUST be written back into the corpus (deduped) before the caller returns. No silent `?? []`, no silent thin output.

Today: two isolated waterfalls (`runWithFallbacks` in `fallback.server.ts`, `kpi-research.server.ts`) exist but only run from the admin-triggered onboarding pipeline. Every *runtime* consumer (`counsel`, `narrative`, `dossier`, `viz`, `scenarios`, `ledger`, `consume`, `flows`) reads directly with plain Supabase queries and silently degrades on miss. This plan closes that gap universally.

## The contract (one function, one shape)

`src/lib/corpus/gateway.server.ts` — the ONLY sanctioned way to read the corpus:

```ts
export async function corpusRead<T>(spec: {
  scope: { countryCode: string; sector?: string; ministry?: string };
  domain: "sources" | "memory" | "kpi" | "sector" | "ministry" | "dossier" | "flow" | "citation";
  key: string;                              // stable natural key (dedup fingerprint)
  read: () => Promise<T | null>;            // Supabase read; returns null/[] on miss
  isEmpty: (t: T | null) => boolean;        // caller decides "empty enough to search"
  search: (ctx: CorpusCtx) => Promise<{ data: T; citations: Citation[]; tier: string; }>;
  writeBack: (t: T, citations: Citation[]) => Promise<void>;  // idempotent upsert
  budget?: { maxMs?: number; maxCredits?: number; forceRefresh?: boolean };
}): Promise<{ data: T; source: "corpus" | "external"; tier?: string; citations?: Citation[] }>
```

Behavior:
1. Call `read()`. If `!isEmpty`, return `{ source: "corpus" }` — done.
2. Otherwise check a **cooldown log** (`corpus_fetch_attempts`) — if we searched for this `(scope,domain,key)` within N minutes and it also came back empty, return the empty result and skip. Prevents storms.
3. Call `search(ctx)` (delegates to the domain-appropriate waterfall — see below).
4. Await `writeBack(data, citations)` **before** returning, so the next reader hits the corpus.
5. Log every attempt (hit/miss/tier/latency/credits) to `corpus_fetch_attempts` for the audit trail.
6. Emit a `<PrettyJson>`-friendly `provenance` object the UI can render as a "how we got this" chip.

## Domain waterfalls (thin adapters over what already exists)

`src/lib/corpus/searchers/` — one file per domain, each returning the standard `{data, citations, tier}` shape:

- **memory / sources / dossier / ministry / flow** → wrap `runWithFallbacks` (`fallback.server.ts`). Adds Firecrawl `search` (not just `scrape`) as an intermediate tier before Gemini escalation, using the discovered domains from Perplexity.
- **kpi / kpi_points** → wrap the existing 5-pass pipeline in `kpi-research.server.ts` (sweep → WB → IMF → targeted → Gemini).
- **sector** → composition inference: Perplexity sweep on `country_sectors` shape, then WB SL.AGR.EMPL/etc. as ground truth, then Gemini repair.
- **citation** → Perplexity `discoverOfficialUrls` + `fetchCitationText`, dedup on URL.

Every searcher receives `buildCountryContext(cc)` so it never asks a question the corpus already answers.

## Write-back is centralized, not per-call

`src/lib/corpus/writers.server.ts` — thin wrappers that ALREADY exist but are re-exported here so `corpusRead` can call them uniformly:

- `upsertCountrySource` (already in `sources.server.ts` — reuse, dedup on `(country_code, kind, org)` for `kpi_source` else `(country_code, url)`)
- `upsertMemoryObject` (extract from the inlined block in `corpus.functions.ts:1817-1846`; formalize dedup key = `sha256(scope_key + kind + title + content)`)
- `upsertKpi` / `upsertKpiPoint` (already `onConflict: "country_code,kpi_code"`)
- `upsertSectorDossier`, `upsertMinistryProfile`, `upsertCapitalFlow` (already exist inline; wrap)
- `insertOnboardingCitation` — **add** missing dedup key `(country_code, url)` unique index (currently duplicating on re-runs — flagged in audit gap #6).

Every writer records to `data_revisions` (already exists) with `source='external-fallback'` and the tier tag, so the audit trail is queryable.

## Audit table + one migration

`corpus_fetch_attempts` (new): `id, country_code, domain, key, outcome (hit|external|empty|throttled), tier, credits, latency_ms, actor, created_at`. Super-admin-only SELECT, service_role INSERT. Index on `(country_code, domain, key, created_at DESC)` for the cooldown check.

Also add the missing unique index on `onboarding_citations (country_code, url)` in the same migration.

## Enforcement (the "audit everything" part)

Two mechanisms, both automatic:

1. **ESLint rule** (`.eslintrc` custom rule under `eslint-rules/no-raw-corpus-read.ts`):
   - Forbid `supabase.from("<corpus-table>").select(...)` outside an allow-list of writer/admin/QA files (`corpus/**`, `country-onboarding/**`, `country-data/manage.functions.ts`, `admin/**`, `ledger-qa/**`).
   - Every other file must go through `corpusRead(...)`. Violations fail typecheck.
   - Table list: `country_sources`, `country_source_documents`, `country_source_chunks`, `memory_objects`, `country_kpis`, `country_kpi_points`, `country_sectors`, `country_capital_flows`, `ministry_profiles`, `sector_dossiers`, `onboarding_citations`.

2. **Runtime audit page** — `/admin/corpus-audit` (super-admin): reads `corpus_fetch_attempts` grouped by `(domain, key)` for a country and shows:
   - miss rate per domain (last 24h/7d)
   - top 20 empty keys (candidates for scheduled backfill)
   - "external tier used" breakdown (Perplexity vs WB vs Gemini …)
   - a "Re-drive misses" button that re-runs the cooldown-throttled searches with `forceRefresh: true`

## Migration of existing read sites (ranked, per audit gaps)

Applied in order — each is a mechanical rewrite from `supabase.from(X).select(...)` to `corpusRead({...})`:

1. **`counsel.functions.ts:89`** (memory_objects) — highest blast radius.
2. **`scenarios.functions.ts:84,225` + `ledger.functions.ts:50,135,695,1168,1448`** (country_sectors).
3. **`consume.functions.ts:39` + `viz.functions.ts:112,197`** (country_kpis / points).
4. **`narrative.functions.ts:34,61,174,461` + `dossier.functions.ts:101`** (memory_objects).
5. **`viz.functions.ts:114,271`, `flows.functions.ts:71`, `ledger.functions.ts:685,896,1171,1449`** (ministries / dossiers / flows).

Admin CRUD in `country-data/manage.functions.ts` is intentionally excluded from the rule — admins editing raw rows must see reality, not fallback data.

## Guardrails

- **Never call searchers from a public route loader**: server functions only; loaders that need fresh data get it via `useQuery` in the component, so SSR doesn't burn credits on every crawl.
- **Credit budget per request**: `budget.maxCredits` defaults to a small ceiling; `corpusRead` short-circuits to empty if the budget is exhausted and logs `outcome=throttled`.
- **Cooldown** default 30 min per `(country, domain, key)` — configurable; prevents a burst of identical searches when a page has many misses.
- **Feature flag** `CORPUS_FALLBACK_ENABLED` in `app_settings` — default on; a super-admin kill switch if a searcher misbehaves.
- **Idempotent writers** — writers already upsert; audit adds the one missing unique index on `onboarding_citations`.

## Deliverables (in order)

1. Migration: `corpus_fetch_attempts` table + grants + RLS + `onboarding_citations (country_code, url)` unique index.
2. `src/lib/corpus/gateway.server.ts` (`corpusRead` + cooldown + audit log).
3. `src/lib/corpus/writers.server.ts` (re-exports + extract `upsertMemoryObject`).
4. `src/lib/corpus/searchers/{memory,sources,kpi,sector,ministry,dossier,flow,citation}.server.ts` — thin adapters over `runWithFallbacks` and `kpi-research`.
5. ESLint rule `eslint-rules/no-raw-corpus-read.ts` + allow-list; run in the same typecheck.
6. Migrate the 5 ranked call-site groups above (one commit per group).
7. `/admin/corpus-audit` route: miss-rate table, tier breakdown, top empty keys, re-drive button.
8. Ledger-QA cross-link: add a new check row "Corpus fallback active — no silent misses last 24h" that goes RED if `corpus_fetch_attempts` shows any `outcome='empty'` without a subsequent successful `outcome='external'`, and its `systemicFix` is a one-click "re-drive" using the new gateway.

## Verification

- `bunx tsgo --noEmit` + `bun lint` — the ESLint rule reports zero violations after migration.
- `/admin/corpus-audit` for LCA: after visiting `/instrument`, `/counsel`, `/narrative` on a country with sparse data, the audit page shows external fetches with tier=`sonar-pro`/`worldbank`/etc. and the corpus row counts grow.
- Second visit to the same page shows `source: "corpus"` for what was just fetched — proves write-back is closing the loop.
- Ledger-QA row goes green.

## Out of scope

- Actually seeding demo data for LCA (operator action).
- Streaming search progress to the UI (nice-to-have follow-up; the audit page + provenance chip is enough for v1).
- Cron-driven proactive backfill of the "top empty keys" list — framework supports it; wiring deferred.
