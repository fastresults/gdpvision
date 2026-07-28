## Goal

On the Executive Brief (primary view) and the Chamber Room Sheet (secondary view), every line the Principal can see becomes clickable and opens the same popup modal instead of a dead row — with one clear onward action inside it.

## One modal, one anatomy

New `src/components/executive/DetailModal.tsx` (shadcn `Dialog`, ink/paper tokens, `btn-primary` / `btn-ghost`):

```text
CHAMBER 07 · PERSONA LAB            [ 7D AGO ]
─────────────────────────────────────────────
Headline (the item's own sentence, serif, large)
─────────────────────────────────────────────
WHY / DETAIL     reasoning chips or KPI context
ON RECORD        exact timestamp + owning office
─────────────────────────────────────────────
[ Open the room sheet ]   [ Enter the chamber ]
```

Driven by a small discriminated union `ExecutiveDetail`:
- `kpi` — label, value, tone, chamber, what the number counts
- `alert` — text, severity, the `because[]` arithmetic
- `activity` — movement line + exact date/time
- `due` — deliverable label, due date, owner, state
- `chamber` — full chamber summary (numbers + tempo + counts), used from the ledger table

State handled by a tiny `useDetail()` hook so each surface only does `onSelect(detail)`.

## What becomes clickable

Primary view (`ExecutiveDashboard`):
- `AttentionRail` rows → alert modal (currently navigate straight to the sheet; the sheet becomes a button inside the modal)
- `ChamberCard`: the three KPI cells and each hover activity line become clickable; the card body keeps navigating to the room sheet
- `ChamberLedgerTable` rows → chamber modal; individual KPI cells → kpi modal
- `DueLedger` rows → due modal
- `PrincipalMasthead` stats (GDP, Grade A/B, corpus freshness) → kpi modal

Secondary view (`ChamberSheet`):
- Macro band numbers → kpi modal
- `AwaitsList` items → alert modal (with the full `because` arithmetic)
- `DeliverablesTable`: the due row and every "Recent movement" line → due / activity modal
- `TempoPanel` stats → kpi modal (movements, since last, busiest)

Every previously-static row gets `<button>` semantics, keyboard focus ring, and `aria-haspopup="dialog"`; the modal restores focus on close. Modals are `print:hidden` and never block the existing print parity.

## Notes / trade-offs

- This is presentation-only: it uses the data the resolvers already return (`kpis`, `alerts`, `recent`, `next_due`, `tempo`). No schema, server-fn, or resolver changes.
- Because `ActivityLine` today is just `{ at, text }`, the activity modal shows the sentence, exact timestamp, chamber and owner — not a deep record view. If you want a movement to open the underlying row (the actual KPI, study, threat, or commitment), that needs the resolvers to carry an id/link per line — a follow-up phase I can do next.

## Files

- new `src/components/executive/DetailModal.tsx`, `src/components/executive/useDetail.ts`, detail types in `src/lib/executive/detail.ts`
- edit `ExecutiveDashboard.tsx`, `AttentionRail.tsx`, `ChamberCard.tsx`, `ChamberLedgerTable.tsx`, `DueLedger.tsx`, `PrincipalMasthead.tsx`, `KpiTriple.tsx`
- edit `chamber/ChamberSheet.tsx`, `chamber/AwaitsList.tsx`, `chamber/DeliverablesTable.tsx`, `chamber/TempoPanel.tsx`
