# Chamber 06 · Cabinet Room — Prime-Time Rebuild

Today the Room is four grey tiles and a text list. Cabinets don't decide from tiles — they decide from a *situation picture*. This plan turns the Cabinet Room into a visual, data-rich, decision-first workspace that draws on every corpus already in the second brain (Ledger, Ministries, Sectors, KPIs, Narrative, Studio/FDI, Scenarios, Comms, Capital Flows, Grades) and turns them into agenda-ready packets.

## Design principles (McKinsey lens)

1. **Situation → Options → Decision** on every screen (Pyramid Principle).
2. **One-page truth**: the top fold answers "what must Cabinet decide this week, and what's the evidence?"
3. **Every number is clickable back to source** — reuse `CitedMarkdown`, `WhyThisNumberPanel`, `TrustSignals`.
4. **Second-brain first**: no static placeholders; every card is fed by an existing table.
5. **State of the Nation, not a to-do list**: charts, heatmaps, sparklines, sector chips — the language the rest of the app already speaks.

## New Room layout (replaces current 4-stat + 2-panel grid)

```text
┌──────────────────────────────────────────────────────────────────────┐
│  HERO STRIP · Country · Next session countdown · Readiness ring      │
│  · Decision velocity spark · Overdue heat · Grade posture            │
├──────────────────────────────────────────────────────────────────────┤
│  A · STATE OF THE NATION (auto-brief, 120w, McKinsey pyramid)        │
│      Situation | Complication | Question | Recommendation            │
│      — Generated from KPIs, Narrative P1/P2, Grade downgrades,       │
│        Studio exposure, open Commitments. Cited [N].                 │
├──────────────────────────────────────────────────────────────────────┤
│  B · SITUATION BOARD (3 columns)                                     │
│   Macro Pulse    │ Sector Heat        │ Fiscal & Capital             │
│   MacroStrip     │ GdpTreemap +       │ SovereignSankey +            │
│   KpiSmall-      │ SectorTrendBars    │ DebtHorizon                  │
│   Multiples      │ (top movers)       │                              │
├──────────────────────────────────────────────────────────────────────┤
│  C · WHAT NEEDS A DECISION (the queue)                               │
│   Ranked cards, each = a proposed agenda item                        │
│   [Signal chip] Title · Sponsor Ministry · Impact bar · Confidence   │
│   Evidence rail (3-5 [N] chips) · [Add to agenda] [Draft brief]      │
├──────────────────────────────────────────────────────────────────────┤
│  D · MINISTRY READINESS MATRIX                                       │
│   Rows = ministries, cols = (Brief · Sponsor · Metric · Owner)       │
│   Cell colored by readiness — click → ministry profile drawer        │
├──────────────────────────────────────────────────────────────────────┤
│  E · COMMITMENTS COCKPIT                                             │
│   Marimekko: status × ministry · overdue red band · median age       │
│   Ageing waterfall · SLA breach list                                 │
├──────────────────────────────────────────────────────────────────────┤
│  F · SESSION TIMELINE (12-mo cadence, past+scheduled+draft)          │
└──────────────────────────────────────────────────────────────────────┘
```

Tabs remain (Room · Signals · Register · Sessions) but each is rebuilt with the same visual vocabulary.

## Second-brain wiring (per card → source)

| Card | Source table(s) / helper |
|---|---|
| Readiness ring | `cabinet_agenda_items` (brief_md, dossier, sponsor) |
| Grade posture | `grade_alerts`, `series.confidence_grade` |
| State-of-nation brief | Lovable AI (Gemini) over KPI deltas + top P1 signals + open commitments; stored in `cabinet_sessions.brief_md` with citations to `country_kpis`, `intake_items`, `fdi_threats` |
| Macro Pulse | `MacroStrip` from `country_kpis` (GDP, inflation, unemp, debt/GDP, current-account) |
| Sector Heat | `GdpTreemap`, `SectorTrendBars` from `country_sectors` + `sector_dossiers` momentum |
| Fiscal & Capital | `SovereignSankey` + `DebtHorizon` from `country_capital_flows`, `capital_flow_nodes` |
| Decision queue | union of: `intake_items` (P1/P2), `grade_alerts` (new downgrades), `fdi_threats` (severity ≥ high), `scenarios` (promoted), open items in `strategy_statements`, unresolved `dossier_questions` — ranked by a `decisionScore` (priority × recency × exposure) |
| Ministry Readiness | `ministries` × `ministry_profiles` × `ministry_sectors` × unresolved commitments |
| Commitments Cockpit | `commitments` (status, due_at, ministry_id) + `decisions` |
| Session Timeline | `cabinet_sessions` (past/scheduled) + `cabinet_agenda_items` count |
| Evidence rails | `onboarding_citations` + `citations` — rendered via `CitedMarkdown`/`CitationSup` |

## New / extended server functions in `src/lib/cabinet.functions.ts`

- `getSituationPicture(countryCode)` — returns macro strip, sector movers, capital-flow summary, grade posture, exposure headline. Aggregates from existing viz helpers.
- `getDecisionQueue(countryCode)` — ranked, deduped union of signals with `decisionScore`, sponsor ministry inference, and pre-built evidence dossier.
- `getMinistryReadiness(countryCode)` — per-ministry readiness score (brief, sponsor set, metric defined, owner assigned).
- `getCommitmentsCockpit(countryCode)` — status × ministry matrix, ageing buckets, SLA breaches, median close time.
- `generateSituationBrief(countryCode, sessionId?)` — Lovable AI Gemini call, McKinsey pyramid, ≤180 words, citations [N] wired to `onboarding_citations` + `intake_items`. Persisted in `cabinet_sessions.brief_md` or a new `cabinet_brief_cache` row keyed by (country, date).
- Extend `getRoomOverview` to include a `situationHeadline` string and `postureBadges` (fiscal, external, social, political).

All new functions use `requireSupabaseAuth`; no schema changes required except a lightweight `cabinet_brief_cache(country_code, generated_at, brief_md, citations jsonb)` table with the standard grants + RLS pattern (admin + `has_country_access`).

## New components (all under `src/components/cabinet/`)

- `SituationHero.tsx` — countdown, readiness ring (SVG), posture badges, decision-velocity spark.
- `StateOfNationBrief.tsx` — `CitedMarkdown` render + regenerate button + last-generated stamp.
- `SituationBoard.tsx` — 3-col wrapper reusing `MacroStrip`, `GdpTreemap`, `SectorTrendBars`, `SovereignSankey`, `DebtHorizon`.
- `DecisionQueue.tsx` — ranked cards with impact bar, confidence pill, evidence chips, sponsor selector, `Add to agenda` / `Draft brief` actions.
- `MinistryReadinessMatrix.tsx` — colour-graded grid; row click opens a right-side `MinistryDrawer` with the ministry profile + minister block.
- `CommitmentsCockpit.tsx` — Marimekko (reuses `ReallocationMarimekko` pattern), ageing waterfall, breach list.
- `SessionTimeline.tsx` — horizontal 12-mo ribbon with markers.
- `PostureBadge.tsx`, `ImpactBar.tsx`, `ReadinessRing.tsx`, `EvidenceChips.tsx` — small primitives.

## Tab upgrades

- **Signals**: add filters (kind, priority, ministry, sector), a heat sparkline per source, and a "Bundle into agenda item" multi-select that creates one agenda item with a combined brief.
- **Register**: swap the flat table for a decisions timeline + commitments Kanban (open / in_progress / delivered / blocked), with ministry swimlanes and overdue highlighting.
- **Sessions**: cards with agenda preview, readiness ring, dossier count, and last-modified — plus "Duplicate" and "Convert to recurring".

## Agenda & Session Mode polish (same visual language)

- Agenda editor: add the Situation Board mini-strip at the top, per-item impact/confidence sliders, and a "Fill from second brain" action that pre-populates dossier chips from `getDecisionQueue` evidence.
- Session Mode: keep the dark theatre, but add a persistent right-rail thumbnail of the active item's evidence chart (sector treemap slice, macro spark, or flow ribbon) — decision-makers see the *thing*, not just its title.

## Auto-brief pipeline

Nightly (or on demand):
1. Pull KPI deltas (WoW/MoM), top 5 narrative signals ≥ P2, new grade downgrades, active FDI threats, open commitments > 30 days.
2. Compose McKinsey pyramid prompt with strict Zod output schema `{ situation, complication, question, recommendation, citations[] }`.
3. Gemini via `createLovableAiGatewayProvider` with `structuredOutputs`, `google/gemini-3.5-flash`.
4. Persist to `cabinet_brief_cache`; render via `CitedMarkdown`.
5. Optional `/api/public/hooks/cabinet-brief` cron endpoint for pg_cron (HMAC-verified) — later.

## Rollout

1. **Data layer** — new server functions + `cabinet_brief_cache` migration with grants + RLS.
2. **Primitives** — `ReadinessRing`, `PostureBadge`, `ImpactBar`, `EvidenceChips`.
3. **Situation Hero + State of Nation brief** (replaces current stat strip).
4. **Situation Board** (wire existing viz components; no new charts).
5. **Decision Queue** (replaces "Signals awaiting a session").
6. **Ministry Readiness Matrix + Ministry Drawer**.
7. **Commitments Cockpit** (replaces Register flat table).
8. **Session Timeline + Sessions tab upgrade**.
9. **Agenda + Session Mode polish**.
10. **Auto-brief cron endpoint** (optional final step).

Each step is shippable on its own; the Room becomes noticeably better after step 3 and prime-time by step 7.

## Out of scope (call out explicitly)

- No changes to auth, RLS helpers, or existing chamber routes.
- No new chart libraries — reuse `src/components/viz/*` and `src/components/scenarios/*`.
- No mobile-specific redesign in this pass (desktop-first, responsive down to tablet).

Approve and I'll build in the order above, starting with the data layer + primitives + Situation Hero so you see a visible lift on the first commit.
