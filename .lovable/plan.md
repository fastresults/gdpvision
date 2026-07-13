## Fix: "Re-commit" showing on stages that were never committed

### What actually happened on ATG › KPI seed

- `country_kpis` for ATG = **0 rows** → the stage was never committed.
- Three `kpi_seed` runs all finished in `ready` state (not `committed`) — the agent produced 3 drafts, each holding **18 KPIs** (13/13 required filled). Great drafts, but the admin never pressed Commit.
- The UI still showed **"Re-commit to country_kpis"** in amber — misleading the admin into thinking data was already committed and this was a re-commit action. In reality it should have said the plain green **"Commit to country_kpis"** because nothing was ever committed.

### Root cause in the new code

`hasNewerDraft` in `StageCard` is:

```ts
const hasNewerDraft = !!draft && (!commitAt || new Date(draft.created_at) > new Date(commitAt));
```

When a stage was never committed, `commitAt` is `null`, so `!commitAt` short-circuits to `true` → `hasNewerDraft = true` for every draft — even when the target table has zero rows and the "committed" pill isn't shown. Combined with the branch:

```ts
{(!committed || hasNewerDraft) && (<button className={hasNewerDraft ? amber : emerald}>{hasNewerDraft ? "Re-commit" : ...}</button>)}
```

the button paints amber and labels itself "Re-commit" for uncommitted stages that happen to have a draft.

### Fix

`hasNewerDraft` must additionally require `committed`:

```ts
const hasNewerDraft = committed && !!draft && !!commitAt && new Date(draft.created_at) > new Date(commitAt);
```

Result matrix (unchanged plan, now correct):

| Target rows | Draft? | Draft > lastCommit? | Header |
|---|---|---|---|
| 0 | no | — | disabled "Commit (no draft)" |
| 0 | yes | — | green **"Commit to X"** ← was broken (said "Re-commit") |
| >0 | no | — | green `✓ Committed (N)` pill only |
| >0 | yes | no | green `✓ Committed (N)` pill only (draft is stale/same generation) |
| >0 | yes | yes | green `✓ Committed (N)` pill + amber **"Re-commit to X"** |

### Also: surface why nothing was committed

To prevent the same confusion on other countries, when a draft exists but the stage has never been committed, show a subtle hint under the stage description: *"Draft ready with N item(s) — press Commit to write to `<table>`."* Reuses `draft.payload` size where trivially available (KPI seed: `payload.kpis.length`; ministries: `payload.ministries.length`; etc.), falls back to just "Draft ready" when shape is unknown.

### Files touched

- `src/routes/_authenticated/admin/countries.$code.onboard.tsx` — one-line fix to `hasNewerDraft`, plus the small "Draft ready with N item(s)" hint. No server, no schema, no data migration.

### Not in scope

The KPI agent itself is working correctly (13/13 required filled). The 3 uncommitted drafts on ATG will resolve the moment the admin presses the newly-correct green "Commit to country_kpis" button.
