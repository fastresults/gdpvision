
## Why Step 3 is empty

`runScenarioEngine` reads `public.levers` filtered by `country_code`. Today only LCA has rows (2 levers: `cbi-inflows`, `stayover-arrivals`). Every other country — including ATG — returns `[]`, so `leverDefs=[]`, so Step 3, the playbooks, and the fan chart all have nothing to move. There is no seeding path and no AI fallback; levers were expected to be hand-authored during onboarding and never were for the other 21 countries.

The fix is not to hand-write 22 lever packs. It's to let the second brain propose them.

## What "intelligence" we already have but aren't using

Per country we already store: `country_sectors` (GDP mix + shares), `country_kpis` (targets, direction, unit), `ministry_profiles` (mandate + minister), `ministry_sectors` (which ministry owns what), `capital_flow_nodes` (inflows/outflows with GDP caps), `exposure_index`, `sector_dossiers` (risks, opportunities, citations), and P1/P2 `intake_items` (live narrative signals). That is exactly the context needed to propose credible, bounded policy levers with a response function and a source trail — the same shape Stage 12 already uses for capital flows.

## Plan

### 1. AI Lever Synthesis (server function)
New `src/lib/scenarios/synthesize-levers.functions.ts` — `synthesizeLevers({ countryCode })`, `requireSupabaseAuth`, admin-only.

- Assemble a country context bundle: top 8 sectors by share, KPI targets, ministry→sector mandates, top capital flows, exposure index, top 5 P1/P2 signals, sector dossier risks/opportunities.
- Call `google/gemini-3.5-flash` via `createLovableAiGatewayProvider`, structured `Output.object`. Ask for 8–14 levers as:
  `{ slug, name, sector_code, unit, bounds:{min,max,default,step}, response_fn_ref, rationale, citations:[{label,ref}] }`.
- Constrain `sector_code` to `CANONICAL_SECTORS.slug` and `response_fn_ref` to the known set (`v1_macro.linear_gdp`, `v1_macro.exposure_delta`, plus 1–2 new registered fns if needed) — reject-and-retry on invalid values (same pattern as `commitMinistrySectorMap`).
- Bounds sanity clamp: `min ≤ default ≤ max`, `step > 0`, `default` within one std-dev of sector share where applicable.
- Persist a **draft** to a new `lever_drafts` table (country_code, payload jsonb, citations jsonb, status `draft|committed|rejected`, created_by, created_at). Nothing lands in `public.levers` until an admin commits.

### 2. Commit / edit path
- `commitLeverDraft({ draftId, edits })` upserts into `public.levers` on `(country_code, slug)`, snapshots citations into a new `lever_citations` jsonb column (mirrors `sector_dossiers.citations` pattern), sets `methodology_ref` to the draft id.
- Idempotent: re-running synthesis for a country replaces the open draft, never duplicates committed rows.

### 3. Step 3 UI — the empty-state fix
In `src/routes/_authenticated/admin/countries.$code.scenarios.new.tsx` Step 3 body, when `init.leverDefs.length === 0`:

- Replace the silent "Show all 0 levers" with a McKinsey-style empty state card:
  - Headline: "No levers configured for {Country}."
  - Sub: "Generate a starting set from the second brain — sectors, ministries, KPIs, capital flows and live signals."
  - Primary button: **Generate levers with AI** → calls `synthesizeLevers`, opens a review drawer.
- Review drawer (`LeverDraftReview.tsx`): each proposed lever shows name, sector chip, bounds slider preview, `ExplainHover` with rationale + `<CitedText>` citations, and inline edit (name / bounds / sector). Bulk actions: Accept all, Reject, Regenerate with focus prompt (reuse `AiPlaySuggestions` textarea pattern).
- On commit → invalidate `["engine-init", code]` → engine re-runs → Step 3 fills with `LeverRow` cards and Step 2 playbooks (Tourism surge, CBI wind-down, etc.) start matching real slugs/sectors.

### 4. Feedback into playbooks
`PLAYBOOKS` presets match by `sector_code` and slug substrings — once levers exist, the existing presets and the AI play suggester (`suggest-playbooks.functions.ts`) both light up for free. No changes needed there.

### 5. Backfill entry point (optional, separate action)
Add a one-shot admin action on the Countries Queue row: "Synthesize levers" — same server function, so all 21 empty countries can be seeded on demand without touching onboarding stages.

## Technical notes

- Tables: `CREATE TABLE public.lever_drafts (...)` + GRANTs (`authenticated` select/insert/update, `service_role` all); `ALTER TABLE public.levers ADD COLUMN citations jsonb`.
- RLS: `has_country_access(country_code)` reuse for both.
- AI call reads `process.env.LOVABLE_API_KEY` inside `.handler()`.
- No changes to `runScenarioEngine`, `v1_macro`, or Step 2 composition logic — this is pure data supply.
- Response-fn allowlist enforced server-side; unknown refs are dropped with a `needs_review` marker on the draft.

## Out of scope
- New response functions beyond the existing two (can be added in a follow-up once we see what the AI proposes across countries).
- Auto-committing without human review — drafts always require an admin click.
