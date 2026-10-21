# GDP Events site: reading from the Second Brain

## Recommendation

Build GDP Events as its own Lovable app, the same way GDP Advisor works: a separate project with its own web address and look. It reads from GDPVision through the existing partner data feed (API v2) using its own partner key. GDPVision remains the single source of truth: summits are managed in Events Admin and kept current with **Sync to Second Brain**.

Why a separate app rather than a section inside GDPVision:
- It gets its own brand, domain and release schedule without affecting GDPVision.
- Its key can be switched off at any time.
- It can only see public, approved data.

```text
Events Admin --(Sync to Second Brain)--> Second Brain
                                             |
                                 Partner feed (API v2, events key)
                                             |
                                    GDP Events site
                                             |
                       Registrations sent back to GDPVision
                                             v
                         Events Admin -> Registrations
```

## What the feed already provides

- Published events with agenda, speakers and links (`/api/public/v2/events`).
- Country data, search, comparisons and indexes.
- Media signals.

## What to add in GDPVision

1. **Richer summits feed**
   - Add summit series, editions, venue and dates.
   - Add partners, photos, the summit website and the registration link.
   - Only published, non-archived editions are included.
2. **Sector data per summit**
   - For each summit, return the sector figures and Second Brain facts for its sector and host country, for example energy figures for the Energy summit.
   - Only public data is returned.
3. **News per summit**
   - Return recent public media signals for the summit's sector and host country, with priority level and source.
4. **Registrations sent back to GDPVision**
   - A secure "register" endpoint for the partner key.
   - It uses the same rules as GDPVision's own form: capacity, waitlist and duplicate detection.
   - Sign-ups appear in Events Admin, tagged "via GDP Events site".
   - The feed never returns attendee details.
5. **A dedicated GDP Events key**
   - Issued in Admin → Partner API.
   - Holds only the events, sector-data, news and registration permissions.
   - Can be limited to the new site's web address.
6. **Hand-over guide**
   - Instructions to paste into the new GDP Events project: endpoints, key setup and example pages.

## Building the GDP Events site (afterwards, in its own project)

- Pages: home, summit, edition, agenda, speakers, register.
- All data is read through its own server, so the key never reaches visitors' browsers.
- Pages are cached and refreshed every few minutes.

## Open items

- GDPVision must be published before the new site can read the additions.
- The new site's web address is needed to lock the key to it.
- Confirmation emails still need a sender domain.

## Technical details

- New v2 routes:
  - `/api/public/v2/events/series`
  - `/api/public/v2/events/$slug` (includes partners and media)
  - `/api/public/v2/events/$slug/context` (sector KPIs + public `memory_objects` for the series sector and host ISO3 scope)
  - `/api/public/v2/events/$slug/media` (public `intake_items` filtered by sector/country)
  - `POST /api/public/v2/events/$slug/register`
- Every route lives in `partner.server.ts` behind scope checks.
- New scopes: `events_context`, `events_register` (existing `events`, `media`).
- Registration reuses the `registerForEvent` logic via a shared server helper. Each registration records `source = 'partner:<key id>'` and passes a rate limit.
- MCP gets matching read tools.
- Tests: scope enforcement, drafts never returned, registration duplicate detection and capacity.
- Update `docs/map` and `src/lib/AGENTS.md`.
