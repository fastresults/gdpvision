## Problem

On KNA (and other new countries) the 10 committed ministries have `minister = null` and `minister_profile = null`. Stage 9 (Ministry Deep-Dive) already asks Perplexity for the officeholder, but:

1. It runs one-shot per ministry with no verification loop — if Perplexity returns `null` (its instruction says "return null when unverified"), we accept it and move on.
2. It never cross-checks the existing corpus (`country_source_chunks`, `memory_objects`, committed `ministry_profiles`) before going to the open web, and never writes back what it learns.
3. Stage 5 (Ministry × Sector map) has no notion of the officeholder or portfolio title at all — the M×S weights are attributed to a ministry slug only, so downstream views can't say "Sector X is owned by Minister Y (Title Z)".

We need a research loop that (a) queries the corpus first, (b) fans out to the open web with retries and source diversity, (c) reconciles the answers, and (d) is wired into stages 5 and 9 so the committed data always carries a verified Minister **name + title + source citation**.

## Plan

### 1. New shared researcher: `src/lib/country-onboarding/minister-research.server.ts`

Single entry point: `resolveMinister({ country, ministry, ctx }) → { name, title, party, appointed_at, portrait_url, citations[], confidence, source_tier }`.

Loop, in order, stopping as soon as `confidence ≥ 'medium'` with ≥2 independent citations:

1. **Corpus pass** — search `country_source_chunks` + `memory_objects` for the ministry name / slug tokens; extract candidate `(name, title)` pairs via a small structured-output Gemini call. Free, deterministic.
2. **Targeted open-web pass** — Perplexity `sonar-reasoning-pro` scoped to the country's authorized domains (official gov portal, parliament, gazette). Structured schema forces `name`, `title`, `appointed_at`, `source_url`. `noDomainFilter=false`.
3. **Wide open-web pass** — same schema, `noDomainFilter=true`, Wikipedia + press release friendly. Only runs if pass 2 returned null or a single unverified source.
4. **Cross-check pass** — a second Perplexity call with a different framing ("Who is currently the Minister of X in country Y? Cite the primary source.") whose answer must **agree on the surname** with the pass-2/3 answer. Disagreement drops confidence to `low` and surfaces both candidates in the draft for human review.

Each pass writes its outcome (hit / empty / disagreement) to `corpus_fetch_attempts` via the existing `recordCorpusReadOutcome` audit path so we can see the loop in the ledger-QA hooks.

Guardrails re-used from existing code: `callSonar`, `parseSonarJson`, `SonarCitation`, `runWithFallbacks`, `assertAdmin`, `MinisterProfileSchema` (extracted from `corpus.functions.ts` into the new module and re-exported for the deep-dive to keep one source of truth).

### 2. Stage 9 rewrite — `runMinistryDeepDiveAgent`

Replace the inline single-call `for (const m of ministries)` block with `await resolveMinister(...)` per ministry, then a second Perplexity call for the mandate + programmes (unchanged schema, minus the minister fields). Merge the two into the existing `ministry_profiles` draft payload.

Acceptance gate (new): draft is only `confidence: 'medium'`+ if ≥70% of ministries have a resolved minister name AND every resolved name carries ≥1 citation. Otherwise the run finishes as `ready` with `confidence: 'low'` and the UI shows the per-row "unverified" badge (already supported by `MemoryDraftReview`).

Commit path unchanged — still upserts into `ministry_profiles` — but now with real names/titles.

### 3. Stage 5 augmentation — `runMinistrySectorMapAgent`

Before the mapping call, read the already-committed `ministry_profiles` for the country. Inject `minister` + `title` into the ministry list passed to Perplexity so the mapping rationale can name the officeholder, and add two optional columns to each mapping row: `minister_name`, `minister_title` (denormalized, purely for display). Schema, validator, and commit RPC (`replace_ministry_sectors`) untouched — the extra fields go into a new `payload.minister_index` sidecar map that the M×S review UI reads. No DB migration needed; the sidecar lives inside `onboarding_drafts.payload`.

If Stage 9 hasn't run yet, Stage 5 now emits a soft warning in the draft summary ("Minister names unresolved — run Stage 9 first for attributed weights") instead of silently omitting them.

### 4. Orchestrator wiring

In `orchestrator.functions.ts`, when the sequential runner reaches `ministry_sector_map` and detects zero rows in `ministry_profiles` for the country, it schedules `ministry_deep_dive` first, then re-queues `ministry_sector_map`. This matches the "existing workflow logic" the user asked for — no new stage, just a dependency edge.

### 5. UI

`countries.$code.onboard.tsx` Stage 9 review card: show a compact table `Ministry | Minister | Title | Citations` with the same click-to-cite behavior already used in `sector_dossiers`. No new components — reuse `MemoryDraftReview` and `<PrettyJson citations=…>` per the global JSON-rendering rule.

## Technical details

- New file: `src/lib/country-onboarding/minister-research.server.ts` (~200 LOC). Exports `resolveMinister`, `MinisterProfileSchema`.
- Edits: `corpus.functions.ts` (stage 9 handler swaps to `resolveMinister`, deletes local schema copy), `agents.functions.ts` (stage 5 injects minister index + reads `ministry_profiles`), `orchestrator.functions.ts` (dependency edge).
- No DB migration. `ministry_profiles.minister_profile` jsonb already carries `title`; we just start populating it consistently.
- Model choice: corpus extraction → `google/gemini-3.1-flash-lite` (cheap, structured). Open-web → existing `sonar-reasoning-pro`. Cross-check → `sonar-pro`.
- Loop cap: max 4 Perplexity calls per ministry (pass 2, pass 3, cross-check, one retry on 429). Backoff already handled by `callSonar`.
- All new AI calls go through the shared `createLovableAiGatewayProvider` helper; `LOVABLE_API_KEY` is read inside the handler.
- Idempotent: re-running Stage 9 on KNA will overwrite `ministry_profiles` via existing upsert on `(country_code, ministry_slug)`.

## Verification

1. Run Stage 9 on KNA → expect ≥8/10 ministries with `minister` populated and ≥1 citation each.
2. Re-run Stage 5 on KNA → mapping rows carry `minister_name` / `minister_title`; review card shows the attribution table.
3. `bunx tsgo --noEmit` clean.
4. `corpus_fetch_attempts` shows one row per pass per ministry, so the loop is auditable end-to-end.
