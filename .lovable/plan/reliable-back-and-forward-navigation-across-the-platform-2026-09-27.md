# Reliable back-and-forward navigation across the platform

## What exists today
- Page-level back only through the browser's own Back button. One screen (Cabinet session) closes with Escape.
- Breadcrumbs exist on about 30 admin pages. They are hand-written per page and link to fixed parents, not to where the user actually came from.
- Scroll position is restored between pages. Many steps, tabs, modals and filters are held only on screen, so Back often skips them or loses them.
- Nothing records the user's journey.

## Recommended approach: four layers

### 1. Everything meaningful lives in the page address
Every step, tab, open modal, selected item and important filter is written into the address, like the new `?setup=` in the scorecard window. This makes Back and Forward, refresh and shared links all behave the same.
- Rule: opening a modal or changing a step adds a history entry. Typing, filtering and small toggles replace the current entry instead, so Back isn't flooded.
- Audit the wizards, tabs and modals across the chambers and convert the ones that hold state only on screen. Priority: Persona Lab wizard, Scenario builder, FDI Studio, Investments viewer, Standards tabs, Digital Government Studio, Sector Studio, and the Portfolio setup window.

### 2. A journey trail (the user's own path)
A small navigation service records each page the user visits in this browser tab: page title, address and a timestamp. It survives refresh, stays per tab, and holds up to the last 50 entries.
- **Smart Back button** in every shell header (admin, country console, instrument, narrative). It returns to the actual previous page on this platform. If there is none (a deep link or new tab), it goes to the page's logical parent instead of leaving the site.
- **"Where I've been" menu** beside it: the last 10 pages, so a user can jump back several steps at once.
- **Return-to after actions:** when a page sends the user elsewhere to do a task (for example "Set up →" from the queue to a portfolio), the link carries where they came from. Finishing or cancelling brings them back there.

### 3. One breadcrumb and parent map for the whole platform
Breadcrumbs are defined once per route (label plus parent) and every shell renders them automatically. This replaces the 30 hand-written lists and guarantees every page has a sensible "up" path.
- The map is also the fallback target for the Smart Back button.
- A build-time check fails if a new page is added without an entry, so coverage stays complete.

### 4. Safety nets
- **Unsaved changes:** a guard before leaving a page with unsaved edits (Back, a link or closing the tab) asks the user to stay or leave. Build it on the existing dirty-state helper and apply it to all editors and forms.
- **Modals and Escape:** closing a modal steps back one history entry when that modal added one; otherwise it removes it from the address. Escape and the browser's Back button behave the same.
- **Sign-in round trip:** if a session expires, the user returns to the exact page and state after signing in again.
- **Mobile:** the phone Back gesture follows the same rules, and bottom sheets close on Back.

## Optional: journey analytics (admins)
Save anonymised page-to-page movements to the backend so admins can see common paths, dead ends and pages where users most often go back. This is off by default and needs your go-ahead for privacy reasons.

## Rollout
1. Build the navigation service, Smart Back button, "Where I've been" menu and the central breadcrumb map. Wire them into all four shells.
2. Move page state into the address, chamber by chamber, in the priority order above.
3. Add the unsaved-changes guard and the modal/Escape rules.
4. Journey analytics, if you approve it.

## Technical details
- `src/lib/nav/trail.ts` uses the router's history subscription and stores the trail in sessionStorage per tab (capped at 50 entries). It exposes `useTrail()`, `goBack(fallback)` and `withReturnTo()`.
- `src/lib/nav/route-meta.ts` holds `{ routeId: { label(params), parent } }`, with a coverage check script added to `check:maps`.
- `src/components/nav/SmartBack.tsx` and `TrailMenu.tsx` are mounted in SuperAdminShell, the console shell, and the instrument and narrative route layouts.
- Search params are validated with `validateSearch` and zod on each converted route. Steps and modals push history entries; filters and typing use `replace: true`.
- The unsaved-changes guard uses TanStack Router `useBlocker` together with `useDirtyState`.
- Auth: the `/auth` route accepts a sanitised same-site `redirect` path and navigates there once the session is restored.
- Analytics (optional): a `nav_events` table with grants and RLS, restricted to admin reads.

## Validation
Browser tests will walk through a multi-step flow and then go back step by step, refresh partway through, open a deep link in a new tab and press Back, press Escape on modals, try to leave with unsaved edits, and use the phone Back gesture. Each case must land on the expected page and state.
