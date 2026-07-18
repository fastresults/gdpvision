# Comms Library — Guided Experience Plan

Today the Library is a raw list + detail view: search, filters, and a document previewer. Diplomats using this daily don't need "another file browser" — they need a **workflow surface** that tells them what needs their attention, walks them through review → approval → release, and makes reuse of past drafts effortless.

## What's wrong today

1. Cold open — no orientation, no next-best-action. New drafts, drafts stuck in review, and released items all look the same.
2. State pills are filters, not a workflow. There is no visible path `draft → review → approved → released`.
3. Approvals/history exist as tabs but the user is never *prompted* to advance the document.
4. Search is manual; there are no saved views, no "my drafts", no "stale in review > 3 days".
5. Templates are just a `★` badge — no way to *start from template*, no gallery, no reuse flow.
6. Detail view is read-mostly. Duplicate/download/delete are buried; approve/release/schedule don't exist as first-class actions.
7. No connection back to the originating Signal / Strategy — the diplomat loses the "why" behind each artifact.

## Guided experience — the plan

### 1. Library home = a dashboard, not a list

Replace the current header strip with a **triage header** showing 4 smart-view cards. Clicking a card applies the underlying filter set to the list below.

```text
┌──────────────┬──────────────┬──────────────┬──────────────┐
│ NEEDS YOU    │ IN REVIEW    │ SCHEDULED    │ RECENTLY     │
│ 3 drafts     │ 2 · 1 stale  │ 1 today      │ RELEASED (7) │
│ awaiting     │ >3 days      │              │              │
│ your action  │              │              │              │
└──────────────┴──────────────┴──────────────┴──────────────┘
```

Smart views computed client-side from existing fields: `draft_state`, `updated_at`, `released_at`, `approvals[]`, `scheduled_for` (new, optional).

### 2. A visible workflow rail on every artifact

Replace the flat state pill in the detail header with a 4-step tracker + primary CTA that always tells the user the next action:

```text
[Draft] ──► [Review] ──► [Approved] ──► [Released]
                ▲ you are here
    ┌────────────────────────────────────────────┐
    │  Next: request approval from Comms Lead    │
    │              [ Send for approval ]         │
    └────────────────────────────────────────────┘
```

- Primary CTA changes by state: `Send for review` / `Approve` / `Schedule or Release now` / `Archive`.
- Secondary actions (Duplicate, Download, Delete, Save as template) collapse into an overflow menu.
- Each transition writes an entry into `approvals[]` (already a jsonb array) with actor, timestamp, note.

### 3. Guided empty & first-time states

- Empty library: full-bleed coach card explaining what lands here, with two CTAs — "Draft from a Signal" (deep-link to Chamber 5 radar) and "Browse templates".
- Empty filter result: shows the *closest matches* (drop one filter at a time) instead of a dead end.
- First-time visitor (no `localStorage` flag): a 3-step "how the Library works" popover walkthrough — triage cards → workflow rail → templates.

### 4. Templates get a real home

- New "Templates" tab at the top of the Library page (sibling to the default "Drafts" view), showing only `is_template = true`, grouped by channel.
- Each template card has a **"Use template"** button that duplicates it into a new draft, opens the detail, and pre-fills title/tags — replacing today's manual duplicate-then-edit dance.
- In the detail view, add a one-click **"Save as template"** on released or approved artifacts.

### 5. Context ribbon — the "why"

Above the document body, show a compact ribbon:

```text
From signal:  "IMF Article IV — external buffer risk"   [open ↗]
Strategy:     Position #4 · Reassure investors           [open ↗]
Channel:      Press release · Audience: Investors
```

Wire from the existing `signal_id`, `strategy_id`, `channel`, `audience` fields already returned by `getCommsDetail`. Links deep-link back into Chamber 5 signal/strategy views. Restores the narrative thread that today's viewer strips out.

### 6. Search & saved views

- Add quick-chip presets above search: `Mine`, `This week`, `Awaiting approval`, `Released this month`.
- Persist last-used filter set in `localStorage` per country so returning users land where they left off.
- Keyboard: `/` focuses search, `j`/`k` move selection, `Enter` opens, `E` opens approval action. Show a one-line hint in the list header.

### 7. Approvals & schedule as first-class flows

- `Send for approval` opens a lightweight dialog: pick reviewer(s) from country team, optional note. Writes into `approvals[]`, moves state to `review`, banner on the reviewer's Library home surfaces it under "Needs you".
- `Approve` / `Request changes` dialog with required note; state advances.
- `Release` dialog offers **Release now** or **Schedule** (`scheduled_for` timestamp). Scheduled items appear in the "Scheduled" triage card and on a small calendar strip.

### 8. History tab becomes a real audit trail

Merge `comms_artifact_revisions` (already exists) with `approvals[]` entries into a single unified timeline: who did what, when, with diff-preview on body changes and a **Restore this version** action.

## Files to touch (technical)

- `src/routes/_authenticated/admin/countries.$code.narrative.library.tsx` — split into: `LibraryPage` (triage header + tabs), `TriageCards`, `TemplatesTab`, `SavedViewsBar`.
- `src/components/narrative/comms/` (new) — `WorkflowRail.tsx`, `ContextRibbon.tsx`, `ApprovalDialog.tsx`, `ScheduleDialog.tsx`, `UnifiedTimeline.tsx`, `TemplateCard.tsx`, `LibraryCoach.tsx`.
- `src/lib/narrative.functions.ts` — add `transitionCommsState`, `recordApprovalDecision`, `scheduleComms`, `restoreCommsRevision`, `saveAsTemplate`, `useTemplate`; extend `searchComms` with `smartView` param (`needs_you | in_review | scheduled | recently_released`).
- Schema (migration): add `scheduled_for timestamptz`, `assigned_reviewers uuid[]` on `comms_artifacts`; index on `(scope_key, draft_state, updated_at)` for smart-view queries. Keep RLS/grants aligned with existing policy.
- Deep-link helpers to Chamber 5 signal/strategy routes for the Context Ribbon.
- One-time coach uses `localStorage` key `comms-library-coach-seen-v1`.

## Out of scope

- No changes to Draft Studio generation logic.
- No changes to press-monitor / signal ingest.
- No new AI calls in this pass — guided UX first; AI-suggested next-actions can layer on later.

## Rollout

1. Ship schema migration + server function additions.
2. Ship WorkflowRail + ContextRibbon + overflow menu in detail view (immediate diplomat value).
3. Ship TriageCards + smart views + saved filter persistence.
4. Ship Templates tab + Save-as-template + Use-template flow.
5. Ship UnifiedTimeline + revision restore.
6. Ship first-run coach + keyboard shortcuts.
