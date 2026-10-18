# Guaranteed P1 GDP and P1 political story per country, every scan

## Rule
After every media scan, full or single-country, each covered country must have at least:
- one **P1 GDP/economy** story, and
- one **P1 political** story.

If the normal scoring already gives a P1 in that topic, nothing changes. If not, the system looks through the country's live stories (last 30 days) **in order: P2, then P3, then P4**. It takes the most important match (highest importance score, then newest) and raises it to P1. P5 Noise and stories marked Noise, Duplicate or Dismissed are never raised.

A single story that is both political and GDP can satisfy both. If a country has no matching story anywhere from P2 to P4, it is flagged as a **coverage gap** and does not get a made-up P1.

## What admins see
- Raised stories carry a **"P1 · Guaranteed"** badge. The explanation names the original level, e.g. "Raised from P3: top GDP story for Dominica this scan."
- The Media Scan page gets a new column, **P1 GDP / P1 Politics**, per country, with a tick, "raised" or "gap". It also gets a "Gaps after last scan" count, and the run summary lists raised and gap countries.
- The Narrative Chamber P1 tiles and counts include raised stories, and filters match.
- Partner API/MCP media signals report P1 for raised stories, plus a `priority_raised_from` field.

## When it runs
At the end of every run: the hourly scan, "Run full scan now", a per-country "Run now", and the shared outlet scan. It also runs once now as a backfill, so every country is covered straight away.

## Technical details
- Migration: add `priority_override smallint` (1 = forced P1), `priority_raised_from smallint` and `priority_raised_reason text` on `intake_items`. Update SQL `narrative_priority_level` callers (`narrative_priority_counts`, `narrative_signal_ids_at_priority`) to use `coalesce(priority_override, narrative_priority_level(...))`.
- New pure module `src/lib/narrative-p1-guarantee.ts`: `pickGuaranteedP1(signals, topic)` scans levels [2, 3, 4] in order and sorts by `priority_score` desc, then `created_at` desc. Tests cover: an existing P1 means no raise; P2 is preferred over a higher-scored P3; a P5 is never raised; one dual-topic story covers both topics; no candidates means a gap.
- New `enforceP1Guarantee(countryCodes)` in `src/lib/press-tick.server.ts` runs after the promotion step. Per country and topic, it first clears earlier overrides only if a natural P1 now exists. Results go into `narrative_harvest_runs` as `p1_guarantee` jsonb.
- `priorityFor` in `narrative-priority.ts` and `priorityLevel` in `public-data/media.ts` honour the override. Register an `<Explain>` entry for the guarantee rule.
- `coverageReport` adds `p1_gdp` and `p1_political` states. Run `bun run headers && bun run map` afterwards.
