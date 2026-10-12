# Make the priority groups match the priority tiles

## What is happening

The tiles now count all 3,062 signals (P1 · 29), but the grouped list below still only holds the newest 200, so the "P1 · Respond now" heading says 1. The same tile and heading disagree, which reads as broken.

## What will change

1. **Urgent signals are always complete.** In the default Priority view, every P1 and P2 signal (29 + 82 today) is loaded from the full set and merged with the newest 200, so the P1 and P2 groups show all of them without clicking anything.
2. **Headings show "shown of total".** Each group heading reads, for example, "P3 · Amplify — 25 of 356", and matches its tile whenever everything is loaded ("P1 · Respond now — 29").
3. **"Show all" per group.** When a group holds fewer than its total (P3–P5), a "Show all 356" link under the group loads that level in full (newest 200 if larger), the same as clicking its tile.
4. The note under the tiles is reworded: "All urgent signals shown. Other levels show the newest; open a level to see all."

## Technical details

- `SignalTriageRail`: add a second `useQuery` calling `listSignalsAtPriority` with levels `[1, 2]` (key `["narrative-signals-at-priority", code, [1,2]]`); merge with `signals` deduped by id when no level is selected.
- Group header renders `rows.length` and `counts[lvl]` (`"N of M"` only when they differ); add a per-group "Show all" button that calls `toggleLevel(lvl)` when `rows.length < counts[lvl]`.
- No database or server changes; verify in the browser that the P1 heading reads 29 and P2 reads 82 on first load.
