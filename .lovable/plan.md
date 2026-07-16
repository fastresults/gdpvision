## What's failing on KNA

The KNA workflow is stuck on **Stage 5 (ministry_sector_map)**. The last run (`211f97cb…`, 21:54:15Z) failed with:

```
duplicate key value violates unique constraint "onboarding_drafts_one_live_per_stage"
```

That index is:

```sql
CREATE UNIQUE INDEX onboarding_drafts_one_live_per_stage
  ON onboarding_drafts (country_code, stage)
  WHERE committed_at IS NULL;
```

The earlier successful run (`6626d346…`, 21:51:18Z) already produced a live (uncommitted) `ministry_sector_map` draft for KNA. When the stage was re-run without committing that draft first, the second `INSERT` collided with the partial unique index.

## Why this is systemic

There are three `saveDraft` helpers in the onboarding code:

| File | Behavior |
|---|---|
| `src/lib/country-onboarding/corpus.functions.ts` | ✅ Correct: SELECTs the existing live draft and UPDATEs it, with a 23505 race fallback + citation refresh. |
| `src/lib/country-onboarding/agents.functions.ts` | ❌ Naive `INSERT` — trips the index on every re-run of `profile`, `gdp`, `sector_composition`, `ministries`, `ministry_sector_map`. |
| `src/lib/country-onboarding/kpi-seed.server.ts` | ❌ Naive `INSERT` — same failure mode for the `kpi_seed` stage. |

KNA hit it on `ministry_sector_map`, but every stage owned by `agents.functions.ts` or `kpi-seed.server.ts` will fail identically on any re-run before commit. This is the "fix once for all future countries" part.

## Fix

Port the proven `corpus.functions.ts` `saveDraft` pattern into the other two helpers. No schema changes.

### `src/lib/country-onboarding/agents.functions.ts` (lines 82–123)

Replace the naive insert with:
1. `SELECT id FROM onboarding_drafts WHERE country_code=? AND stage=? AND committed_at IS NULL` (newest first, limit 1).
2. If found → `UPDATE` that row with the new payload/citations/confidence/summary and bump `updated_at`.
3. Else → `INSERT`.
4. On `23505` from the insert (race), re-select and update the winner.
5. `DELETE FROM onboarding_citations WHERE draft_id = ?` then re-insert `args.citations` so citations always match the current payload (matches corpus behavior).

### `src/lib/country-onboarding/kpi-seed.server.ts` (lines 59–94)

Same pattern, stage hard-coded to `"kpi_seed"`.

### Recovery for KNA

The existing live `ministry_sector_map` draft (`55893500-…`, created 21:51:18Z) is valid — the second run only failed because the first was never committed. After the fix, the admin can either commit that draft or re-run Stage 5, and the re-run will update the same draft instead of erroring.

No migration required; no other code paths change.

## Verification

- `bunx tsgo --noEmit` clean.
- Manually re-run Stage 5 on KNA in the admin UI; expect the run to end `ready` and the existing live draft to be updated in place (same draft id, new `updated_at`).
- Re-run any earlier stage (e.g. `profile`) on any country without committing first; expect no 23505 error.
