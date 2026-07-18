
# Chamber 06 — The Cabinet Room

Today, Chamber 06 points at `/instrument/cabinet`, a legacy cross-country page with a plain list of sessions + a commitments dropdown, plus a separate Session Mode (dark slideshow) and a Decisions register. It is not country-scoped like Chambers 01–05, has no agenda, no minutes, no attendance, no linkage to Ledger/Scenarios/Narrative, and no cabinet-grade UI. We rebuild it as the sovereign decision theatre where evidence turns into a signed decision with owners, dates, and a paper trail.

## Guiding POV (sovereign PM lens)

A Prime Minister comes to Cabinet to (1) know what's on today, (2) see the evidence behind each item, (3) make a decision fast, (4) leave with named owners and dates, (5) trust the record. Every feature below serves that loop.

## Route architecture

New country-scoped chamber matching Chambers 01–05:

```text
/admin/countries/$code/cabinet                → Room (dashboard)
/admin/countries/$code/cabinet/agenda/$sid    → Agenda builder for a session
/admin/countries/$code/cabinet/session/$sid   → Session Mode (present + record live)
/admin/countries/$code/cabinet/minutes/$sid   → Minutes + signed export
/admin/countries/$code/cabinet/register       → Decisions + Commitments register
```

`ChambersLauncher` Chamber 06 tile re-points to `/admin/countries/$code/cabinet` (params, not search). Legacy `/instrument/cabinet*` routes stay as thin redirects so existing links don't 404.

## The Room (landing dashboard)

Ceremonial header (same visual grammar as Ledger): country crest, live clock, "as-of" strip. Below, a 4-rail cabinet-grade layout:

1. **Next Session rail** — date, classification, attendee count, agenda-readiness meter (% of items with dossier + recommendation attached). Primary action: *Enter Session Mode*.
2. **Commitments Heat** — status treemap (Open / In-progress / Delivered / Blocked / Cancelled) sized by count, colored by overdue-risk. Click a tile → filtered register.
3. **Decisions velocity** — 12-week sparkline of decisions recorded, with a "time-to-decision" median chip.
4. **Signals inbox** — auto-pulled unresolved items from other chambers ready for cabinet attention:
   - Narrative P1/P2 stories not yet triaged
   - Studio strategies awaiting sign-off
   - Scenario runs flagged "promote to policy"
   - Ledger grade downgrades (from `grade_alerts`)
   Each row has a one-click **"Add to next agenda"**.

## The Agenda Builder

Drag-orderable list of agenda items. Each item is a first-class object with:

- Title, sponsor (minister), classification (`public / restricted / secret`)
- **Evidence dossier**: attach Ledger snapshots, Scenario runs, Studio strategy IDs, Narrative statements, Sector dossiers, KPIs. All become citations on the resulting decision.
- **Recommendation**: single "the ask" line + suggested motion text (Approve / Note / Refer back / Defer).
- **Time box** (minutes).
- **Auto-brief** button → Lovable AI Gateway (Gemini) generates a 120-word McKinsey-style brief from the attached evidence, editable, saved to the item.

Readiness meter turns green only when title + sponsor + dossier + recommendation are all present.

## Session Mode (the theatre)

Full-screen dark UI, keyboard-driven, one item at a time. Left rail: agenda progress. Center: the item — brief, evidence tiles, live KPIs. Right rail: **live capture**:

- Motion selector (Approve / Note / Refer / Defer)
- Vote tally (for / against / abstain) with attendee chips
- Decision text (auto-drafted from the recommendation, editable)
- Commitments composer (title, owner minister, due date, success metric) — add multiple, hit Enter to save
- Timer that started when the item opened → contributes to time-to-decision analytics

On item close, everything writes to `decisions` + `commitments` atomically and the timer stops. Escape exits, resumable — the session is a durable record, not a slideshow.

## Minutes & signed export

Auto-generated the moment the session closes:

- Header (country, date, classification, attendees, quorum)
- Per-item block: brief, evidence citations (from dossier), motion, vote, decision text, commitments
- Chair sign-off block (typed name + timestamp; PDF via existing `renderDocument`)
- Distribution list with per-recipient classification redaction (secret items stripped for public copy)

## Decisions + Commitments register

Unified table with filters (status, minister, sector, session, date range) and full-text search. Each row expands to show the originating session, evidence citations, and current commitment status. Bulk export to CSV / PDF. Overdue commitments get a red pill and appear in the Room's Signals inbox next cycle.

## High-value interactive features (ranked)

1. **Signals inbox → one-click agenda** — collapses the whole "who should we hear from today" question.
2. **Auto-brief from attached evidence** — cuts brief-prep from hours to a minute; every claim already cited.
3. **Session Mode live capture** — decision + commitments recorded *in* the meeting, not reconstructed after.
4. **Readiness meter** — no item enters Cabinet under-baked; forces discipline upstream.
5. **Time-to-decision analytics** — measurable cabinet performance metric.
6. **Classification-aware distribution** — one session produces public and restricted minutes without a second edit pass.
7. **Cross-chamber deep links** — every evidence chip in a decision jumps back to the exact Ledger figure / Scenario run / Narrative statement.
8. **Commitments accountability loop** — overdue commitments auto-resurface in next Room view; ministers see their own overdue list first.

## Data model (mostly reuses existing tables)

Existing: `cabinet_sessions`, `decisions`, `commitments`, `figure_snapshots`, `citations`, `grade_alerts`, `scenarios`, `fdi_strategies`, `comms_artifacts`.

Additions (single migration, with GRANTs + RLS scoped via `has_country_access`):
- `cabinet_agenda_items` — `id, session_id, country_code, ordinal, title, sponsor_ministry_id, classification, time_box_min, recommendation, motion_kind, brief_md, dossier jsonb, readiness_score, created_at`
- `cabinet_attendance` — `session_id, attendee_name, role, present bool, is_chair`
- `cabinet_votes` — `agenda_item_id, for_count, against_count, abstain_count, notes`
- `decisions` gets nullable `agenda_item_id`, `motion_kind`, `classification`, `decision_ts`, `duration_sec`
- `commitments` gets nullable `agenda_item_id`, `success_metric`, `sector_code`

## Server functions (`src/lib/cabinet.functions.ts`, new)

`getRoomOverview`, `listAgenda`, `saveAgendaItem`, `reorderAgenda`, `generateAgendaBrief` (Lovable AI Gateway), `getSessionLive`, `recordAgendaOutcome` (atomic decision+votes+commitments), `closeSession` (locks minutes), `getMinutes`, `listRegister`, `signalsInbox` (cross-chamber query). All `.middleware([requireSupabaseAuth])`, RLS scoped by country.

## Components (`src/components/cabinet/`)

`CabinetHeader`, `NextSessionCard`, `CommitmentsHeat`, `DecisionsSparkline`, `SignalsInbox`, `AgendaBuilder` (dnd-kit — already in deps if present, else lightweight up/down), `AgendaItemEditor`, `EvidenceDossierPicker`, `AutoBriefButton`, `SessionStage`, `LiveCaptureRail`, `MinutesDocument`, `RegisterTable`.

## Rollout

1. Migration + `cabinet.functions.ts` + Signals inbox query.
2. Country-scoped Room dashboard + repoint launcher tile + legacy redirects.
3. Agenda builder + evidence picker + auto-brief.
4. Session Mode live capture + atomic outcome write.
5. Minutes generator + signed PDF export via existing `renderDocument`.
6. Register (decisions + commitments unified) with filters/search/export.

Each step is a working slice; the chamber is usable after step 2 and becomes a full decision theatre by step 4.
