# Super Admin Console — AI-First Country Onboarding

Goal: give the super admin one place to onboard a country end-to-end by running deep-research agents that produce accurate, cited, editable seed data for GDP, sector composition, ministries, ministry↔sector mapping, and starter KPIs. Nothing is guessed — every value has a source URL and confidence. The admin reviews and approves; nothing is written to public tables until they click "commit."

Patterned on Sovereign Pulse's ingest pipeline (`planQueries` → search → scrape → classify → chunk → propose), but redesigned around **countries** rather than sectors.

---

## 1. Dashboard shell: `/admin` (super admin only)

Sidebar sections:

```text
Overview                  ← counts: countries seeded, pending onboardings, credit usage
Countries                 ← the onboarding queue (this plan)
Country admins            ← promote / demote (already exists in current plan)
Access requests           ← already exists
Research runs             ← audit of every AI call, cost, citations
Sources & citations       ← every URL the agents ever cited (reusable across countries)
Settings                  ← model routing, provider keys, budget caps
```

The rest of this plan focuses on **Countries**.

---

## 2. Country onboarding page: `/admin/countries/$code/onboard`

A five-stage wizard. Each stage is one or more agent runs whose output the super admin reviews, edits inline, then commits. The stage is only marked done once the commit succeeds.

```text
Stage 1 — Country profile         (identity, currency, fiscal year, population, key macro)
Stage 2 — GDP baseline            (nominal GDP USD, year, source)
Stage 3 — Sector composition      (share_pct per sector, sums ≈ 100%, confidence per row)
Stage 4 — Ministries              (canonical list with mandate + minister where known)
Stage 5 — Ministry ↔ sector map   (weights per ministry across the 11 sectors)
                                  → unlocks the KPI seeder (Stage 6, follow-up plan)
```

Every stage shows:

- **Agent run panel**: live status of the deep-research call (queued → planning → searching → scraping → drafting → done), tokens used, and the plan the agent produced.
- **Draft table**: proposed rows with citations, editable inline. Rows with no citation are flagged red. Confidence badge per row (`high` / `medium` / `low`).
- **Commit bar**: "Commit N rows to <table>" writes via a server function that requires `admin` and stamps `audit_log`.

The admin can re-run any stage; each run is versioned in `research_briefs` / `harvest_runs`, so a later run does not overwrite prior citations — it produces a new draft to compare.

---

## 3. The agent layer — AI-first, multi-model

Two research surfaces, chosen per stage by the router:

- **Perplexity Sonar** for questions where a synthesized, cited answer is what we want ("What are the ministries of Haiti as of 2026 with the current minister?"). Uses `sonar` for cheap fact lookups, `sonar-pro` for structured cross-source synthesis, `sonar-deep-research` for the exhaustive first-run per country. `search_domain_filter` scoped to `.gov`, multilaterals (IMF, World Bank, ECCB, CDB, OECS, CARICOM), and national statistics offices.
- **Lovable AI Gateway** (`openai/gpt-5.5` for planner + validator, `google/gemini-3-flash-preview` for high-volume classification and structured extraction) via the existing `ai-gateway.server.ts` helper we already have from the auth work. Perplexity's raw output is normalized into our schema by a Lovable-AI structured-extraction pass.

Every model call runs server-side inside a `createServerFn` (never from the browser). No provider keys touch the client. All calls are wrapped in `withRun(country_code, stage, purpose)` which logs to `harvest_runs` (already in the schema) and attaches every URL the model cited to `sources` + `citations` (also already in the schema).

### Agents

Each is a `createServerFn` in `src/lib/onboarding/agents/`. They compose the same primitives (plan → search → extract → validate) but with different prompts and target schemas:

1. `profileAgent(country_code)` — currency, fiscal year, population, HDI, main exports. Cheap; Perplexity `sonar`.
2. `gdpAgent(country_code)` — nominal GDP USD for most recent year + reference year. Perplexity `sonar-pro`, cross-checked against World Bank / IMF WEO. Rejects any answer without at least 2 official sources.
3. `sectorCompositionAgent(country_code)` — proposes `share_pct` for each of the 11 sectors we already have in `sectors`. Uses Perplexity `sonar-deep-research` for the first run (this is the expensive one, ~ one call per country). Validator agent (`openai/gpt-5.5`) checks totals ≈ 100 % and clamps or flags rows. Writes drafts to a staging table.
4. `ministriesAgent(country_code)` — canonical ministry list with current minister and mandate. Perplexity `sonar-pro` scoped to `<country>.gov` and OECS/CARICOM directories. Deduplicates against `ministries` already in DB.
5. `ministrySectorMapAgent(country_code)` — for each ministry × sector, propose a weight in `[0,1]` with a rationale. Two-pass: `gemini-3-flash` for the first pass, `openai/gpt-5.5` validator to enforce that per-ministry weights sum ≈ 1.

A tiny **router** (`selectModel(purpose, budget)`) picks the model per call and enforces per-country and per-day spend caps read from `app_settings`.

---

## 4. Staging + commit model

New tables (all under `public`, all with the 4-step recipe: CREATE → GRANT → ENABLE RLS → POLICY):

- `onboarding_runs(id, country_code, stage, status, started_by, started_at, finished_at, model_stack jsonb, cost_cents, error)`
- `onboarding_drafts(id, run_id, country_code, stage, target_table, payload jsonb, confidence, needs_review bool)`
- `onboarding_citations(id, draft_id, url, domain, title, quote, published_at)`

RLS: read/write only for `admin` (super admin). Country admins do not see other countries' drafts. Commits move data from `onboarding_drafts` into the real tables (`countries`, `country_sectors`, `ministries`, `ministry_sectors`) inside a single transactional server function, deleting the draft rows on success and writing an `audit_log` entry.

The existing `sources` and `citations` tables get one new row per unique URL the agents cite so any KPI created later can point back to the same source.

---

## 5. Secrets & connectors

- `PERPLEXITY_API_KEY` — request via `add_secret` once the user approves this plan; used only in server functions.
- `LOVABLE_API_KEY` — already provisioned.
- (Optional, later) `FIRECRAWL_API_KEY` if we need to scrape non-Perplexity sources for extraction. Not required for stages 1–5.

All calls surface provider errors (rate limit, credits, invalid scope) directly in the UI with the exact provider message — no silent fallback that could ship low-confidence data as "verified."

---

## 6. UX rules (mandatory)

- Agent output is **never** written straight to public tables. Every stage has a review step.
- Every row that lands in `country_sectors`, `ministries`, etc. carries at least one citation URL. Rows without a citation cannot be committed.
- The wizard is resumable: closing the tab mid-run leaves the run in `onboarding_runs`; reopening the country restores the draft.
- The `/admin/countries` list shows per-country progress bars (0/5 → 5/5 stages) so the super admin can prioritize.
- All AI runs are visible in "Research runs" with model, cost, prompt, plan, and cited URLs — this is the audit trail.

---

## Technical notes

- Model catalog: chat/text default `openai/gpt-5.5`; classifier default `google/gemini-3-flash-preview`; Perplexity models chosen per agent as listed above.
- Perplexity request shape follows the `perplexity` knowledge (`search_domain_filter`, `search_recency_filter`, `response_format: json_schema` for the extractor pass).
- Server boundary: every agent is a `createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])` and asserts `has_role(auth.uid(),'admin')` before doing anything.
- Zero client-side model calls; the wizard uses `useMutation` + `useServerFn` to drive the pipeline and `useQuery` to poll `onboarding_runs`.
- Migrations follow the strict order: CREATE TABLE → GRANT → ENABLE RLS → POLICY. `country_admin` role from the previous plan already exists; we do not touch it here.
- No changes to `src/integrations/supabase/*` generated files.

## Order of execution once approved

1. Migration: `onboarding_runs`, `onboarding_drafts`, `onboarding_citations` + RLS + grants.
2. `add_secret` request for `PERPLEXITY_API_KEY`.
3. `src/lib/onboarding/router.server.ts` (model + budget router) and `src/lib/onboarding/perplexity.server.ts` (thin Sonar client with domain/recency filters).
4. Five agents in `src/lib/onboarding/agents/*.functions.ts`.
5. Commit server functions (`commitProfile`, `commitGdp`, `commitSectorComposition`, `commitMinistries`, `commitMinistrySectorMap`).
6. UI: `/admin` shell, `/admin/countries` queue, `/admin/countries/$code/onboard` wizard, "Research runs" audit page.
7. Backfill: run the wizard once against Saint Lucia end-to-end as the canonical smoke test before opening it up to the other 21 countries.
