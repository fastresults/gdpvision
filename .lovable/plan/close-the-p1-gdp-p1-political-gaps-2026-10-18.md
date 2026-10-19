# Close the P1 GDP / P1 political gaps

## What causes the gaps
Twelve countries are short of a P1 story, and there are two reasons.

1. **Older stories were never tagged (main cause).** Almost every story from the last 30 days has no politics or GDP tag, because tagging only started with the recent scan update. Some examples:

   | Country | Stories (30 days) | Untagged |
   |---|---|---|
   | Antigua | 862 | 861 |
   | Trinidad | 609 | 609 |
   | Guadeloupe | 3,619 | 3,619 |
   | Suriname | 330 | 330 |

   The same is true for Barbados, Belize, Jamaica, Martinique and Haiti. The stories are there; the guarantee just can't see them.
2. **Too few sources.** Puerto Rico, St Martin and Sint Maarten each have only 1 story in 30 days.

## Recommended fix

### 1. Tag the backlog (fixes most gaps)
Run a one-off catch-up that tags every untagged story from the last 30 days with politics yes/no, GDP yes/no and government named yes/no.
- It works country by country, starting with the stories most likely to matter (P2, then P3, then P4), so gaps close first.
- Each country stops early once it has a political and a GDP candidate. A second pass then finishes the rest of the backlog.
- It uses a fast, low-cost AI model in batches of about 40 headlines and summaries. About 11,000 stories in total. Scores and P-levels are not changed.

### 2. Keyword safety net
Add a backup tagger that is used whenever the AI is unavailable or out of quota. It catches political terms (Prime Minister, Parliament, election, minister, opposition, party names) and economic terms (GDP, budget, inflation, IMF, debt, investment, tourism arrivals, central bank) in English, French, Dutch and Spanish. This means no future story stays untagged.

### 3. Grow coverage for thin countries
For Puerto Rico, St Martin, Sint Maarten, Haiti and Suriname:
- run the outlet finder automatically;
- link the shared regional outlets to them.

The daily self-repair will treat "no political or GDP story in 7 days" as a reason to look for more outlets.

### 4. Close the loop
Re-run the guarantee straight after the backfill. Then show a **Gaps** counter with a **Fix gaps** button on the Media Scan page. The button does the tagging, outlet search and guarantee for just the gap countries.

## Expected result
After steps 1 and 2, about 9 of the 12 gaps should close. The tiny new countries close as their sources grow. Any gap that remains reflects a real lack of coverage, not missing tags.

## Technical details
- `src/lib/narrative-retag.server.ts`: `retagBacklog({ countries?, stopWhenCovered })` selects untagged items (`is_political IS NULL`) ordered by natural level and then `priority_score`. It classifies through the existing classifier path (Lovable AI Gateway, current flash model) and writes `is_political`, `is_economic`, `mentions_government` and `tags`.
- `src/lib/narrative-keyword-tags.ts`: a pure multilingual keyword tagger with tests. It is the fallback inside `press-tick.server.ts` and the retag job.
- A new admin server function, `fixMediaGaps`, in `media-scan.functions.ts`, behind the scan lock. It runs retag, then `discoverForCountry`, then `enforceP1Guarantee`.
- `press-discover` daily: add a topic-gap trigger.
