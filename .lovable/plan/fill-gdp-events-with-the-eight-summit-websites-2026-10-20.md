# Fill GDP Events with the eight summit websites

## What we're adding
Each summit website already has its own name, dates and description:

| Summit | Dates | Website |
|---|---|---|
| Caribbean Blue Economy Summit | Oct 22–23, 2026 (AUA Conference Center, Antigua) | blue-economy.gdpvision.com |
| CGDPS '26, Caribbean GDP Summit | Nov 11–12, 2026 | gdp-event.gdpvision.com |
| CADIS, AI & Digital Infrastructure | Nov 26–27, 2026 | cadis.gdpvision.com |
| CHIS '27, Housing & Infrastructure | Feb 11–12, 2027 | housing.gdpvision.com |
| CAFS, Agriculture & Food Sovereignty | Mar 18–19, 2027 | agriculture.gdpvision.com |
| CEIS '27, Energy & Infrastructure | Jun 17–19, 2027 | energy.gdpvision.com |
| CBIS '27, Business & Industry | Sep 28–29, 2027 | commerce.gdpvision.com |
| CHWIS '27, Health, Wellness & Innovation | date to be confirmed from the site | health.gdpvision.com |

## Recommended approach: the summit websites are the source of truth
1. **Import once from each website.** For each site, read the name, dates, venue, description, agenda, speakers and main photo. Anything a site doesn't state stays blank. Nothing gets made up.
2. **Link back to the summit website.** Each event page gets a "Visit summit site" button. Registration stays on GDP Events unless a site already has its own sign-up; in that case the button goes to that sign-up instead.
3. **Connect to the Chambers and Second Brain.** Each summit is matched to its sector (energy, housing, health and so on) so its page shows related Chambers, indexes and briefings.
4. **Remove the four sample events.** They are retired so only real summits show.
5. **You review before anything goes live.** Imported events are saved as drafts in Admin → Events. You check them and press Publish.
6. **Keep the events up to date.** A "Refresh from site" button in Admin → Events re-reads a summit's website and shows what changed before saving.

## Technical details
- An admin-only action reads each site's page details and visible text, uses AI to pull out the agenda and speakers, and keeps the website address on every imported item.
- The import updates an existing event instead of creating a copy, matched on a short name such as `cgdps-2026`.
- Photos are copied into the site's own image storage, and the summit organiser's name is kept with each photo.
- Sample events are archived (`is_placeholder=true`), not deleted.
- The Health summit date is set only if the site shows one.
