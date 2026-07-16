## Goal

Backfill `ministry_profiles.minister` and `ministry_profiles.minister_profile` for every existing country that already has ministries, using the new `resolveMinister` 4-pass loop (corpus → targeted web → wide web → cross-check) shipped in `minister-research.server.ts`. This is a one-shot admin backfill separate from the onboarding pipeline — it does not re-run Stage 9 end-to-end, it only fills the identity gap.

## Current gap (from live DB)

| Country | Ministries | Profiles | Have minister name | Have full minister_profile |
|---|---|---|---|---|
| AIA | 15 | 15 | 9 | 10 |
| ATG | 10 | 10 | 10 | 10 |
| BLZ | 17 | 17 | 17 | **0** |
| BRB | 12 | 12 | 12 | 12 |
| DMA | 6 | 6 | 6 | 6 |
| GRD | 14 | 14 | 11 | 14 |
| **KNA** | 10 | **0** | **0** | **0** |
| LCA | 20 | 20 | 17 | 20 |

Two failure modes to fix:
1. **Missing rows entirely** (KNA): no `ministry_profiles` at all — need to create + resolve.
2. **Missing/thin minister identity** (AIA, BLZ, GRD, LCA): profile row exists but `minister` is null or `minister_profile` is `{}`.

## Plan

### 1. New admin server function — `backfillMinisters`
File: `src/lib/country-onboarding/minister-backfill.functions.ts`

- `createServerFn({ method: 'POST' })` guarded by `requireSupabaseAuth` + admin role check (via `has_role`).
- Input: `{ country_code?: string, ministry_slugs?: string[], force?: boolean, dry_run?: boolean }`.
  - No `country_code` → iterate every country that has ≥1 ministry.
  - `force=false` (default) → only touch rows where `minister IS NULL` OR `minister_profile = '{}'::jsonb`.
  - `dry_run=true` → return the plan without writing.
- For each target ministry:
  1. Call `resolveMinister({ countryCode, ministrySlug, ministryName, existingProfile })` from `minister-research.server.ts`.
  2. Upsert into `ministry_profiles` on `(country_code, ministry_slug)`:
     - Set `minister`, `minister_profile`, append new `citations`, extend `source_ids` (dedup).
     - Never clobber a stronger existing profile with a weaker result — merge, don't overwrite.
  3. Write one `corpus_fetch_attempts` audit row per pass (already done inside the resolver).
- Concurrency: process ministries with `p-limit`-style throttle of 3 in-flight per country to respect Perplexity rate limits; sequential across countries.
- Return: per-country summary `{ country, attempted, resolved, updated, skipped, failed, errors[] }`.

### 2. Admin UI trigger
File: `src/routes/_authenticated/admin/countries.index.tsx`

- Add a small "Backfill ministers" toolbar button (admin-only) that opens a modal:
  - Country picker (multi-select, defaults to "All 8 with gaps").
  - Toggles: `Force refresh`, `Dry run`.
  - Runs `backfillMinisters` via `useServerFn`, streams per-country results into a `<PrettyJson>` panel.
- No changes to onboarding stage UI.

### 3. Post-run reconciliation
- After each country completes, re-emit Stage 5 (`ministry_sector_map`) diagnostics ONLY IF new minister identities landed — reuses existing `runMinistrySectorMapAgent` in dry-preview mode so the `minister_index` sidecar in the latest draft picks up the new names. This is opt-in via a checkbox in the modal (default on).

### 4. Verification
- `bunx tsgo --noEmit` clean.
- Dry-run on KNA → expect 10 planned resolutions, 0 writes.
- Live run on KNA → expect ≥8/10 ministries resolved with ≥1 citation; `ministry_profiles` count goes 0 → 10.
- Live run on BLZ with `force=false` → expect 17 `minister_profile` fills, `minister` scalars untouched (already set).
- Spot-check `corpus_fetch_attempts` for audit trail.

### Technical notes

```text
backfillMinisters(country?)
  └── for each country with ministries
       └── for each ministry (concurrency=3)
            └── resolveMinister (4-pass)
                 ├── pass 1: corpus (gemini-3.1-flash-lite)
                 ├── pass 2: targeted web (sonar-reasoning-pro, gov domain)
                 ├── pass 3: wide web (sonar-reasoning-pro)
                 └── pass 4: cross-check (sonar-pro)
            └── merge → upsert ministry_profiles
```

- No DB migration required — `ministry_profiles` already has `minister`, `minister_profile`, `citations`, `source_ids`.
- No changes to `corpus.functions.ts` (Stage 9) or `agents.functions.ts` (Stage 5) beyond what's already shipped.
- Idempotent by default (skip already-resolved rows); `force=true` re-runs everything.
- Admin-only: unauthenticated / non-admin calls throw 403.
