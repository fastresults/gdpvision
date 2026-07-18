## Goal
Make the Active Signals rail in Chamber 05 scannable and triage-first: introduce a 5-level response priority, surface it visibly, and let the admin sort and search the list.

## 1. Priority model (5 levels)
Derive a **response priority** for every signal from what we already store — no schema change needed.

| Level | Label | Color | Meaning |
|---|---|---|---|
| P1 | Respond now | rose | `recommendation` ∈ {lead, counter} AND (severity ≥ 4 OR reach ≥ 4) |
| P2 | Prepare response | amber | `recommendation` ∈ {lead, counter} otherwise, OR amplify with severity ≥ 4 |
| P3 | Amplify | emerald | `recommendation` = amplify |
| P4 | Monitor | slate | `recommendation` = monitor |
| P5 | Ignore/Noise | muted | `recommendation` = ignore or null with severity ≤ 1 |

Computed in a shared helper `src/lib/narrative-priority.ts` → `priorityFor(signal): { level: 1..5, label, tone }`. Also produces a numeric `priorityScore` (level * 100 + severity*10 + reach + recency-bonus) used for default sort.

Note: tuning the classifier prompt to emit these levels directly is a follow-up; deriving keeps this shipable without re-harvesting.

## 2. Sidebar UI (`countries.$code.narrative.tsx` + `SignalRow.tsx`)
Replace the current flat list with a triage-first rail:

- **Search box** — filters by topic/summary/sector_code/url (client-side, no server round-trip).
- **Sort dropdown** — Priority (default) · Newest · Severity · Reach · Sentiment.
- **Priority filter chips** — P1..P5 toggleable; counts per level shown in chip.
- **Grouped rendering** — collapsible sections per priority level (P1 expanded by default), each with a colored left border matching the tone. Counts in section header.
- **SignalRow** gains a leading `PriorityPill` (e.g. `P1 · Respond now`) that replaces the current recommendation chip position; recommendation stays as secondary metadata.

State (search, sort, expanded levels, active priority filter) lives in URL search params on the narrative layout route via `validateSearch` with `fallback`, so it survives refresh and deep links.

## 3. Detail page + Signal Radar
- `signal.$id.tsx` header shows the same `PriorityPill`.
- Signal Radar page (`countries.$code.narrative.index.tsx`) adds a 5-tile **Priority mix** strip above the existing Rec mix, using the same helper.

## 4. Files touched
- new: `src/lib/narrative-priority.ts`, `src/components/narrative/PriorityPill.tsx`, `src/components/narrative/SignalTriageRail.tsx`
- edit: `src/components/narrative/SignalRow.tsx` (add pill, keep recommendation chip smaller)
- edit: `src/routes/_authenticated/admin/countries.$code.narrative.tsx` (replace inline list with `SignalTriageRail`, wire `validateSearch`)
- edit: `src/routes/_authenticated/admin/countries.$code.narrative.index.tsx` (Priority mix strip)
- edit: `src/routes/_authenticated/admin/countries.$code.narrative.signal.$id.tsx` (pill in header)

## 5. Out of scope (call out, don't build yet)
- Persisting a priority column on `intake_items` and teaching the AI classifier to emit it directly — worth doing later so priority reflects nuance the derivation can't see, but not required for this UX shift.
- Bulk actions (mark handled, mute source) from the rail.
