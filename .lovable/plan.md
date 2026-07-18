# Ask the Ledger — 3-Tier Answer Engine

Today `askTheLedger` retrieves chunks by naive keyword overlap. When no chunk contains the query tokens (e.g. "blue economy" isn't literally in any indexed doc), the model refuses with "no grounded evidence" — even though KPIs, sector dossiers, ministry profiles, and the wider corpus almost always have relevant context, and Perplexity could fill any remaining gap.

## New Tiered Resolver

Every question runs through up to three tiers. The first tier that yields a confident, cited answer wins. Lower tiers are additive context, not replacements — later tiers always see everything earlier tiers pulled.

### Tier 1 — Corpus (grounded citations, highest weight)
- Keep the current retrieval, but upgrade it:
  - Add **embeddings-based semantic search** over `country_source_chunks.content` (Lovable AI `google/gemini-embedding-001`, cosine top-40) alongside the existing keyword filter, then merge + rerank.
  - Backfill embeddings on ingest (new `embedding vector(3072)` column with HNSW halfvec index) and a one-shot backfill script for existing chunks.
  - Semantically expand query tokens (synonyms/sector aliases like "blue economy" → fisheries, marine, ocean, coastal, aquaculture) via a tiny Gemini call before search.
- Weight: chunks & their `[N]` citations rank first in the final prompt.

### Tier 2 — Whole-country context (always included when Tier 1 is thin)
Aggregate the full Second Brain for the country, regardless of query match:
- All `country_kpis` (latest_value, target, trend), `country_sectors` composition + confidence grades.
- All `sector_dossiers.payload` (compact JSON summary — headline metrics, drivers, risks).
- All `ministry_profiles` (mandate, minister, programmes).
- Top `memory_objects` by weight for the country + `REGIONAL`.
- Exposure index + capital flows snapshot.

These become **anchor citations** (`kind: "memory"`) with source_id → dossier/kpi rows so `[N]` markers remain clickable. The model is told: "corpus citations are primary evidence; anchors are canonical country facts you may reason from."

### Tier 3 — Deep research fallback (only if Tiers 1+2 still can't answer)
- The model returns a structured `needs_research: true` flag when confidence would be "low" and no corpus citation supports the claim.
- Server then calls **Perplexity `sonar-reasoning-pro`** (already wired in the onboarding stack) with the question + a country brief.
- Perplexity's answer + its citations are appended as `kind: "web"` citations. A final Gemini pass composes the McKinsey-style answer over the combined evidence.
- Newly discovered high-quality sources are queued into `country_sources` as `pending_review` so the corpus self-heals over time (reuses the existing dedupe / upsert path).

### McKinsey-style output (all tiers)
Structured JSON stays the same shape but adds:
- `situation` (1 sentence framing), `answer` (direct), `so_what` (2–3 bullets of implication), `evidence` (with [N]), `confidence`, `caveats`, `sources_used` (`corpus` | `country_context` | `web_research`).
- Confidence rubric: `high` = ≥2 corpus citations; `medium` = anchors + ≥1 corpus OR strong web with anchors; `low` = web-only or no numeric grounding.

## UX Changes (`AskTheLedger.tsx`)
- Small "Sources used" chip row on each answer: `Corpus · 4` / `Country context · 3` / `Web · 2`.
- When Tier 3 fires, show a subtle "Extended with live web research" note above the answer.
- Loading states: "Searching corpus…" → "Reading country context…" → "Deep research…" so the user knows why it took longer.
- Never return the "no grounded evidence" dead-end again — worst case is a Tier-2 answer flagged `confidence: low` with caveats.

## Technical Section

### Files to change
- `src/lib/ledger.functions.ts` — refactor `askTheLedger` into `tier1Corpus()`, `tier2CountryContext()`, `tier3DeepResearch()`, plus an orchestrator. Add `expandQuery()` and `semanticSearchChunks()` helpers.
- `src/lib/ledger-embeddings.server.ts` (new) — Lovable AI embeddings client + backfill utility.
- `src/lib/ledger-deep-research.server.ts` (new) — Perplexity sonar-reasoning-pro wrapper reusing keys/patterns from `src/lib/country-onboarding/*`.
- `src/components/ledger/AskTheLedger.tsx` — render `sources_used` chips, tier progress, "extended with research" badge.
- New migration:
  - `alter table country_source_chunks add column embedding vector(3072)`.
  - HNSW halfvec index on `(embedding::halfvec(3072)) halfvec_cosine_ops`.
  - `match_country_chunks(country_code, query_embedding, k)` SQL function with `SECURITY INVOKER` (respects RLS).
  - GRANTs preserved for authenticated/service_role.
- Backfill: one-off server function `backfillChunkEmbeddings({ countryCode })` (batched, 96/req).

### Model choices
- Query expansion + final synthesis: `google/gemini-3.5-flash` (fast, JSON-mode).
- Embeddings: `google/gemini-embedding-001` (3072 dims, matches memory of no-duplicates corpus contract).
- Deep research: Perplexity `sonar-reasoning-pro` (existing key), 45s timeout, single call per question.

### Guardrails
- Tier 3 gated by `has_role(authenticated, 'admin')` OR a per-country daily quota (10 web calls/country/day) to control credit spend — configurable in `app_settings`.
- Every web citation must include `url`; drop uncited web claims.
- Preserve existing suppression list, PrettyJson rules, and idempotent source upserts.
- No changes to auth middleware; new endpoint stays under `requireSupabaseAuth`.

### Rollout
1. Ship migration + embeddings backfill (safe: additive column).
2. Ship refactored `askTheLedger` with Tiers 1+2 (already a strict upgrade — no more dead-ends for Antigua's "blue economy" question).
3. Enable Tier 3 behind a feature flag, verify credit usage, then remove flag.
