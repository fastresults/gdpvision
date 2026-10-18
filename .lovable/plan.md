# Narrative Chamber media scan — what exists and what is missing

## What exists today

- **Hourly scan of all countries.** A scheduled routine reads every active news feed across all countries, then sends new articles to AI for scoring.
- **Coverage:** 22 countries, 342 active feeds (148 local, 136 regional, 58 international). Another 391 feeds are switched off after repeated failures. Coverage is uneven: Saint Lucia has 6 feeds, Haiti, Suriname, St Vincent and the BVI have 7 each, and Dominica has 33.
- **Self-repair:** each day, broken feeds are checked again, and any country with fewer than 4 local feeds gets an automatic search for new outlets.
- **AI scoring per article:** local, regional or international; sector; severity 1–5; reach 1–5; sentiment; recommended response (lead, counter, amplify, monitor, ignore); summary and source links.
- **Priority P1–P5** comes from that scoring, sorted by urgency. There is also a 30-day window, pin and flag, and merging of repeated stories.
- **Run controls exist only per country:** a "Run now" button on each country's Narrative page, plus "find sources" and "revive feeds".

## What is missing

1. **Caribbean countries not covered.** The country list has no Dominican Republic, Cuba, Puerto Rico, Aruba, Curaçao, Sint Maarten, St Martin, St Barths, Bonaire or the US Virgin Islands. Articles about them are never collected.
2. **No full list of regional and international outlets.** No checked list exists for CARICOM-wide or international outlets (e.g. Caribbean Media Corporation, Loop, CNW, Caribbean Business Report, Reuters/Bloomberg Caribbean, IMF/CDB news). ME Daily isn't confirmed as a source. Regional feeds are added per country, not shared across all countries.
3. **No subject focus.** The scan collects everything. Nothing checks that an article is about politics, GDP or the economy before scoring it.
4. **One country per article.** Each article belongs to a single country. A regional story about five islands can't be tagged with all five.
5. **No politics/GDP tags.** Articles carry a sector, but no "politics", "GDP/economy" or "country name" tags you can filter by.
6. **Links aren't verified.** The article link is stored but never checked to confirm it opens and matches the story.
7. **The priority formula is simple.** It uses only the recommendation, severity and reach. Source credibility, how many outlets carry the story, politics/GDP relevance and naming of the government or a minister play no part.
8. **No Super Admin control centre.** Nowhere can you run the scan for all countries at once, see per-country coverage gaps, or manage the shared regional and international outlets.

## Proposed build (for approval)

1. Add the missing Caribbean countries to the media scan only, without full onboarding. Then search for outlets for each one.
2. Add a shared list of regional and international outlets (ME Daily included, if its feed can be found). Every article from these outlets is matched to every country it mentions.
3. Tag each article with its countries, politics yes/no, GDP/economy yes/no, and topic tags. Skip articles that touch none of the countries, politics or the economy.
4. Check each link when the article is collected. Mark it verified, redirected or broken, and show a badge.
5. Use a new weighted priority score, with every factor explained on screen:
   - urgency and reach (existing)
   - politics/GDP relevance
   - source credibility (national, regional, international)
   - story spread (how many outlets carry it)
   - government or minister named
   - freshness
6. Add a Super Admin "Media Scan" page with:
   - "Run full scan now" for all countries, or one country
   - live progress and the last run's results
   - coverage per country, with thin countries highlighted
   - shared outlets list
   - feed health

## Technical details

- New tables: `narrative_outlets` (shared regional and international outlets) and `intake_item_countries` (links one article to many countries), each with access rules. New columns on `intake_items`: `tags`, `is_political`, `is_economic`, `link_status`, `link_checked_at`, `priority_score`, `priority_factors`.
- Media-only countries get a `countries.media_only` flag, so other chambers ignore them.
- The scorer prompt and output format gain countries mentioned, tags and the politics/economy flags. Link checks are capped and time-limited per run.
- The priority score is a pure function in `narrative-priority.ts`, with tests and a registered explanation. P-levels come from the score, and the 30-day cleanup is unchanged.
- The full scan runs in batches with a single-run lock, reusing `runPressTick` with no country filter. The new page is admin-only at `/admin/media-scan`, added to the Super Admin menu.
