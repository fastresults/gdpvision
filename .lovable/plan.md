
# Chamber 05 — The Narrative Chamber (rebuild)

## Why this rebuild

Today's `/narrative/*` surface is generic (workspace-wide), tab-heavy, and disconnected from the country context that Chambers 01–04 established. It exposes primitives (intake, queue, strategy, comms, coverage) but not a *workflow*. A Prime Minister's press office needs a **single, guided canvas** that takes a raw local/regional/international signal and converts it into an approved, on-message, cited statement inside one working day.

We keep the existing server functions and DB tables (`intake_items`, `strategy_statements`, `comms_artifacts`, `narrative_lineage`, `memory_objects`) and rebuild the UX + a few new server functions on top.

## Design principles (match Chambers 03/04)

- **Country-scoped route** `/admin/countries/$code/narrative` (not global `/narrative`) — returns to onboarding via `returnCode`.
- **Two-rail McKinsey shell**: left = Active Signals rail (CRUD like Chamber 04 threats); right = 4-Act workspace.
- **Guided Journey bar** (sticky top): Act 1 Monitor → Act 2 Triage → Act 3 Position → Act 4 Publish. Progress ticks per signal.
- **Guidance banners + ExplainHover (3.5s)** on every panel — reuse `explain-copy.ts` primitives from Chamber 04.
- **Grounded AI** — every generated line carries a `[N]` citation into the country's second brain / source registry (reuse `country_sources` + `citations` pattern).

## The 4-Act workflow

```text
 ┌─────────────────────────────────────────────────────────────┐
 │  Journey:  ① Monitor  →  ② Triage  →  ③ Position  →  ④ Publish │
 └─────────────────────────────────────────────────────────────┘
   Signal Radar   Dossier +      Strategy         Draft →
   (local /       Angle Matrix   Statement        Approve →
    regional /    + Severity/    (7-part) +       Coverage
    intl feeds)   Reach/Urgency  Talking Points   ledger
```

### Act 1 — Signal Radar (Monitor)
- **World Map + heat panel** grouped by scope: `local | regional | international`.
- **Live signals stream** (existing `intake_items` per country) plus new **"Add signal"** flow: paste URL → server fn calls Perplexity/Firecrawl → auto-classifies scope, sector, sentiment, severity, reach, decay half-life; drafts a 3-line dossier.
- **Deep-research pass** ("Redrive") re-queries the web with country + sector framing and enriches the signal (reuse pattern from Stage-12 3-pass fan-out).
- **Filters**: sector (from `country_sectors`), scope, sentiment (−/0/+), status (new/triaged/positioned/published/archived).

### Act 2 — Triage (Dossier + Angle Matrix)
- Signal detail opens a **Dossier card**: what happened, why now, who's affected, historical analogs (from `memory_objects`), sector exposure (join `country_sectors` × severity).
- **Angle Matrix** (2×2): *Severity × Reach* with each competing narrative angle plotted; drag-to-prioritize.
- **Recommendation engine**: AI proposes *Lead | Amplify | Counter | Monitor-only | Ignore* with rationale + confidence grade (A–D like KPIs).
- CRUD: edit signal, mark decided, snooze, archive.

### Act 3 — Position (Strategy Statement)
- Uses existing `strategy_statements` (7-part frame). Rewritten as a **guided form** with:
  - Auto-drafted **problem / stakeholder / promise / proof / ask / risks / next-step** grounded in country KPIs and cited sources.
  - **Message House** visualization (roof = promise, pillars = 3 proofs, foundation = evidence chips).
  - **Talking points bank** (3–7 lines, ≤ 20 words each) with tone chips (empathetic / confident / technical).
  - **Risk register** side panel — auto-lists likely blowback with mitigation lines.
- Reviewer checklist inline (facts cited, tone approved, legal flag).

### Act 4 — Publish (Comms + Coverage)
- **Draft studio** (existing `comms_artifacts`): channel presets — Press release, PM statement, X/thread, LinkedIn, Cabinet memo, Radio 60-sec, Op-ed lede.
- **One-click generation** per channel from the approved strategy; each output shows character/word counts, reading grade, tone score.
- **Approval workflow**: draft → review → approved → published, with signer, timestamp, and diff.
- **Publish ledger**: log outbound artifact (link, channel, published_at) → auto-open **Coverage tracker** that watches for pickup via Perplexity/web search and grades sentiment shift vs baseline.
- **Narrative lineage graph** (reuse `narrative_lineage`): signal → dossier → strategy → artifact → coverage, rendered as a horizontal 5-node chevron per closed loop.

## Session Mode — "From signal to statement by 5pm"
Sticky **Day Clock** header showing SLA budget: signal ingested at 09:12 → target publish 17:00. Journey bar turns amber < 2h remaining, red at overrun. Provides the McKinsey cadence promise the PRD calls for.

## Files to add / change

**New route tree (country-scoped, mirrors `studio.tsx`):**
- `src/routes/_authenticated/admin/countries.$code.narrative.tsx` — shell (two-rail, journey bar, day clock, breadcrumb w/ `returnCode`)
- `src/routes/_authenticated/admin/countries.$code.narrative.index.tsx` — Act 1 Radar
- `src/routes/_authenticated/admin/countries.$code.narrative.signal.$id.tsx` — Acts 2–4 workspace per signal

**New components** under `src/components/narrative/`:
- `SignalRadar.tsx`, `AddSignalDialog.tsx`, `SignalRow.tsx`
- `DossierCard.tsx`, `AngleMatrix.tsx`, `RecommendationChip.tsx`
- `MessageHouse.tsx`, `TalkingPointsEditor.tsx`, `RiskRegister.tsx`
- `DraftStudio.tsx` (channel-preset tabs), `ApprovalStrip.tsx`
- `CoverageTracker.tsx`, `LineageChevron.tsx`, `DayClock.tsx`
- `JourneyBar.tsx` (or reuse Chamber 04's `WorkbenchJourney`)

**New / extended server fns** in `src/lib/narrative.functions.ts`:
- `ingestSignalFromUrl` — Firecrawl+Perplexity → intake row w/ classification
- `redriveSignal` — deep-research pass, enriches dossier + cites
- `recommendAngle` — AI verdict (Lead/Amplify/…​) + confidence
- `generateStrategyDraft` — 7-part fill grounded in KPIs + citations
- `generateChannelDraft` — { strategyId, channel } → artifact
- `publishArtifact` — writes lineage row, opens coverage watcher
- `pollCoverage` — server route `src/routes/api/public/hooks/narrative-coverage.ts` (cron-safe)

**Launcher update:**
- `src/components/country/ChambersLauncher.tsx` — Chamber 05 link becomes params-based `to: "/admin/countries/$code/narrative"`.

**Retire (later, out of scope):**
- Old global `/narrative/*` tree stays functional but the launcher no longer points at it; can be deprecated in a follow-up.

## Data model

All existing tables are sufficient. Two small migrations:
1. `intake_items`: add `scope text check in ('local','regional','international')`, `severity int`, `reach int`, `sentiment int`, `status text`, `country_code text` (backfill from `scope_key`), plus indexes on `(country_code, status)`.
2. `comms_artifacts`: add `channel text`, `approved_by uuid`, `published_at timestamptz`, `published_url text`.

Both include `GRANT SELECT/INSERT/UPDATE/DELETE … TO authenticated` and RLS via `has_country_access`.

## Verification

- Manual walkthrough: paste a real news URL for ATG → signal appears with dossier → recommend Lead → strategy auto-drafts with citations → generate press release + X thread → approve → publish → lineage chevron completes → coverage tracker begins polling.
- Playwright: 4-act happy path screenshot per act.
- Typecheck + build.

## Out of scope (follow-ups)

- Full deprecation/removal of the legacy `/narrative` global tree.
- Multi-language drafting.
- Broadcast/video artifact rendering.
