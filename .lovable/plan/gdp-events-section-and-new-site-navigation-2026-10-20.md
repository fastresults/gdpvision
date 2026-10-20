# GDP Events section and new site navigation

## 1. New navigation (mega-menu)

The top bar shrinks to the logo, four menus and two actions:

```text
[GDPVision]   Platform v   Record & Proof v   Insights v   GDP Events v      Sign in   [Request a Cabinet briefing]
```

Opening a menu shows a panel. Each link has a one-line description and the panel has one featured card:

- **Platform**: How it works (the ten Chambers), Second Brain, Sovereignty, The Vault. Featured: the presentation (/present).
- **Record & Proof**: The National Record, Measuring bodies & indexes, Data & Decision Flow. Featured: The National Record.
- **Insights**: The business case, The Decision Brief, Value calculator, The writing (op-eds). Featured: the latest op-ed.
- **GDP Events**: Upcoming events, Past events & recordings, Host an event. Featured: the next event card, styled in the events look.

Behaviour:
- Menus open on hover or click with a short fade. They are keyboard accessible, and Escape closes them.
- The "Show/Hide details" toggle and its cookie are removed, because the menus already hide detail neatly.
- On phones, a full-screen menu shows the same four groups as tap-to-open sections, with the briefing button pinned at the bottom.
- The footer is rebuilt as four columns that mirror the menus, so every page stays reachable.
- Every logo click still returns to the top of the homepage.

## 2. GDP Events section (its own world)

Pages:
- `/events`: a large hero, a filter by country, theme and format, an animated colour-block grid of upcoming events, and a strip of past events.
- `/events/$slug`: the event hero photo, date and venue, agenda, speakers, host organisations, related Second Brain links (Chambers, indexes, op-eds and country data the event connects to), and a registration form.
- `/events/host`: the eight event hosts, plus an enquiry form for hosting a GDPVision session.

Registration:
- Visitors register without an account by giving their name, email, organisation, role, country and dietary or access needs.
- Each registrant gets a confirmation email. Admins get a notification and can see the attendee list.
- The number of places is capped, with a waitlist once an event is full. Registration closes at the cut-off date.

Admin (Super Admin → Events):
- Create and edit events (draft or published), upload photos, build the agenda and speakers, link Second Brain items, view and export attendees, and mark people as attended.

Second Brain connection:
- Each event can link to Chambers, countries, indexes, op-eds and public data items. The event page shows these as live, clickable tiles.
- Published events appear in the public data API and the GDP Advisor.

## 3. Second design system: "Bold civic festival"

- A separate visual language that applies only inside `/events` and to anything generated there, such as emails, share cards and printable tickets.
- Large condensed display type with a warm, readable body font.
- Saturated Caribbean colour blocks (sea teal, hibiscus coral, mango yellow, palm green and deep night blue) on a bright paper background.
- Photography is allowed and encouraged: full-bleed event photos with colour overlays. Events are the one exception to the engraved-graphite illustration rule.
- Motion: tiles rise and tilt on hover, colour blocks slide in on scroll, the date counts down, and section transitions animate. All motion turns off when a visitor's device asks for reduced motion.
- The main GDPVision pages keep their current look. Only the menus and footer link into the events world.

## 4. Build order

1. New mega-menu, phone menu and footer across all public pages.
2. The events design system and its page shell.
3. Event pages with sample events, which I will invent for you to replace.
4. Registration, confirmation emails and waitlist.
5. Admin events manager and Second Brain linking.
6. Events in the public API and the GDP Advisor feed.

## Open questions (to confirm during build)

- Real events, dates, venues and photos. I will use clearly marked placeholders until you supply them.
- The sender email address for confirmations.

## Technical details

- Navigation: rewrite `MarketingShell.tsx` with a `NAV_GROUPS` config driving desktop panels (Radix NavigationMenu from shadcn), mobile accordion and footer. Retire the `useDetailsUnlocked` cookie and its `DETAIL_LINKS`.
- Events routes: `src/routes/events.tsx` (layout with `EventsShell` and its own header accent and footer, rendering `<Outlet />`), `events.index.tsx`, `events.$slug.tsx`, `events.host.tsx`. Each has its own `head()` with og:image from the event photo URL.
- Design system: a scoped `.theme-events` block in `src/styles.css` with `--ev-*` tokens registered in `@theme inline` (`ev-sea`, `ev-coral`, `ev-mango`, `ev-palm`, `ev-night`, `ev-paper`), `ev-btn-*` utilities and display/body fonts loaded via `<link>` in `__root.tsx`. Record the exception in `docs/illustration-contract.md` and `AGENTS.md`.
- Tables (each with GRANTs, RLS and policies in the same migration): `events` (slug unique, status draft/published, capacity, registration_close, hero_url, country_code), `event_sessions`, `event_speakers`, `event_links` (event_id, kind, ref; unique per pair to avoid duplicates), `event_registrations` (unique on event_id + lower(email); status confirmed/waitlist/cancelled). Anonymous users read published events only. Registration goes through a public server function with validation and a capacity check; admins read registrations through `requireSupabaseAuth` plus a role check.
- Emails: Lovable transactional email for the confirmation and the admin alert.
- API: add an `events` resource to the public API v2 and an `events` scope; add an MCP events tool.
- Code in `src/lib/events/*.functions.ts` with domain headers; run `bun run headers && bun run map`.
- Tests: capacity/waitlist rule, duplicate-email rule, closed-registration rule.
