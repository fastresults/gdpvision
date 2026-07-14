## Problem

On `/admin/countries/:code/onboard`, stages that are already committed (e.g. KPI seed with 18/18 processed, Second-brain seed) render **"No data."** and an empty `{}` under "View raw committed data (debug)".

## Root cause

`getOnboardingStatus` in `src/lib/country-onboarding/agents.functions.ts` (line ~230) only returns **uncommitted** drafts:

```ts
.from("onboarding_drafts").select("*").eq("country_code", cc).is("committed_at", null)
```

The onboard page (`countries.$code.onboard.tsx`, line ~949) does `const payload = draft?.payload;` and the committed panel (line ~1245) falls back through `payload ?? draft?.payload ?? summary?.highlights ?? {}`. Once a stage is committed, its draft is filtered out, so `draft` is `undefined`, `summary?.highlights` doesn't exist for stages without a generated summary, and the panel renders `{}` → PrettyJson prints "No data."

The actual committed data lives in the target tables (`country_kpis`, `memory_objects`, etc.) and in the (now hidden) committed draft's `payload`.

## Fix

Return the **latest committed draft per stage** alongside the uncommitted drafts, and use it as the source for the committed panel.

### Backend — `src/lib/country-onboarding/agents.functions.ts`
- In `getOnboardingStatus`, add a parallel query that fetches, per stage, the newest row where `committed_at IS NOT NULL` (single Supabase query ordered by `committed_at desc`, dedup to newest per stage in JS — same shape as existing `dedupedDrafts`).
- Return it as `committedDrafts: Array<{ stage, payload, committed_at, citations }>` (attach citations via the same `onboarding_citations` join already loaded, extending the `draftIds` set).

### Frontend — `src/routes/_authenticated/admin/countries.$code.onboard.tsx`
- Read `committedDrafts` from status (alongside `drafts`).
- In `StageList`, find `committedDraft = committedDrafts.find(d => d.stage === s.key)` and pass it to `StageRow` as a new prop `committedDraft`.
- In `StageRow`, change the committed panel (line ~1245) to prefer `committedDraft?.payload` before falling back to `draft?.payload`:
  ```ts
  const committedPayload = committedDraft?.payload ?? draft?.payload ?? null;
  const committedCitations = committedDraft?.citations ?? citations;
  ```
  Render `<PrettyJson value={committedPayload ?? {}} citations={committedCitations} />` and the raw debug uses the same value.
- Leave the uncommitted draft-review panel untouched (still uses `draft` = uncommitted).

### Out of scope

- No schema changes; `onboarding_drafts.committed_at` already exists and is populated by every commit path.
- No changes to the orchestrator or commit logic.
- No changes to summary generation.

## Verification

1. On AIA `/admin/countries/AIA/onboard`, KPI seed (committed) shows the committed KPI payload in PrettyJson instead of "No data".
2. Second-brain seed (committed) shows the committed payload.
3. Stages with a still-uncommitted draft continue to show the draft-review panel unchanged.
4. Stages that have never been run still show "pending" with no data (unchanged).