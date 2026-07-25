
# Chamber 08 · Step 08 — The Transformational Plan

A new terminal step in the Mandate Compact flow that synthesizes everything tracks 01–07 produced (manifesto → pillars → pledges → ministry delivery → scorecards → ministries digest → sign/activate) into one AI-authored, cabinet-ready **Transformational Plan** — and pushes it into Chamber 05 (Narrative) as a first-class signal for comms.

The plan itself is a versioned, citation-backed document; the report view is a beautiful editorial render of that document; the Narrative handoff is a single button that seeds a signal + dossier so Comms can generate press/PM/X/LinkedIn/cabinet-memo drafts on top of it.

---

## 1. What "Transformational Plan" means here

One document per compact revision, structured as:

1. **Executive Overture** — 1-page McKinsey-style situation → complication → mandate → transformation thesis.
2. **The Mandate in Numbers** — pillar-weighted commitments, pledge count, ministries engaged, horizon, expected GDP delta (pulled from Chamber 03 baseline).
3. **Pillars of Transformation** (one section per `compact_pillar`) — narrative + owning ministries + top pledges + KPIs + risks.
4. **Ministry Delivery Compact** — from `compact_deliverables` grouped by ministry; each ministry gets an accountability card (owner, quarterly milestones, at-risk flags from `compact_scorecards`).
5. **First 100 Days / First 12 Months / Full-Term Horizon** — sequenced milestone ladder.
6. **Risk & Resilience** — pulled from Chamber 04 (FDI threats) + at-risk deliverables.
7. **Measurement & Cadence** — scorecard rules, review cadence, PM report-card thresholds.
8. **Stakeholder Compact** — cabinet / parliament / citizens / diaspora / investors sections.
9. **Appendix** — citations, source manifesto excerpts, revision lineage.

Every claim renders through `<CitedMarkdown>` so pledge-level assertions carry `[N]` refs back to `onboarding_citations` and the manifesto chunks already in the corpus.

---

## 2. Data model (one migration)

New table `compact_transformational_plans` (plus GRANTs + RLS in the same migration, per project rules):

- `id uuid pk`
- `compact_id uuid → mandate_compacts(id) on delete cascade`
- `country_code text` (denormalized for RLS via `has_country_access`)
- `version int` (auto-increment per compact)
- `status text` — `draft | cabinet_review | approved | published`
- `title text`, `subtitle text`
- `sections jsonb` — ordered array `{ id, kind, heading, body_md, citations[], data_refs{} }`
- `metrics jsonb` — headline numbers (pillar weights, pledge counts, GDP delta, horizon)
- `sources jsonb` — ordered citation array (mirrors the `citations` contract used by `PrettyJson`/`CitedMarkdown`)
- `narrative_signal_id uuid null` — set when handed off to Chamber 05
- `authored_by uuid`, `authored_at timestamptz`
- `approved_by uuid null`, `approved_at timestamptz null`
- `published_at timestamptz null`
- Indexes on `(compact_id, version desc)`, `(country_code, status)`

Grants: `SELECT/INSERT/UPDATE` to `authenticated`, `ALL` to `service_role`, no `anon`. RLS: read/write gated by `has_country_access(country_code)`.

---

## 3. Server functions (new module `src/lib/mandate-compact/transformational-plan/`)

All are `createServerFn` under `.middleware([requireSupabaseAuth])`, module tagged with `@domain mandate-compact @tables compact_transformational_plans …`.

- **`generate.functions.ts` · `generateTransformationalPlan({ compactId })`**
  - Loads compact + pillars + pledges + deliverables + latest scorecards + ministries digest + relevant Chamber 04 threats.
  - Pulls manifesto chunks via corpus gateway (`src/lib/corpus/gateway.server.ts`) using pillar names as retrieval keys so each section is grounded.
  - Runs a **3-pass AI pipeline** on `google/gemini-3.1-pro-preview` (deep reasoning) with `google/gemini-3.6-flash` fallback:
    1. **Outline pass** — produces the section skeleton + which pledges/KPIs anchor each section.
    2. **Draft pass** — expands each section in parallel (bounded concurrency = 3) with the corpus excerpts as evidence.
    3. **Polish pass** — one cabinet-tone rewrite over the assembled document, enforcing McKinsey pyramid principle (answer-first, MECE pillars).
  - Structured output via AI SDK `Output.object` with a **flat** schema (no `.min/.max`, no long enums — limits stated in the prompt and clamped in code, per `ai-sdk-agent-patterns` rules).
  - Inserts a new row at `version = max(version)+1`, `status = draft`.
- **`get.functions.ts` · `getTransformationalPlan({ compactId, version? })`** — latest by default.
- **`list.functions.ts` · `listTransformationalPlans({ compactId })`**.
- **`revise.functions.ts` · `reviseTransformationalPlan({ id, sectionId, body_md })`** — targeted section rewrite (used by inline Edit).
- **`approve.functions.ts` · `approveTransformationalPlan({ id })` / `publishTransformationalPlan({ id })`** — status transitions, audit rows.
- **`handoff.functions.ts` · `handoffToNarrative({ id })`**
  - Creates a `narrative_signals` row of kind `transformational_plan` scoped to the country, with the plan's executive summary as the body, the plan's `sources` mapped to `onboarding_citations`, and `metadata = { compact_id, plan_id, plan_version }`.
  - Creates a `narrative_dossiers` row pre-populated with pillar → talking-point mapping so `DraftStudio` can generate all 7 channel drafts without re-reasoning from scratch.
  - Writes back `narrative_signal_id` on the plan row.
  - Returns `{ signalId }` so the UI can deep-link into `/admin/countries/$code/narrative/signal/$id` (or the console equivalent).

- **`export.functions.ts` · `exportTransformationalPlanPdf({ id })`** *(stretch, phase 2)* — renders a print stylesheet variant of the report route via `@react-pdf/renderer` or `pdf-lib`, stored in Supabase Storage, returned as a signed URL. Same route also supports `?print=1` for browser-printed PDF as a phase-1 fallback.

---

## 4. UI — new Step 08 tab "Plan"

Add to the `STEPS` array in `src/routes/_authenticated/admin/countries.$code.mandate-compact.tsx`:

```
{ key: "plan", label: "Plan", icon: FileText, hint: "Cabinet-ready transformational plan" }
```

Positioned **after Ministries, before Publish** so the flow reads: Ingest → Decompose → Transform → Track → Ministries → **Plan** → Publish → History.

New components under `src/components/mandate-compact/plan/`:

- **`PlanPanel.tsx`** — orchestrator. Empty state = one big "Generate Transformational Plan" `btn-primary` with an explainer of what's being synthesized. Non-empty = version selector + report + toolbar.
- **`TransformationalPlanReport.tsx`** — the editorial render. Uses the project's design tokens: `font-serif` display for section headings, mono eyebrows, `text-ink-950` body, gold rules between sections, generous whitespace. Renders every section body through `<CitedMarkdown>` with the plan's `sources` so `[N]` markers are clickable.
- **`PlanCoverPage.tsx`** — masthead: country flag, PM name, election cycle, plan version + status pill, "As presented to the Cabinet on …".
- **`PlanMetricsStrip.tsx`** — the "Mandate in Numbers" tiles, reusing `NumberTile` styling.
- **`PillarSection.tsx`**, **`MinistryAccountabilityCard.tsx`**, **`MilestoneLadder.tsx`**, **`RiskMatrix.tsx`**, **`StakeholderCompactGrid.tsx`**.
- **`SectionEditDrawer.tsx`** — inline "Refine this section" flow; textarea + Regenerate/Save; calls `reviseTransformationalPlan`.
- **`PlanToolbar.tsx`** (sticky at top of the report):
  - `Regenerate` (versions the plan; keeps old versions accessible)
  - `Approve` (draft → cabinet_review → approved)
  - `Publish`
  - `Export PDF` / `Print`
  - `Send to Narrative Chamber` (`btn-accent`) → calls `handoffToNarrative`, then `navigate({ to: "/admin/countries/$code/narrative/signal/$id" })`.
- **`PlanVersionRail.tsx`** — left-rail vertical list of versions with author/date/status, matching `RevisionsPanel` visual language.

All buttons use `btn-primary` / `btn-secondary` / `btn-ghost` / `btn-accent` utilities per the project's global button contract — no inline `bg-ink-*`.

Loading & progress: reuse the `AskProgress`-style stage indicator (Outline → Draft → Polish → Ground) so users see the 3-pass pipeline advance rather than a spinner.

Gating: the "Generate" button is disabled until `activeStep === "transform"` has produced deliverables AND at least one scorecard row exists; disabled state shows a hint pointing back to the missing step (mirrors the Stage-12 gate pattern in the memory index).

---

## 5. Narrative Chamber integration (Chamber 05)

Additions on the Chamber 05 side (thin — most of the work is data shape):

- **`SignalTriageRail`** picks up the new `kind = 'transformational_plan'` signals automatically once `handoffToNarrative` inserts them. Add a distinctive `PriorityPill` variant + icon so cabinet-authored plans are visually separated from press-driven signals.
- **`SignalSourcesPanel`** already renders `sources`; the plan's `sources` array is passed through unchanged so `[N]` markers resolve.
- **New `PlanDossierCard.tsx`** under `src/components/narrative/` — when a signal's `metadata.plan_id` is set, this card renders above the standard `DossierCard` and shows: pillar list, headline metrics, "Open in Chamber 08 →" link, and per-pillar "Talking points" pre-seeded from the plan.
- **`DraftStudio.tsx`** — no logic change needed; it already reads the strategy statement + dossier and generates the 7 channel drafts. We add a small hint chip "Grounded in Transformational Plan v{n}" when the signal is plan-derived so comms staff see the provenance.
- Optional: a **"Publish to Concierge"** action on the plan that surfaces the exec summary in the Country Console (Chamber 01/Ask), so ministers can ask "what is our transformational plan for education?" and get plan-grounded answers.

---

## 6. Corpus wiring (public/private aware)

- The plan row is written with `visibility = 'private'` by default (cabinet-internal) and is only exposed to users passing `has_country_access`.
- When `publishTransformationalPlan` runs, the public sections (Executive Overture + Pillars + Stakeholder Compact) are mirrored into `memory_objects` with `visibility = 'public'` so citizen-facing surfaces (marketing + console) can quote them, while ministry accountability + risk sections remain private.
- Every AI generation call uses the corpus gateway retrieval so the model only ever cites material already ingested for that country — no hallucinated URLs.

---

## 7. Rollout in slices (each shippable independently)

1. **Slice A — schema + read paths.** Migration + `list/get` server fns + empty Plan tab that lists versions.
2. **Slice B — generation.** `generateTransformationalPlan` + `PlanPanel` empty state + `TransformationalPlanReport` v1 renderer + AskProgress-style pipeline.
3. **Slice C — editorial polish.** Cover page, metrics strip, per-pillar sections, sticky toolbar, versioning, inline section revise.
4. **Slice D — Narrative handoff.** `handoffToNarrative` + `PlanDossierCard` + deep-link + DraftStudio provenance chip.
5. **Slice E — Approve / Publish + public mirror to `memory_objects`.**
6. **Slice F — Export.** Print stylesheet first, then server-side PDF to Supabase Storage.

---

## 8. Docs & guardrails to update in the same PR series

- `docs/map/chambers.md` — extend Chamber 08 entry with the new module, components, tables.
- `AGENTS.md` — add "Plan" to the Chamber 08 row.
- `bun run headers && bun run map` before each PR (CI guard).
- Memory: no new core rules; the existing PrettyJson + button-contract + no-dup corpus rules cover this feature.

---

## Technical notes

- **AI SDK / gateway.** All calls through `createLovableAiGatewayProvider` (`src/lib/ai-gateway.server.ts`). Primary model `google/gemini-3.1-pro-preview` for reasoning-heavy passes, `google/gemini-3.6-flash` for the parallel section drafts (cost + latency), OpenAI `gpt-5.4` as a fallback when Gemini rate-limits. Structured output uses flat `Output.object` schemas with limits enforced in prompts + code, and wrapped in the `NoObjectGeneratedError.isInstance` fallback that parses `error.text`.
- **Concurrency.** Section draft pass uses `Promise.all` bounded to 3 in-flight requests (simple semaphore) so one plan takes ~30–45 s end-to-end instead of a single 3-minute serial call, and stays well under Cloudflare Worker CPU limits.
- **Idempotency.** `generateTransformationalPlan` always creates a new `version` row. Cancels/retries never mutate an existing version — matches the "second brain no duplicates" contract.
- **RLS.** Same `has_country_access` helper used across the corpus; super-admin `viewAs` impersonation from `useImpersonation` is honored because the server fn re-derives the effective country from the caller's claims + impersonation context, not from client input alone.
- **No public loaders call protected fns.** The Plan tab reads via `useQuery` inside the component (like every other tab in this route), not via a route loader — same pattern as the existing `MinistriesPanel` / `RevisionsPanel`.
- **Serverless-safe rendering for PDF (phase 2).** `@react-pdf/renderer` runs in workerd; if it doesn't, we switch to a print-CSS-only path (users hit "Print → Save as PDF") which is what most cabinet offices already do.
