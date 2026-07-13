## Current behavior

Today each of the 11 onboarding stages costs **two** AI calls:

1. **Agent run** — produces the structured draft (profile fields, GDP series, sectors list, ministries, etc.).
2. **Summary generation** — a second call to `generateSummaryForStage` fires on commit (`markDraftCommitted` in `agents.functions.ts` and `corpus.functions.ts`) and writes `onboarding_summaries`.

So yes — right now the executive summary is a redundant second model call.

## Goal

The agent should return the executive summary (prose + highlights) in the **same** response that produces the draft. Commit then just copies that summary into `onboarding_summaries` — no extra AI call, no extra latency, no extra spend. The "Regenerate summary" button remains as the only path that ever spends a second call.

## Plan

### 1. Extend every agent's output schema

For each stage's system/user prompt in `agents.functions.ts` (and the Firecrawl/Perplexity paths in `corpus.functions.ts` that also produce drafts), add two required fields alongside the existing payload:

- `summary_md`: 2–4 sentence executive briefing, cabinet-grade voice (reuse the per-stage tone rules already in `summaries.functions.ts`).
- `highlights`: array of `{ label, value }` (2–4 items), same shape as today.

The per-stage voice guidance currently sitting in `summaries.functions.ts` (profile → country identity, GDP → nominal USD with WB/IMF cross-check, sectors → top 3 by share, ministries → shape of cabinet, etc.) gets moved into a shared `STAGE_SUMMARY_GUIDANCE` map and appended to each agent's system prompt. Single source of truth.

### 2. Persist the summary on the draft

Store `summary_md` + `highlights` on `onboarding_drafts` so review/edit can adjust them before commit. Two options:

- **Preferred:** add `summary_md text` and `summary_highlights jsonb` columns to `onboarding_drafts` (small migration, keeps types clean).
- Alternative if we want to avoid a migration: nest them inside the existing `payload` jsonb under `payload._summary`. Cheaper but muddies the payload shape.

Recommend the migration.

### 3. Commit becomes a copy, not a generate

Rewrite `markDraftCommitted` (both copies — factor to one shared helper in `./_shared.ts`) so that instead of calling `generateSummaryForStage`, it:

- Reads `summary_md` / `summary_highlights` off the committed draft.
- Upserts them directly into `onboarding_summaries` with `model` = the agent's model and `source_run_id` = the run id.
- No AI call.

If the draft has no summary (legacy drafts committed before this change), fall back to the current on-commit generation once so nothing regresses.

### 4. Keep manual regenerate as the only extra-call path

`generateStageSummary` server fn stays — it's what the "Regenerate" button in the accordion calls. That's the only place a second model call ever happens, and only when a human asks for it.

### 5. UI

Minor: in the review step of each accordion, show the agent-produced `summary_md` above the raw draft so the admin can eyeball/edit it before committing. No layout overhaul.

## Files touched

- `supabase/migrations/*` — add `summary_md`, `summary_highlights` to `onboarding_drafts`.
- `src/lib/country-onboarding/agents.functions.ts` — extend prompts/schemas for the agent-based stages; replace `markDraftCommitted` summary hook with a copy.
- `src/lib/country-onboarding/corpus.functions.ts` — same treatment for the corpus/Firecrawl-driven stages; share the commit helper.
- `src/lib/country-onboarding/summaries.functions.ts` — export shared `STAGE_SUMMARY_GUIDANCE`; keep `generateStageSummary` for manual regenerate + legacy fallback.
- `src/routes/_authenticated/admin/countries.$code.onboard.tsx` — surface `summary_md` in the review block before commit; no behavior change post-commit.

## Out of scope

- Changing which model the agents use.
- Reworking the accordion, target tables, or citations flow.
- Backfilling summaries for already-committed stages (they already have summaries from the current on-commit path).
