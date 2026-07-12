## Goal
Make the "Refresh from AI" review dialog readable and scannable. Right now the modal panel is transparent (the page bleeds through) and the diff is a dense two-column blur — an admin can't tell what will change per ministry.

## Fix modal chrome
- Replace the hand-rolled `fixed inset-0 … bg-cream-50` overlay in `MinistryReviewDialog` with the project's shadcn `Dialog` primitives (`Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`, `DialogFooter`) from `@/components/ui/dialog`. That gives an opaque theme surface, backdrop, focus trap, and Escape-to-close for free.
- `DialogContent` sized `max-w-4xl` / `max-h-[85vh]` with a scrollable body between a sticky header (title + summary strip) and a sticky footer (Cancel / Commit buttons) — so the actions never scroll out of view.
- Apply the same fix to `MinisterEditDialog` (same bug — transparent panel).

## Redesign the diff
Per ministry, one card. Header row: ministry name + right-aligned summary (e.g. "3 → 2 programmes · minister changed"). Body: one row per field.

```
┌─ Ministry of Finance                              minister changed · 3 → 2 programmes ─┐
│  Minister    —                                →   Philip J. Pierre                     │
│  Title       —                                →   Prime Minister & Minister of Finance │
│  Party       —                                →   Saint Lucia Labour Party             │
│  Appointed   —                                →   2021-07-28                           │
│  Portrait    —                                →   [thumb 32×40]                        │
│  Email       —                                →   pm.office@govt.lc                    │
│  Phone       —                                →   +1-758-468-2101                      │
│  Website     —                                →   govt.lc/ministries/finance           │
│  Bio         —                                →   Attorney and long-serving MP for…    │
│  Mandate     Lead macroeconomic policy…       →   Lead macroeconomic policy…           │
│  Programmes  3 items ▸                        →   2 items ▸                            │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

Field-row rules:
- Grid: `label | current | arrow | new` with `label` and arrow columns narrow, current/new equal width.
- Unchanged rows render in `text-ink-400` so the eye jumps to real changes.
- Changed rows: new-value cell gets a subtle `bg-emerald-50/60` tint and darker text.
- Empty values render as `—` in `text-ink-300`.
- Portrait row: 32×40 thumb per side.
- Bio: `line-clamp-2` with a per-row "Show more" toggle.
- Mandate: same truncation.
- Programmes: `<details>` showing name + status per programme.

Ministries with no field-level changes collapse to a single grey line: "Ministry of X · no changes" — no card body rendered.

## Summary strip (top of dialog body)
One horizontal row of counts derived from the diff:
- `X of Y ministries changed`
- `N new minister names`
- `M new contact records` (any contact field newly populated)
- `K citations attached`

## Files
- Edit `src/routes/_authenticated/admin/countries.$code.data.tsx`:
  - Rewrite `MinistryReviewDialog` using shadcn `Dialog`, add `diffMinistry(current, entry)` helper that returns `{ changed: boolean, rows: Array<{label, before, after, isChanged, kind}> }`, render summary + per-ministry cards.
  - Wrap `MinisterEditDialog` in the same `Dialog` primitives (kill the hand-rolled overlay).

## Out of scope
- No agent, commit, or data-model changes.
- No per-ministry selective commit (still all-or-nothing).
- No inline editing inside the review — admins keep using the per-card "Edit" after commit.
