# Narrative Chamber – De-dup, Prioritized Ingest, Mobile UI

## Current state (verified)

- **Cron is live.** `cron.job` shows `narrative-press-tick-morning` (07:00 UTC), `narrative-press-tick-evening` (19:00 UTC), plus `narrative-harvest-hourly` (:15) and `narrative-press-discover-weekly`. Twice-a-day promise is met.
- **URL-level dedup already exists** in `press-tick.server.ts` (`canonicalUrl` + `feed_id,guid_hash` unique). What it does **not** catch is the real problem: multiple outlets syndicating the *same story* with different URLs and near-identical titles.
- **Example (ATG, last tick):** 5 rows about "Antigua & Barbuda Tourism Authority appoints new CMO Charmaine Spencer" all promoted as separate signals — different Google News URLs, different titles, one theme. Same happened with 3 Venezuela-earthquake variants in the screenshot.
- **Priority ordering** on the rail is correct today (P1→P5 grouped), but the *ingest order* isn't priority-aware, and inside P1 rows are unsorted, so three near-duplicates sit stacked at the top.
- **Mobile UI:** `SignalRow` uses `line-clamp-2` + `flex-wrap` on chips, but on ≤400px the pill row, LEAD chip, and meta row wrap awkwardly and the border-l-4 + px-3 leaves ~15ch of usable width. The screenshot shows overflow on the meta line and cramped chip stacking.

## Plan

### 1. Story-cluster dedup (semantic, not URL)

Add a `story_key` column on `intake_items` that groups syndicated coverage into one canonical signal, with sibling articles attached as evidence rather than promoted as separate cards.

**Schema (one migration):**
```sql
ALTER TABLE intake_items
  ADD COLUMN IF NOT EXISTS story_key text,
  ADD COLUMN IF NOT EXISTS story_primary boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS duplicate_of uuid REFERENCES intake_items(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS intake_items_story_idx
  ON intake_items (scope_key, story_key) WHERE story_key IS NOT NULL;
```

**Clustering algorithm (in `press-tick.server.ts`, before insert):**
1. **Normalize title** → strip outlet suffix (`" - Reuters"`), lowercase, remove stopwords, keep entities/nouns.
2. **Build a MinHash / trigram shingle** of `normalized_title + top-3 entities` (country, org, person). Cheap, deterministic, no AI call needed.
3. **Compute `story_key`** = 12-char hash of the shingle set OR reuse an existing key when trigram similarity to a recent same-country item (last 72h) ≥ 0.72. Query the small candidate set (last 72h, same scope_key) — indexed, ~100 rows.
4. **On tick classification:**
   - If `story_key` is new → insert as primary signal (`story_primary=true`).
   - If it matches an existing cluster → insert with `duplicate_of` set, `story_primary=false`, and append the URL + outlet to the primary's `metadata.related_coverage[]` (bump `reach` by +1, cap 5).
5. **AI tiebreaker only for ambiguous cases** (similarity 0.55–0.72): one Gemini Flash call per tick, batched, returns `same_story: bool`. Keeps cost negligible.

**Result:** the 5 CMO articles collapse to 1 primary card with a "5 outlets covering" badge; the 3 Venezuela earthquake stories become 1 P1 signal with 3 sources.

### 2. Priority-first ingest ordering

Currently `toClassify` is ordered by fetched_at DESC. Change to:
1. Classify all first (unchanged).
2. **After classify**, sort insert order by derived P-level (via `priorityFor()` in `narrative-priority.ts`), so P1 rows land first and race conditions can't demote them.
3. Within the triage rail, add a secondary sort inside each P-group: newest first + suppress cluster siblings.

### 3. Rail-side changes

- `listSignals` in `narrative-chamber.functions.ts` → filter `story_primary = true OR story_key IS NULL` by default; add a "Show variants" expander on each card that reveals `related_coverage[]`.
- `SignalTriageRail` counters recompute against primaries only.
- Add a small "N sources" pill next to LEAD/AMPLIFY chip when `related_coverage.length > 0`.

### 4. Mobile-first triage card redesign

Rewrite `SignalRow.tsx` for a 320–420px column:
- Two-line max header: **PriorityPill** on line 1 (full-width, no wrap), recommendation chip right-aligned as a compact dot+letter (L/A/M/C).
- Title on line 2, `line-clamp-3`, `text-[13px] leading-snug`.
- Meta row becomes a single line of monochrome tokens separated by `·`: `INT · TOURISM · S5 R4 −2` — truncated with `overflow-hidden text-ellipsis whitespace-nowrap`, full detail available on hover/tap via a `HoverCard`.
- Sources pill (`+4`) appears inline when clustered.
- Border-l-4 stays; drop px-3 → px-2.5, py-2 → py-2.
- Group headers become sticky (`sticky top-0`) inside the scroll container so P-level context follows the user.

### 5. Verification

- After migration, backfill: run the clustering pass on last 7 days of `intake_items` in a one-shot server fn to consolidate the existing duplicates already visible in the UI.
- Add a small `narrative_harvest_runs.coverage.clusters_merged` counter so each cron tick reports how many duplicates it collapsed.
- Manually trigger a tick from the Radar and confirm the CMO cluster shows as one primary card with 4 siblings.

## Technical notes

- Trigram similarity via `pg_trgm` (`similarity(a, b)`) is already available on Supabase; no new extension.
- The AI tiebreaker uses the existing Lovable AI Gateway (Gemini Flash), one batched call per tick, capped at 20 pairs.
- No changes to cron schedule or public route; all logic lives in `press-tick.server.ts` and one new `story-cluster.server.ts` helper.
- Backfill server fn is admin-gated via `requireSupabaseAuth` + `has_role('admin')`.
