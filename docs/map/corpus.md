# Corpus / Second-brain map

Everything AI-researched lands in the corpus. All reads and writes go through the gateway — never write directly from a component or a stage committer without deduping.

## Types

- **Shared types (client + server safe)**: `src/lib/corpus/types.ts` — `CorpusDomain`, `CorpusCitation`, `CorpusReadResult<T>`, `CorpusOutcome`.

## Gateway + writers

- **Gateway (server)**: `src/lib/corpus/gateway.server.ts` — resolves domain → searcher, records provenance + latency, coalesces citations.
- **Writers (server)**: `src/lib/corpus/writers.server.ts` — canonical upsert helpers. Example: `upsertCountrySource(country, org, url, …)` is the ONLY way to add a `country_sources` row. Never `insert` directly.
- **Audit fn**: `src/lib/corpus/audit.functions.ts` — surfaced in the admin `corpus-audit` route.

## Domain searchers

`src/lib/corpus/searchers/*.server.ts` — one file per domain.

| Domain | File | Returns |
|--------|------|---------|
| `citation` | `citation.server.ts` | 3–8 authoritative URLs (`CorpusCitation[]`) |
| `sector` | `sector.server.ts` | GDP share % by 3-letter sector code |
| (extend) | add file + register in gateway | typed payload + citations |

All searchers wrap `runWithFallbacks` from `src/lib/country-onboarding/fallback.server.ts` (Perplexity → Gemini repair → infer). Every returned row must carry an https `source_url` when applicable.

## Tables

The "no duplicates" contract (core memory rule) covers:

- `country_sources` — dedup on `(country_code, normalized_url)`; go through `upsertCountrySource`.
- `country_source_documents` — dedup on `(source_id, storage_path)`.
- `country_source_chunks` — dedup on `(document_id, chunk_index)`.
- `memory_objects` — dedup on `(country_code, kind, normalized_key)` via `memory-dedup.server.ts`.
- `country_kpis` / `country_kpi_points` — dedup on `(country_code, kpi_code)` / `(kpi_id, period)`.
- `ministry_profiles` — dedup on `(country_code, ministry_slug)`.
- `sector_dossiers` — dedup on `(country_code, sector_code)`.
- `onboarding_citations` — dedup on `(country_code, stage, normalized_url)`; 1-indexed to match `[N]` markers.

Every ingest and re-ingest path MUST upsert-on-conflict — re-runs are idempotent.

## Snapshotting citations

- `sector_dossiers.citations` and `ministry_profiles.citations` (jsonb, ordered) are snapshotted at commit time from `onboarding_citations` so `[N]` markers in narrative text remain resolvable when the underlying citation list changes.
- When rendering `<PrettyJson>` for payloads containing `[N]` markers, always pass the ordered `citations` array so refs become clickable and open the source modal.

## Public vs private visibility

Every corpus table carries `visibility` ('public' | 'private') + ownership (`owner_country_code`, `owner_user_id`). RLS enforced via SQL helper `has_country_access(country_code)`:

- Public rows: readable by any authenticated user with country access.
- Private rows: readable only by that country's admins.

When adding a corpus write path, ALWAYS pass `visibility` explicitly; default to `'private'` for admin-uploaded content, `'public'` for AI-researched content.

## Reading from a component

Do not call searchers or Perplexity/Gemini from components. Instead:

1. Add a `createServerFn` in the relevant `*.functions.ts` module.
2. That handler calls the gateway (or a specific searcher) inside `.handler()`.
3. Component uses `useServerFn` + `useQuery` to read.

## Common pitfalls

- **Duplicate `country_sources`** → someone bypassed `upsertCountrySource`. Grep for `.from('country_sources').insert(` and route through the writer.
- **Missing citations in commit** → stage committer didn't snapshot `onboarding_citations` into the destination row's `citations` jsonb.
- **`[N]` refs unclickable** → `<PrettyJson>` invoked without `citations` prop.
- **RLS 500** → new corpus table missing GRANTs; see `public-schema-grants`.
