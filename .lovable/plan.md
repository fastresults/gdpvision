
# Research Quality Audit — Country Onboarding Agents

I reviewed `agents.functions.ts`, `perplexity.server.ts`, `gemini.server.ts`, `fallback.server.ts`, `seeds.server.ts`. The fallback plumbing works, but the **research itself is undercooked**. Here's what I found and how to fix it.

## Findings — why we're not getting the data

### 1. Prompts are one-shot and context-blind
Every agent sends a single ~2-sentence user prompt asking for everything at once. Example for Ministries:
> "List the current cabinet ministries of {country} as of 2026, with name, minister, mandate."

No breadth. No decomposition. No pointer to the actual gov portal. No prior context (region, OECS/CARICOM membership, population, government type) is forwarded from earlier stages. The model has to re-derive the country's basics every call.

### 2. Domain allowlist is actively *hurting* recall
`OFFICIAL_DOMAINS` is a fixed 14-item list (worldbank, imf, un, wikipedia…). The `callSonar` API accepts a `countryTld` param — **no agent ever passes it**. So `.gov.ag`, `.gov.lc`, `oecs.org`, `caricom.org` national portals are excluded by default. Perplexity returns "" and the code retries without the filter, but that's a **wasted round-trip on every call**.

### 3. Wrong model for the job
- `sonar-pro` used for cabinet composition — needs `sonar-deep-research` or multi-query decomposition.
- `sonar-reasoning-pro` used for sector composition, but no chain-of-thought is requested.
- No agent uses Perplexity's **Search API** (`/search`) to first *find* the gov portal, then Sonar it.

### 4. `recency: "year"` is too tight for slow-moving sources
Government "About Us" pages haven't been re-crawled recently. National accounts publish annually. Filter should be `"month"` for cabinet changes, unset for structural data.

### 5. Structured-output schema is fighting the model
Perplexity `json_schema` with `additionalProperties: false` + long `required` arrays → the model often returns `""` rather than partial JSON, because it can't satisfy every field. We treat empty as failure and cascade to Gemini, losing whatever partial data Perplexity *did* find.

### 6. Gemini tier is blind and ungrounded
`callGeminiJson` sends a stripped 1-sentence prompt with no web grounding. Gemini 2.5 Pro via Lovable Gateway can't browse. It just guesses from training data — likely stale on cabinet composition. We're not using Gemini's actual strength (long-context repair of Perplexity's raw dump).

### 7. Validators are trivially permissive
`validate: v => !!v?.ministries?.length` accepts **one** ministry. A small state should have ≥8. No sanity floors, so a single-item hallucination passes as "success".

### 8. Seeds are country-agnostic
`seedMinistries(country.name)` returns a fixed OECS-shaped list regardless of whether the country is OECS, CARICOM-only, or non-Caribbean. Tier-3 inference doesn't read the country's `region`, `income_group`, or already-committed GDP.

### 9. No cross-stage context reuse
Each stage runs isolated. Ministry-sector mapping doesn't get the sector-composition weights already committed. Ministry deep-dive re-researches basics the profile stage already found. Wastes tokens, produces inconsistent facts.

### 10. Citations are collected but not re-used
When Perplexity returns citations but empty content, we throw the citations away. A better loop: fetch the top 2 citations' text and re-prompt Gemini with them as grounding.

---

## The Fix — Research Depth Refactor

### A. Country context object (foundation)
New `buildCountryContext(admin, code)` in `country-context.server.ts` — loads country row + all committed stage data + regional metadata (OECS/CARICOM/SIDS/income group/official gov URL). Passed into **every** agent prompt as a stable JSON block:

```
COUNTRY CONTEXT
- Name / ISO2 / ISO3 / official government portal URL
- Region / sub-region / small-state groupings (OECS, CARICOM, SIDS)
- Currency, fiscal year, population, GDP (if committed)
- Committed prior stages (profile, GDP, sectors, ministries)
```

### B. Decompose Perplexity calls per stage
Replace 1 monolithic call with a **2-step research pattern** per agent:

1. **Discovery pass** (`sonar` cheap): "Find the official URL of the {country} {topic} page. Return top 3 candidate URLs with a 1-line reason." — no schema, plain text.
2. **Extraction pass** (`sonar-pro` or `sonar-deep-research`): Feed those URLs *into* `search_domain_filter` along with the country TLD, then ask for the structured payload.

For ministries specifically, add a **3rd pass** to fill missing ministers by name (targeted, 1 minister per query if bulk fails).

### C. Fix `callSonar` defaults
- Always pass `countryTld` from the context (e.g. `gov.ag`, `gov.lc`).
- Add per-stage domain overrides (e.g. ministries → country TLD + `oecs.org` + `caricom.org` only, not IMF).
- Drop `additionalProperties: false` from schemas; make most fields optional so partial JSON succeeds.
- Return partial content on empty rather than "" — parser already handles fragments.

### D. Gemini as a *repair* tier, not a re-research tier
Rewrite `callGeminiJson` calls to always pass:
- The full Perplexity partial content (raw text, all attempts concatenated).
- The country context block.
- Fetched text from top 2-3 citation URLs (new `fetchCitationText` helper using existing `fetch_website` pattern).
- Instruction: "Extract/repair the JSON from the source material below. Do not invent facts not present in the sources."

Then Gemini becomes what it's good at: structured extraction from long messy context, not blind recall.

### E. Real validators
Per stage, minimum shape enforcement:
- Ministries: `≥6` items, each with non-empty `name` + `mandate`, `slug` kebab-case.
- Sector composition: rows sum 90-110%, ≥5 non-zero rows.
- GDP: value > 0, year within last 5 years.
- Profile: currency matches ISO 4217, head_of_government non-null.

Failure → advance to next tier, never accept junk.

### F. Context-aware seeds (Tier 3)
`seedMinistries` reads `country.region`, `country.membership_tier`, GDP tier → picks OECS-standard vs CARICOM-standard vs generic-small-state template. Same for sectors (tourism-heavy vs commodity vs services).

### G. Model-stack telemetry surfaced
`agent_runs.model_stack` already stores tier notes. Add UI badge showing which tier + how many Perplexity attempts + which citations were used. Admin can see *why* a stage came back weak.

### H. Cross-stage reuse
- Ministry-sector map receives the committed sector composition as guidance ("these sector codes have the following weights — distribute ministerial ownership consistently").
- Ministry deep-dive receives the profile + ministry list rather than re-researching.

---

## What I'd change, in files

- `src/lib/country-onboarding/perplexity.server.ts` — fix domain filter defaults, always pass TLD, relax schema strictness, add `discoverOfficialUrls(country, topic)` helper, add `fetchCitationText(url)` helper.
- `src/lib/country-onboarding/country-context.server.ts` — **new**. Loads + shapes the shared context block.
- `src/lib/country-onboarding/gemini.server.ts` — accept full partial + citation text + context; drop the "stripped prompt" pattern.
- `src/lib/country-onboarding/seeds.server.ts` — context-aware seed selection.
- `src/lib/country-onboarding/agents.functions.ts` — each `runXxxAgent` becomes: build context → discovery pass → extraction pass → validate (real thresholds) → fallback with context+citations+partial → seed.
- `src/lib/country-onboarding/fallback.server.ts` — pipe `context` + `partialAccumulated` + `citationText` through to Gemini.
- Route `countries.$code.onboard.tsx` — surface tier + attempt count per stage.

## Out of scope
- Adding a new model provider.
- Changing the commit path or DB schema (beyond reading existing columns).
- Rewriting `corpus_ingest` / `kpi-inference` (separate pipelines).

---

**Question before I build:** should I do the **full refactor above** (touches 6 files, ~1-2 hours of build) or start with just the **top-3 highest-leverage wins** (country TLD + prompt decomposition + real validators — ~30 min) and see if research quality jumps enough on its own?
