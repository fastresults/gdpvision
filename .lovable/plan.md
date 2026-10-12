# Make the priority tiles count every signal, not just the newest 200

## What is happening

The P1–P5 tiles are tallied only from the 200 newest signals loaded on the page (1 + 6 + 25 + 135 + 33 = 200). The fix from earlier corrected the headline total (3,062) but not these tiles, so they still show the sample.

Checked against the database, Antigua's real totals are:

```text
            Shown now (newest 200)   All active signals
P1 Respond         1                       29
P2 Prepare         6                       82
P3 Amplify        25                      356
P4 Monitor       135                    2,254
P5 Noise          33                      341
Total            200                    3,062
```

So 28 "Respond now" signals are currently hidden from the rail.

## What will change

1. The P1–P5 tiles show the true count across all of Antigua's active signals.
2. Clicking a tile loads the signals at that level (newest first, up to 200), so P1 shows all 29 instead of 1.
3. A short note under the tiles explains what the list shows, e.g. "Showing newest 200 of 3,062. Choose a priority to see all of that level."
4. The radar, headline total and 200-row display cap stay as they are.

## Technical details

- New read-only database function `narrative_priority_counts(country_code)` (security invoker, so existing access rules apply) returning counts per level, using the same rules as `priorityFor` in `src/lib/narrative-priority.ts` (recommendation first, then severity/reach). Migration includes grant to `authenticated`.
- `listSignals` accepts an optional `priorityLevel` and returns `{ signals, total, priorityCounts }`; when a level is given, the row query applies the matching filters server-side.
- `SignalTriageRail` receives `priorityCounts` and an `onLevelChange`; both narrative routes pass the active level into the query key (bump to `with-total-v2`) and keep the existing defensive normalizer, falling back to client-side counts if `priorityCounts` is missing.
- Run `bun run headers && bun run map`; verify in the browser that tiles read 29 / 82 / 356 / 2,254 / 341 and P1 lists 29 signals.
