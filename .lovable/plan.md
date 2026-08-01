## What exists already

The programme plan derived from the brief already writes real structure to the database: phases, milestones and deliverables, each with a title, optional owner (free text), dates, status and position. Nothing surfaces that structure as a working tracker — it is only read back into the discovery brief and the deck. There is no team roster, no assignment, no status changes after commit, and no view of what is late.

## What to build

A third control in the track row — **Project tracker** — sitting alongside Discovery brief and Presentation, opening an internal-only workspace over the programme. Internal-only: it never feeds the client dossier or deck, and it carries no staleness/regenerate half (nothing is generated; it is a live board).

```text
┌──────────────────┬─┐ ┌────────────────┬─┐ ┌──────────────────┐
│ 📄 Discovery brief│↻│ │ 🖵 Presentation │↻│ │ ☑ Project tracker │
└──────────────────┴─┘ └────────────────┴─┘ └──────────────────┘
```

Unlike the other two it appears as soon as a programme plan exists (the plan stage is committed), not after all four stages — tracking starts the day the plan lands.

### 1. Team roster

A short, editable list of people on the engagement: name, email, and a role drawn from a fixed vocabulary appropriate to survey and focus-group work — Engagement lead, Research director, Project manager, Field manager, Moderator, Recruiter, Analyst, Data/scripting, Translator, Client contact. Add, edit, remove. Roles matter because assignment lists are filtered by them (a moderator is offered for a focus-group session, a recruiter for participant quotas).

### 2. The board

Three grouped views over the same rows, switched by a small segmented control:

- **By phase** (default) — the plan's own phases, each listing its milestones with their deliverables nested. This is the operator's mental model and mirrors what the client was told.
- **By owner** — one column per team member plus "Unassigned", so load is visible at a glance.
- **What's due** — a flat, date-ordered list of everything open in the next 14 days plus everything overdue, overdue first.

Each row is one line: status dot, title, assignee chip, due date, and a kind tag on deliverables (report, topline, transcript, dataset, screener, etc.). Clicking a row opens a right-hand detail drawer with title, detail, assignee, dates, status, and a free-text note thread — no page navigation, no lost scroll position.

### 3. Statuses that fit fieldwork

`planned → in progress → blocked → done`, plus `cancelled`. Blocked requires a one-line reason, shown inline on the board in gold. Status is settable inline on the row (a small cycling control) and in the drawer.

### 4. Fieldwork-native additions

Two things a generic tracker misses and this work always needs:

- **Waves and sessions surface as tracker rows.** Survey waves and focus-group sessions already exist in the fieldwork stage; the tracker lists them read-only under their phase with their own dates and fill status, so the project manager sees "Wave 2 — 41/120 complete" beside the milestone it serves. Editing still happens in the fieldwork stage; the tracker links through.
- **Quota and instrument readiness chips** on the milestone that depends on them, so "Fieldwork opens" visibly waits on "Instruments approved".

### 5. Header strip

A single line above the board: programme title, client, span (start → end), days remaining, count of overdue items, and count of open items. That is the whole status report.

## Technical notes

**Schema (one migration, GRANTs + RLS in the same file, matching `has_country_access` policies used by the existing programme tables):**

- `programme_team` — `id`, `project_id`, `country_code`, `name`, `email`, `role`, `created_at`, `updated_at`.
- Add to `programme_milestones` and `programme_deliverables`: `assignee_id uuid` (FK → `programme_team`, `on delete set null`), `blocked_reason text`, `notes jsonb default '[]'` (append-only `{at, by, text}` entries). Existing `owner` text stays as the AI's derived suggestion and is shown as a hint when nothing is assigned.
- Status vocabulary enforced by a CHECK on the existing `status` columns.

**Code:**

- `src/lib/personas/programme-tracker.functions.ts` — `getProgrammeTracker` (one read returning plan, phases, milestones, deliverables, team, plus wave/session summaries), `upsertTeamMember`, `removeTeamMember`, `updateTrackerItem` (assignee/status/dates/blocked reason), `appendTrackerNote`. All `.middleware([requireSupabaseAuth])`, called from components via `useServerFn` + `useQuery`. Header docblock with `@domain/@tables/@ui`.
- `src/components/personas/field/tracker/` — `TrackerModal.tsx` (shell + header strip), `TrackerBoard.tsx` (three groupings), `TrackerRow.tsx`, `ItemDrawer.tsx`, `TeamRoster.tsx`. Buttons use `btn-*` utilities; any JSON shown uses `<PrettyJson>`; no inline colour classes.
- Track row: a plain `btn-secondary` button (not `SplitAction`, since there is nothing to regenerate) rendered in the `TrackTabs` `actions` slot in `countries.$code.personas.field.$step.tsx`, gated on `progress.planCommitted` rather than the four-stage dossier gate.
- Invalidation: mutations invalidate `["programme-tracker", projectId]`; nothing touches the briefing or deck query keys, keeping internal state out of client outputs.
- Run `bun run headers && bun run map` after adding the server-fn module and migration.
