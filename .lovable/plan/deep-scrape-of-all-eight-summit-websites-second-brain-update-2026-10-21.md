# Deep scrape of all eight summit websites + Second Brain update

## Approach
Today, the site sync only reads each summit's homepage title, description and photo. The new version reads every page of each summit site and uses what it finds to fill in the event and the Second Brain.

1. **Read every page.** For each of the eight sites (blue-economy, health, housing, gdp-event, commerce, energy, cadis, agriculture), list all of its pages (home, agenda, speakers, sponsors, venue, register, about, FAQ, news) and read each one in full, including content that only loads after the page opens.
2. **Pull out structured details** using AI. Fields: dates, venue and address, agenda sessions (time, title, room), speakers (name, role, organisation, photo, bio), partners and sponsors (tier, logo, link), ticket types and prices, registration link, FAQs, contact, hashtags and socials, and the sector themes and countries it covers. Every field keeps the page it came from. Anything a site does not state is left blank and never guessed.
3. **Show changes for review.** Events Admin → Site sync shows the changes next to current values: new, changed and removed. You approve them in one click per summit or field by field. Repeat runs update what is already there, matching speakers by name + organisation, sessions by time + title and partners by name, so nothing is duplicated.
4. **Keep photos and logos.** Speaker photos, logos and hero images are copied into our own storage, so the event pages no longer depend on the summit sites staying up.
5. **Update the Second Brain.** Each summit becomes a set of Second Brain records: a summit profile, its agenda topics, speakers as people records, and partners as organisations. Each record is linked to its sector Chamber and the countries it covers, and cites its source pages. Second Brain records are updated when content changes, never duplicated, and marked public so the partner feed and GDP Advisor can read them.
6. **Run it now, then weekly.** I'll run the full scrape once for all eight sites and report what was found per summit, including anything that conflicts (such as the Health venue). A weekly automatic refresh then reports changes for review and publishes nothing by itself.

## What you'll see
- Event pages fill with real agenda, speakers, sponsors and photos once you approve each summit.
- Site sync gets a "Deep scrape" button and a last-run report.
- Admin → Second Brain shows the new summit records.

## Technical details
- Firecrawl (already linked) `map` + `crawl` (limit ~40 pages/site), markdown output; Gemini via AI Gateway for JSON extraction against a fixed schema, with per-field `source_url`.
- Snapshots in `event_site_snapshots` (raw pages + extracted JSON + diff); apply via the existing `adminSyncApply`, extended to sessions/speakers/partners/media with natural-key upserts.
- Media rehosted to a public `event-media` storage bucket.
- Second Brain: `upsertMemoryObjects` with normalized keys `event:<series>:<edition>`, `event-speaker:<name>|<org>`, `event-partner:<name>`; `recordCitation` per source page; visibility public.
- Weekly cron at `/api/public/jobs/events-deep-sync` (secret-verified) writes snapshots only.
- Tests for natural-key matching and "blank, never guess" field merging.
