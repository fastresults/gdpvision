
## Goal

Serve the existing kiosk/admin app only under `present.gdpvision.com`, and free the apex `gdpvision.com` (+ `www.gdpvision.com`) to host a brand-new marketing website — all inside this single Lovable project, no second project needed.

## Approach

Both hostnames already resolve to this project (all three custom domains are connected). We branch behavior by hostname at the router layer so the same deployment serves two different sites.

### 1. Host-based routing shell

- In `src/routes/__root.tsx`, read the request host (SSR: `Request` headers; client: `window.location.hostname`) and expose it via router context or a small `useHost()` hook.
- Define a helper `getSiteMode(host)` → `"present" | "marketing"`:
  - `present.gdpvision.com` → `present`
  - `gdpvision.com`, `www.gdpvision.com`, lovable preview/published URLs → `marketing` (except when path starts with `/admin` or `/kiosk`, which stay on the app for testing on preview domains)
- Root layout picks which subtree to render based on mode.

### 2. Move kiosk routes under `/` on `present.*`

The existing routes stay where they are (`src/routes/index.tsx`, `src/routes/admin.tsx`, `src/routes/api/*`) — no file moves, no URL changes for the kiosk. On `present.gdpvision.com` they render exactly as today. API routes (`/api/kiosk-data`, uploads, `/api/public/*`) remain shared and work from either host.

### 3. New marketing site at apex

Create new route files that only render when `mode === "marketing"`:

```
src/routes/
  index.tsx              → host-switch: marketing home OR kiosk home
  marketing/             → new components (not routes)
    Hero.tsx
    Features.tsx
    Contact.tsx
    Footer.tsx
    Header.tsx
```

- `src/routes/index.tsx` becomes a thin switch: `mode === "present" ? <KioskHome /> : <MarketingHome />`.
- Extract current kiosk home body into `src/components/kiosk/KioskHome.tsx` so `index.tsx` stays clean.
- Add marketing-only routes as needed (e.g. `/about`, `/contact`) — these 404 on `present.*` via the mode guard.

### 4. Redirects and canonicals

- On `present.*`, redirect any marketing-only path (`/about`, `/contact`, etc.) to the apex equivalent.
- On apex/www, redirect `/admin` and `/kiosk`-specific paths to `https://present.gdpvision.com/...` so bookmarks keep working.
- `www.gdpvision.com` → 301 to `https://gdpvision.com` (set primary in Lovable Domains UI).
- Per-mode `<link rel="canonical">` + distinct `head()` metadata (title, description, og:*) so search engines index them as two sites.

### 5. SEO hygiene

- `robots.txt`: allow both hosts; disallow `/admin` everywhere.
- `sitemap.xml`: emit two hostname-scoped sitemaps, or a single sitemap per host chosen by the request host. Kiosk routes only listed under `present.gdpvision.com`; marketing routes only under `gdpvision.com`.
- Distinct `og:image` per site (kiosk keeps current; marketing gets a new hero image generated in build step).

### 6. Domain configuration (user-side, in Lovable UI)

No DNS changes needed — all three domains already point here. User just confirms in **Project Settings → Domains**:
- `gdpvision.com` — Primary
- `www.gdpvision.com` — redirects to primary
- `present.gdpvision.com` — active, serves the app subtree

## Technical details

- Host detection SSR: read `request.headers.get("host")` inside `__root.tsx` `beforeLoad` or a root loader, stash on router context.
- Host detection client: `window.location.hostname` inside a `useSyncExternalStore`-safe hook to avoid hydration mismatch — SSR value seeds initial render.
- Preview/dev hosts (`*.lovable.app`, `localhost`) default to `marketing` mode but honor a `?mode=present` query flag (and remember via `sessionStorage`) so we can preview the kiosk without the subdomain.
- No changes to `src/lib/*.functions.ts`, migrations, or Supabase schema.

## Out of scope (this plan)

- Actual marketing-site content/design — this plan only scaffolds the shell + one placeholder home. A follow-up turn designs Hero/Features/Contact once you approve direction.
- Splitting into two Lovable projects (not needed; single deployment handles both hosts).

## Rollout order

1. Add `getSiteMode` + host context in `__root.tsx`.
2. Extract current `index.tsx` body → `KioskHome`; make `index.tsx` a host switch with a placeholder `MarketingHome`.
3. Add redirects for cross-host paths.
4. Update `robots.txt` + `sitemap.xml` to be host-aware.
5. Verify on preview with `?mode=present` and by visiting each of the three domains after publish.
6. Follow-up turn: design and build real marketing pages.

## Questions before I build

1. Should `/admin` be reachable on `present.gdpvision.com` only, or also allowed on the apex as a hidden backdoor?
2. For the new marketing site, do you already have copy/branding/screenshots you want used, or should I generate a placeholder landing page (hero + features + contact) for you to iterate on?
