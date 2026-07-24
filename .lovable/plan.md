
## Goal

Add a **separate, admin-triggered routine** that runs across all 22 countries and, for each one, performs deep AI + open-web research to capture:

1. The full set of **political parties** currently active in the country.
2. A **flag on which party (or coalition) is in power**.
3. The **ruling party's manifesto** (latest election platform / programme of government), ingested into the country's Second Brain corpus.

It reuses the proven minister-backfill pattern (persistent job rows, per-country child runs, browser-driven retry loop, admin gating) so it is idempotent, resumable, and never blocks the request thread.

## User-facing behaviour

- New admin card on `/admin/countries` next to the existing "Backfill ministers" control: **"Backfill political parties & manifestos"** with Start / Resume / View progress actions.
- Progress rail shows attempted / succeeded / failed per country, plus a live counter of parties captured and manifestos ingested.
- Per-country page (`/admin/countries/$code/data`) gets a **Parties** panel: list of parties (name, abbreviation, leader, ideology, seats, ruling flag) and a **Manifesto** card linking to the corpus source + chunks.

## Data model (one migration)

New public tables — same GRANT + RLS shape as `ministry_profiles`:

- `country_parties`
  - `id uuid pk`, `country_code text`, `name text`, `abbreviation text`, `leader_name text`, `leader_role text`, `ideology text`, `founded_year int`, `seats_current int`, `seats_total int`, `vote_share_pct numeric`, `is_ruling boolean default false`, `coalition_role text` (`lead` | `partner` | `opposition` | `minor`), `last_election_date date`, `source_urls jsonb`, `confidence_grade char(1)`, `visibility text default 'public'`, `owner_country_code text`, `uploaded_by uuid`, `updated_at`, `created_at`
  - Unique `(country_code, lower(name))`; partial unique on `(country_code) where is_ruling and coalition_role = 'lead'` to guarantee exactly one lead ruling party.
- `country_manifestos`
  - `id uuid pk`, `country_code text`, `party_id uuid fk`, `election_cycle text` (e.g. `2024`), `title text`, `summary text`, `themes jsonb`, `pledges jsonb` (array of `{theme, pledge, sector_code?, kpi_hint?}`), `source_url text`, `source_document_id uuid fk country_source_documents`, `citations jsonb`, `confidence_grade char(1)`, `visibility text default 'public'`, timestamps.
  - Unique `(country_code, party_id, election_cycle)`.
- `party_backfill_runs` + `party_backfill_country_runs` — mirror the two minister-backfill tables (status, counters, error, heartbeat_at).

RLS: admins full access; country members read where `visibility = 'public'` or `has_country_access(auth.uid(), country_code)`. Same private-ownership trigger as other corpus tables.

## Research pipeline (server-only)

`src/lib/country-onboarding/party-research.server.ts` — same 3-tier fallback shape as `minister-research.server.ts`.

Per country, three passes, each Perplexity `sonar-reasoning-pro` with domain allowlist seeded from `country-context.server` (national gov TLD, electoral commission, parliament, IFES, IPU, Wikipedia, official party sites):

1. **Parties pass** — enumerate active parties with abbreviation, leader, ideology, seat count, last election result. Structured JSON schema; reject rows without ≥1 https source_url.
2. **Ruling-party pass** — identify the sitting government (single party or coalition), set `is_ruling` + `coalition_role`, cross-check against the ministers already captured in `ministries.minister_profile` (the ruling PM's party must match the flagged lead). Mismatch downgrades confidence to `C` and logs a `grade_alerts` row.
3. **Manifesto pass** — for the ruling lead party, locate the most recent published manifesto / programme of government. Fetch the URL through `fetchCitationText`; if a real document is retrievable, upload to `country-sources` storage bucket, register in `country_sources` (dedup via `upsertCountrySource`), create a `country_source_documents` row, and chunk it into `country_source_chunks` with embeddings so it becomes queryable from Counsel / Ask.

Each pass writes `onboarding_citations` and updates `party_backfill_country_runs.attempted/succeeded/failed`.

## Orchestrator + trigger

`src/lib/country-onboarding/party-backfill.functions.ts` mirrors `minister-backfill.functions.ts`:

- `startPartyBackfill()` — admin-gated, creates a `party_backfill_runs` row + one `party_backfill_country_runs` per country in `country_authorized_domains` scope (default: all 22).
- `stepPartyBackfill({ runId, batch: 1 })` — picks the next `pending`/`stale` country, runs the 3-pass pipeline, upserts `country_parties` + `country_manifestos`, writes memory objects (`kind='position'`, title = "Ruling party posture — {party}") into `memory_objects` so the party programme is discoverable by the Second Brain.
- Heartbeat-based stale detection (10 min) so a dropped browser resumes cleanly.
- `resumePartyBackfill()` and `cancelPartyBackfill()`.

Client hook: same browser-driven loop already used for minister backfill — `useServerFn(stepPartyBackfill)` in a `while (run.status === 'running')` with abort on unmount.

## Admin UI

- `/admin/countries` — new "Political parties & manifestos" card: **Start**, **Resume last run**, **View progress**. Progress reuses the existing `BackfillProgressPanel` component (generalized to accept a config for label + row shape) so we don't fork the UI.
- `/admin/countries/$code/data` — new **Parties** tab: table of parties with ruling flag; drawer per party showing leader, ideology, sources; **Manifesto** panel with themes + pledges accordion and a link that opens the ingested source in `SourceDetailSheet`.

## Second Brain integration

- Manifesto content becomes `country_source_chunks` so `country_chunks_search` returns it in Counsel answers.
- One `memory_objects` row per ruling party (`scope_key='national'`, `kind='position'`, verified=true) summarising the manifesto's headline commitments — same seeding pattern as `onboarding.functions.ts::seedCountryPack`.
- Citations flow through the standard `[N]` marker system so PrettyJson renders them clickable.

## Technical details

- New file layout:
  - `supabase/migrations/<ts>_political_parties_manifestos.sql`
  - `src/lib/country-onboarding/party-research.server.ts`
  - `src/lib/country-onboarding/party-backfill.functions.ts`
  - `src/components/admin/PartyBackfillPanel.tsx`
  - `src/components/country-data/PartiesPanel.tsx`, `ManifestoPanel.tsx`
- All server fns use `requireSupabaseAuth` + admin role check; `supabaseAdmin` only inside handler bodies (never top-level import in `.functions.ts`).
- Idempotency: every upsert keyed on the unique indexes above; re-running a completed country updates fields in place, never duplicates.
- Trigger surface is admin-only; no cron. A future `/api/public/hooks/party-refresh` route can be added later for scheduled refresh but is out of scope for this plan.
- Zero changes to the seven chambers' UX; this is a corpus-enrichment routine.

## Out of scope

- Historical election archives beyond the latest cycle.
- Opposition manifestos (captured as party rows only; no full-text ingest).
- Automated re-run after each election — will be a follow-up trigger once this pipeline stabilises.
