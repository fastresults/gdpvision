# GDP Events site — hand-over guide

Paste this into the new GDP Events Lovable project. GDPVision is the source of truth; the site only reads from it and sends registrations back.

## 1. Get a key (GDPVision)
Admin → Partner API → **Set up for GDP Events site** → add the site's web address under "Allowed website origins" → Issue key. Copy it once.
Permissions: `events`, `media`, `events_context`, `events_register`.

## 2. Store it (GDP Events project)
Save the key as a server secret named `GDPVISION_API_KEY`. Call GDPVision only from server functions — never from the browser.
Base URL: `https://gdpvision.com/api/public/v2`. Header: `Authorization: Bearer <key>`.

## 3. Endpoints
| Method | Path | Returns |
|---|---|---|
| GET | `/events/series` | Summits with their published editions |
| GET | `/events?upcoming=1&series=<slug>` | Editions with agenda, speakers, partners, photos, summit site, registration link |
| GET | `/events/<slug>` | One edition in full |
| GET | `/events/<slug>/context` | Host-country indicators, public Second Brain facts, summit topics/partners/speakers |
| GET | `/events/<slug>/media?limit=50` | Recent public news for the host country (30 days, P1–P5) |
| POST | `/events/<slug>/register` | Body `{ name, email, organisation?, role?, country?, needs? }` → `201 ok` (confirmed/waitlist), `200 duplicate`, `409 closed`, `404`, `422` |

Only published editions are returned. Attendee details are never returned. Registrations appear in GDPVision Events Admin tagged "via GDP Events site". Limit: 30 registrations per minute per key.

## 4. Suggested pages
Home (series grid) · Summit (`/summits/<series>`) · Edition (`/<slug>`: agenda, speakers, partners, photos, context, news) · Register form → POST via a server function.
Cache reads for a few minutes. When an admin updates GDPVision and clicks **Sync to Second Brain**, the site picks it up on the next refresh.

## 5. Go-live
Publish GDPVision first (the new endpoints only exist on the published site after publishing).
