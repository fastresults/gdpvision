# Media scan — source influence scoring and intuitive filters

## What the review found

- Every active feed has the same weight (1.00). A national newspaper of record counts the same as a small blog, and the score's "credibility" factor is just a guess from the website address.
- Volume over the last 30 days: about 124,000 articles read, and about 20,000 kept as signals (16%). There is no measure of which sources provide the useful ones.
- The signal list filters only by priority level, pinned or flagged, search text and sort order. You can't filter by country tag, Politics or GDP, source, source strength, link status or score.
- Nothing tracks how often a source publishes, how often its stories become P1–P2, or how often other outlets pick its stories up.

## 1. Source profile: reach, frequency and influence

Every source gets a profile that is worked out again each day from its own track record.

| Measure | What it means | Worked out from |
|---|---|---|
| Reach (1–5) | How big an audience it has | Audience tier set by the AI when the outlet is found, with an admin override |
| Frequency | Articles per day, and the share that are relevant | The last 30 days of collected articles |
| Hit rate | Share of its articles that became P1, P2 or P3 | The last 30 days of signals |
| Influence | How often other outlets later cover the same story | Story grouping (which outlets follow) |
| First to report | How often it breaks a story before others | First outlet in each story group |
| Accuracy | Share of its links that are verified and not later dismissed | Link checks plus admin dismissals |
| Health | Working, failing or switched off | Feed reads |

These combine into a **Source strength score (0–100)** and a **source tier**:

- S1: Agenda-setter
- S2: Major
- S3: Standard
- S4: Minor
- S5: Low value

The source strength score replaces the address-based credibility factor in each article's score. The P1–P5 rules stay the same.

## 2. Article score refinements

- Source strength replaces the guessed credibility.
- The spread factor counts outlets weighted by their strength, so ten minor blogs don't outweigh one major outlet.
- The importance explanation shows each source's contribution.

## 3. Filters on the Narrative Chamber signal list

One filter bar with removable chips:

- Priority P1–P5 (existing)
- Topic: Politics, GDP/economy, Both
- Countries mentioned, including stories shared with neighbours
- Source tier S1–S5, plus a filter for a single outlet
- Reach: local, regional, international
- Link: verified, redirected, broken
- Minimum score (slider)
- Only first-to-report sources
- Pinned or flagged (existing)

Filters are kept in the page address, so a filtered view can be shared or bookmarked. There are also saved presets:

- "Cabinet watch": P1–P2, Politics, S1–S2
- "Economic pulse": GDP, score of 60 or more
- "Regional echo": stories covering more than one country

## 4. Media Scan admin page additions

- **Sources tab**: every feed and outlet with reach, frequency, hit rate, influence, accuracy, tier and health. Sortable and filterable, with actions to boost, demote, pause and set reach.
- **Quality checks**:
  - sources that publish a lot but whose stories rarely become signals (candidates to pause)
  - high-tier sources that have gone silent
  - countries with no S1 or S2 source
  - share of broken links per source
- **Accuracy feedback**: when an admin dismisses a signal as noise, or confirms it, the source's accuracy updates.
- The coverage table gains "S1–S2 sources" and "P1–P2 found this week" for each country.

## Technical details

- New `narrative_source_stats` table, one row per feed and outlet: reach, frequency, relevance rate, P1–P3 rate, influence, first-to-report rate, accuracy, strength, tier, `computed_at`. Admin-only access rules.
- New columns:
  - on `narrative_feeds`: `reach_tier` and `admin_weight`
  - on `intake_items`: `source_feed_id` and `source_strength`
  - on `narrative_feed_items`: `source_feed_id`, already linked through `feed_id`
- A daily job (`/api/public/hooks/source-stats`) with a single-run lock recalculates stats in batches. Formulas are pure, tested and explained on screen.
- The harvester reads strength when scoring, falling back to the current credibility. The spread factor is weighted by strength.
- `listSignals` gains server-side filters for tags, countries, link status, source tier and minimum score, so counts stay exact beyond the newest 200. The filter state is a route search schema.
- A "Dismiss as noise" or "Confirmed" action on signals writes to the source's accuracy.
