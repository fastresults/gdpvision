# GDP Events: all eight summits, every edition, with its own admin

## Where things stand
- Seven summits are saved as drafts: Blue Economy, CGDPS, CADIS, CHIS, CAFS, CEIS, CBIS. None is published yet.
- Health (health.gdpvision.com) is missing because its website shows no date.
- Four sample events are still stored. They're hidden from visitors, but they appear in admin.

## 1. Summits as series, editions as events
Each website is one **summit series** (for example "Caribbean GDP Summit"). Each year or edition is one **event** in that series (for example CGDPS '26 and CGDPS '25).
- A new series page at `/events/series/<name>` gives the summit's story, the next edition, past editions with recordings and photos, and a link to its website.
- `/events` groups everything by series and keeps the Upcoming and Past & recordings sections.
- Health joins as a series with "Date to be announced" until its website shows a date.

## 2. Importing every edition, past and future
- I'll read each of the eight websites in full: home, agenda, speakers, partners and past-edition pages.
- Every edition I find becomes an event, with its dates, venue, agenda, speakers, partners and photos.
- Nothing gets made up. Anything a website doesn't say stays blank and is flagged for you to fill in.
- Photos are copied into this site's own storage, so they stay even if a summit website changes.
- Imports update existing events rather than creating copies.
- Everything arrives as a draft. You review it and press Publish.

## 3. Its own Events Admin at `/events-admin`
A separate workspace in the events style, open only to administrators. Its menu:
- **Dashboard**: next events, registrations this week, waitlists, and gaps to fill.
- **Series**: the eight summits, with their logo, colour, website and sector.
- **Events**: create, edit, publish or archive editions, and copy an edition forward to next year.
- **Agenda & speakers**: an agenda builder by day and session, and a speaker library you can reuse across events.
- **Partners & sponsors**: names, logos and tiers.
- **Registrations**: attendee lists, waitlist moves, export to spreadsheet, and check-in on the day (search or QR).
- **Media**: photo library, recordings and slide decks for past editions.
- **Site sync**: "Refresh from site" for each series. It shows what changed before anything is saved.
- **Enquiries**: requests to host an event.
- **Second Brain links**: tie each event to Chambers, indexes, countries and op-eds.

The current Super Admin → Events page will point to the new workspace.

## 4. Clean-up
- The four sample events are archived and won't show in admin lists.
- Confirmation emails still need a sender address on your own domain. Everything else works without one.

## Order
1. Series structure and the Events Admin shell.
2. Read all eight websites, then show you a summary of what was found for review.
3. Agenda, speakers, partners, media and check-in tools.
4. Series pages and an updated `/events`.
5. Site sync and Second Brain links.

## Technical details
- New tables (each with GRANTs, RLS and policies): `event_series` (slug, name, site_url, sector, colour, logo); `event_partners`; `event_media`; `speaker_profiles` (reusable) joined to events. `events` gains `series_id`, `edition_label` and `date_tba`, and `starts_at` may be empty when `date_tba` is set. Imports match on `series slug + edition`.
- `/events-admin` sits under `_authenticated`, with a layout that checks `has_role` admin server-side. Its functions live in `src/lib/events/admin-*.functions.ts` and use `requireSupabaseAuth` plus an admin check.
- The importer is an admin-only server function. It finds each site's pages, reads them, and uses AI to extract details into a structured shape, keeping the source page address on every field. Photos are uploaded to a storage bucket. Results are staged in a review table before they're saved.
- Check-in uses a per-registration token shown as a QR code.
- Tests cover: duplicate imports update instead of copying, TBA events sort last, and check-in can't happen twice.
- Update `AGENTS.md` and docs maps (`bun run headers && bun run map`).
