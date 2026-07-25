## Chamber 08 · "Mandate Compact"

**Positioning.** The other seven chambers analyse, decide, and communicate. Chamber 08 is the **covenant with the electorate**: turn the ruling party's manifesto — the promises made before the vote — into a signed, structured, ministry-by-ministry, quarter-by-quarter delivery plan, then track it in the open for the whole elected term.

**Reference frame.** Think Project 2025's discipline (one unified document, everyone rowing) applied to a sovereign nation's own promises, not an ideology imported from elsewhere. The manifesto is the source of truth; the Compact is how it becomes government.

**Route.** `admin/countries/$code/mandate-compact` (super-admin & country admins). Console tab-bar unchanged; a "Compact" pill appears on the Study surface for country users to browse the public dashboard.

---

### The four phases (surfaced as a stepper across the top)

1. **Ingest** — Upload the manifesto PDF / paste text / point at a URL. Reuses `country_manifestos` (already exists, per-party per-cycle unique). Adds `is_governing_compact` flag so we know which one is the "in-force" mandate. Multimodal: PDF via `document--parse_document`, image scans via Gemini Vision, audio manifesto speeches via existing `transcribeAudio`. **The full manifesto text is chunked and embedded straight into the second brain** — see §Second-brain integration below.

2. **Decompose** — AI reads the manifesto and produces a structured tree:
   `Manifesto → Pillars (5–8) → Pledges (30–80) → Deliverables (200–500) → Ministry owner + KPI links + quarterly milestones`.
   Uses the existing corpus + Perplexity + Gemini waterfall (`fallback.server.ts`) so every pledge is grounded in the actual document, not hallucinated. Every node carries `citations` back to the manifesto page/paragraph.

3. **Transform** — For each pledge the AI drafts a **Transformation Brief**: theory of change, lead ministry, supporting ministries, quarter-by-quarter milestones across the elected term (5 default, configurable), budget envelope, dependency edges, risk register, KPI links, and a "what makes this transformational vs. incremental" note. Signed off by the PM's office; sign-off snapshots become immutable revisions.

4. **Track** — A live "Compact Dashboard" that scores every pledge On-track / At-risk / Off-track / Delivered / Broken based on KPI movement + ministry status updates + commitment closure + evidence uploads. Rolls up to Ministry Scorecards and a **PM Report Card** (single-page term-to-date view). Auto-generates a public "Promise Tracker" for the Console/marketing surface.

---

### Second-brain integration (the key upgrade)

The manifesto and every product of the Compact become first-class corpus citizens so Ask-the-Ledger, sector dossiers, minister profiles, and the Cabinet Room can all cite them.

- **Register the manifesto as a country source.** On upload we call `upsertCountrySource` (existing per-country dedup helper) with `org = "Governing Party"`, `url = source_url`, `visibility` inherited from the manifesto row (public unless the admin marked it private). The uploaded PDF/text is stored in the `country-sources` bucket and linked as a `country_source_documents` row (`document_type = "manifesto"`).
- **Chunk + embed.** The full manifesto text is chunked at paragraph granularity (500–1500 chars, small overlap) and written to `country_source_chunks` with `google/gemini-embedding-001` embeddings. Every chunk carries `country_code`, `document_id`, `chunk_index`, and page anchors so `country_chunks_search` returns them scoped to the country. This is the same pipeline the corpus already uses for research documents — Chamber 08 just reuses `corpus/writers.server.ts`.
- **Structured memory objects.** Each `compact_pillar`, `compact_pledge`, `compact_deliverable`, and every signed `compact_revision` writes a matching `memory_objects` row (`kind = "compact_pillar" | "compact_pledge" | "compact_deliverable" | "compact_revision"`), embedded and country-scoped, so semantic search over "what did the PM promise about health" surfaces the pledge, its verbatim quote, the deliverable plan, and the latest status in one query.
- **Status updates flow back too.** Every `compact_status_updates` row (ministry evidence + narrative) becomes a `memory_objects` entry, so Ask-the-Ledger answers like "Is the Ministry of Agriculture on track with the food-security pledge?" cite the exact quarterly update the minister filed.
- **Cross-chamber links.** `sector_dossiers` and `ministry_profiles` gain a `linked_pledge_ids` array populated at commit time; the sector dossier drawer surfaces "Pledges you own" and the minister card shows "Your covenant with the electorate" — no new queries required, just corpus joins.
- **Visibility discipline.** Public manifestos → public corpus rows (readable by `anon` via the existing `has_country_access` policy). If an admin marks a manifesto private, every derived source/chunk/memory row inherits `visibility = 'private'` + `owner_country_code` via the existing `enforce_private_ownership` trigger. No policy divergence.
- **Dedup.** Re-uploading the same manifesto (same `country_code + party_id + election_cycle`) upserts on the existing `country_manifestos_uidx`, and the corpus writer dedups on `(country_code, source_url)` + chunk hash — re-runs are idempotent, consistent with the "Second brain no-duplicates" cardinal rule.

Net effect: the Compact is not a silo. Every promise, plan, and status update is queryable from Chambers 01, 02, 05, 06, 07 the moment it's written.

---

### Data model (new tables — all follow the public-schema-grants + RLS pattern already in the project)

Every table gets `visibility` (`public`/`private`) + `owner_country_code` + `has_country_access` policy, consistent with the rest of the corpus.

- **`mandate_compacts`** — one row per elected term.
  `country_code`, `manifesto_id` (→ `country_manifestos`), `election_cycle`, `term_start`, `term_end`, `pm_name`, `governing_party_id`, `status` (draft / signed / in_force / concluded), `signed_at`, `signed_by`, `summary`, `citations` jsonb.
- **`compact_pillars`** — 5–8 top-level themes.
  `compact_id`, `title`, `narrative`, `sort_order`, `color_token` (sector-01..12).
- **`compact_pledges`** — discrete promises lifted verbatim from the manifesto.
  `pillar_id`, `title`, `verbatim_quote`, `page_ref`, `pledge_type` (quantitative/qualitative/legislative/institutional), `baseline_value`, `target_value`, `unit`, `citations` jsonb, `memory_object_id` (→ `memory_objects`).
- **`compact_deliverables`** — 200–500 transformation-plan children.
  `pledge_id`, `lead_ministry_id`, `supporting_ministry_ids` uuid[], `title`, `theory_of_change`, `quarterly_milestones` jsonb, `budget_envelope` numeric, `budget_currency`, `dependencies` uuid[], `risk_level`, `kpi_ids` uuid[], `transformational_note`, `signed_off_at`, `memory_object_id`.
- **`compact_status_updates`** — append-only ministry-side status log.
  `deliverable_id`, `reported_by`, `period`, `status` (on_track/at_risk/off_track/delivered/broken), `evidence_url`, `narrative`, `kpi_snapshot` jsonb, `memory_object_id`, `created_at`.
- **`compact_scorecards`** — nightly-computed rollups per ministry per period.
  `compact_id`, `ministry_id`, `period`, `on_track_pct`, `at_risk_pct`, `off_track_pct`, `delivered_pct`, `broken_pct`, `weighted_progress`, `computed_at`.
- **`compact_revisions`** — snapshot on every sign-off / re-baseline (immutable audit trail; the electorate can see what changed and when).

Grants: `SELECT` to `authenticated`; `SELECT` to `anon` only on the public-facing tables (`mandate_compacts`, `compact_pillars`, `compact_pledges`, `compact_scorecards`, `compact_revisions`) filtered to `visibility = 'public' AND status IN ('signed','in_force','concluded')`. Writes locked to country admins + super-admins.

---

### Server functions (new module: `src/lib/mandate-compact/`)

- `ingestManifesto.functions.ts` — upload/parse → row in `country_manifestos` + `mandate_compacts` draft **+ corpus registration (source, document, chunks, embeddings)**.
- `decomposeManifesto.functions.ts` — Perplexity `sonar-reasoning-pro` then Gemini 3.1-pro fallback; produces pillars + pledges with page-anchored citations; writes matching `memory_objects`.
- `draftTransformationPlan.functions.ts` — per-pledge deliverable generation. Uses `ministries` + `ministry_sectors` + `sector_dossiers` + `country_kpis` + newly-embedded manifesto chunks as context. Every deliverable writes a `memory_objects` row.
- `signCompact.functions.ts` — protected by `requireSupabaseAuth` + PM/admin role; freezes baseline into `compact_revisions` and flips status to `in_force`.
- `submitStatusUpdate.functions.ts` — ministry-scoped writes (uses `has_country_role`); writes a `memory_objects` entry per update.
- `recomputeScorecards.functions.ts` — invoked nightly + on any status update; deterministic weighted rollup.
- `publishPromiseTracker.functions.ts` — snapshots the public projection for the Console/marketing surface.

All modules ship with `@domain mandate-compact / @tables ... / @ui ...` headers so `bun run check:maps` passes.

---

### UI (new components under `src/components/mandate-compact/`)

`CompactStepper`, `ManifestoIntake` (drop-zone with the same feedback pattern as `OppositionIntakeDropZone`), `PillarBoard`, `PledgeCard` (verbatim quote + page ref → opens the source PDF via `CitationDetailsDialog`), `TransformationBriefDrawer`, `MinistryScorecardGrid`, `PMReportCard` (print/PPTX/PDF via `pptxgenjs`), `PromiseTrackerPublic`, `CompactTimeline` (Gantt across the elected term).

Console (`console/$code/study`) gets a new "Compact" chip that opens the public read-only dashboard for that country's citizens/staff.

---

### Cardinal-rule compliance

- Buttons: `btn-primary`/`btn-secondary`/`btn-ghost`/`btn-accent` only.
- JSON payloads (pledge citations, quarterly milestones, KPI snapshots) render via `<PrettyJson>` with the ordered `citations` array so `[N]` markers are clickable.
- Every new table has GRANTs + RLS + `has_country_access` / `has_country_role` policies in the same migration.
- All server fns are `createServerFn` in `.functions.ts`; admin client loaded via `await import('@/integrations/supabase/client.server')` inside handlers.
- Second-brain writes go through `corpus/writers.server.ts` + `upsertCountrySource` — no direct inserts, no duplicate sources or chunks.
- Chamber 08 added to `AGENTS.md §3` and `docs/map/chambers.md` before shipping.

---

### Delivery slices

1. **Slice A — Foundation + Corpus wiring** (migrations, Ingest, corpus registration + chunking + embeddings, Decompose). Manifesto lands, is fully searchable from Ask-the-Ledger the same turn.
2. **Slice B — Transformation Plan** (Transform phase + sign-off + revisions + memory_objects for pledges/deliverables). PM-signable Compact.
3. **Slice C — Live Tracking** (status updates → memory_objects, scorecards, PM Report Card, dashboard).
4. **Slice D — Public Promise Tracker** (Console tab + `/promises/$code` marketing surface + PPTX/PDF exports).

Approve and I'll open Slice A with the migration + Ingest server fn (including the corpus writers) + the admin route shell.
