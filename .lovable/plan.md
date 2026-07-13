# 3-Level Fallback Chain for Onboarding Agents

Goal: no agent stage ever throws "no data" to the UI. Every model call cascades through three tiers, retries within each tier, and finally synthesizes a best-effort answer from context already in the DB.

## The chain (applied to every `callSonar` + `parseSonarJson` site)

**Tier 1 — Perplexity (grounded search)**
1. `callSonar` with domain allowlist + country TLD.
2. On empty/unparseable → retry once with `noDomainFilter: true` (already partly in place).
3. On empty again → retry once with a broader model (`sonar` → `sonar-pro`) and `recency` widened.

**Tier 2 — Gemini via Lovable AI Gateway (`google/gemini-2.5-pro`)**
- New helper `callGeminiJson({ system, user, schema, context })` in `src/lib/country-onboarding/gemini.server.ts`.
- Uses `LOVABLE_API_KEY` + AI SDK `generateText` with `Output.object` (schema-free prompt fallback if schema validation fails — per `ai-sdk-agent-patterns` guard).
- Fed the Perplexity partial content (if any) + country context so it can complete/repair rather than start blind.
- Retries: 1 primary + 1 with `google/gemini-2.5-flash` on failure.

**Tier 3 — Contextual inference (never throws)**
- New helper `inferFromContext(stage, country, committedData)` in `src/lib/country-onboarding/inference.server.ts`.
- Reads what's already committed for the country (region, income group, prior stages: ministries, sectors, sources) plus a small per-stage seed dataset (e.g. standard OECS ministry list, standard SNA sectors, standard SDG KPIs).
- Returns a valid but marked-provisional payload: every row gets `{ provisional: true, inference_source: "context|seed", confidence: "low" }`.
- Citations set to `[]`; the commit path already tolerates empty citations.

## Wrapper: `runWithFallbacks`

New `src/lib/country-onboarding/fallback.server.ts` exports:

```ts
runWithFallbacks<T>({
  stage, country, committed,
  perplexity: () => Promise<T | null>,   // returns null on empty
  gemini:     (partial) => Promise<T | null>,
  infer:      () => T,                    // never throws
  validate:   (v: T) => boolean,          // e.g. rows.length > 0
}): Promise<{ data: T; tier: "perplexity" | "gemini" | "inference"; notes: string[] }>
```

Every agent handler in `agents.functions.ts` is refactored to build the three callbacks and delegate. The `throw new Error("Perplexity returned no ...")` lines are removed — the wrapper always returns data plus a `tier` label.

## UI surfacing

- `agent_runs` gets two new columns: `result_tier` (`perplexity|gemini|inference`) and `fallback_notes` (jsonb array). Migration + GRANTs.
- Onboarding page shows a small badge next to each committed stage:
  - green "Perplexity" (default),
  - amber "Gemini fallback",
  - grey "Inferred — review".
- Inferred rows render with an amber left border in `<PrettyJson>` when `provisional: true`.

## Reliability additions

- `callSonar` and `callGeminiJson` wrapped with `pRetry`-style: 2 attempts each, exponential backoff (500ms, 1500ms), only on 429/5xx/network.
- Bulk `runAllPending` loop already catches per-stage errors (previous fix). With this change, the catch path should be virtually unreachable — errors now only surface for true framework/DB failures.

## Technical notes

- Gemini schema calls MUST omit `.min/.max/length` per `ai-sdk-agent-patterns`; constraints go in the prompt, validated in code.
- `google/gemini-2.5-pro` handles the multimodal/long-context prompts; `flash` is the cheap retry.
- Inference seeds live in `src/lib/country-onboarding/seeds/` (one file per stage: `ministries.seed.ts`, `sectors.seed.ts`, `kpis.seed.ts`, …) — keeps prompts and default lists reviewable.
- No changes to Supabase RLS/policies; new columns are admin-only via existing `agent_runs` policies.

## Out of scope

- Changing existing agent prompts beyond adding the "you may complete a partial answer" instruction to the Gemini tier.
- Auto-recommitting inferred data — admin still clicks "Commit" to promote drafts.
- Rewriting the corpus_ingest pipeline (its Perplexity calls stay as-is; only the six structured-JSON agents get the three-tier chain).
