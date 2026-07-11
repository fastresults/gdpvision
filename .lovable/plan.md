## Why present.gdpvision.com shows 404

The host-based routing code I added earlier is deployed, but the 404 you see is not a routing bug in the app. It's the hosting layer telling you it doesn't have this project mapped to that hostname yet. The app never runs.

Two things have to be true for `present.gdpvision.com` to serve the kiosk:

1. **The custom domain must be `Active` on this project.** All three domains (`gdpvision.com`, `www.gdpvision.com`, `present.gdpvision.com`) appear in the project's URL list, but "listed" is not the same as "Active". If the subdomain is in `Verifying`, `Setting up`, `Offline`, or `Action required`, the edge returns 404 for that host.
2. **A published deployment must exist that contains the host-routing code.** The host-routing was added recently — if the last successful publish predates it, or the latest publish failed, the subdomain has nothing to serve.

Marketing on the apex working (or not) is a separate question; today's symptom is only "subdomain 404".

## Plan

### 1. Verify domain + publish state (no code change)
- Open **Project Settings → Project → Domains** and check the row for `present.gdpvision.com`. Expected: **Active**. If it shows anything else, follow the status hint (Complete Setup / Retry / fix DNS at registrar so the A record for `present` points to `185.158.133.1`).
- Confirm the most recent publish succeeded. If not, re-publish so the current build (with `site-mode.ts` + `MarketingHome`) is live.

### 2. Harden the host detection so SSR doesn't silently pick the wrong mode
Even once the domain is Active, there's a latent bug worth fixing in the same pass: `getRequestSiteMode()` uses `getRequestHost()`, which on Cloudflare can return the internal worker host instead of the user-facing `Host` header. If that ever returns an empty/unknown value, `getSiteMode()` falls back to `"present"` — which is fine for the subdomain but means the apex could momentarily render kiosk during SSR before the client reconciles.

Change `src/lib/site-mode.functions.ts` to prefer the request headers, in this order:
```
x-forwarded-host  →  host header  →  getRequestHost()
```
This is a 5-line edit; it makes the SSR mode match what the browser sees.

### 3. Add a tiny visible signal for debugging
Add a `data-site-mode={mode}` attribute on the `<html>` element in `__root.tsx` (driven by the same loader). This lets us confirm from DevTools which mode the server picked, without console noise. Removable later.

### 4. Re-publish and verify
- Publish.
- Load `https://present.gdpvision.com/` → expect the kiosk shell.
- Load `https://gdpvision.com/` → expect the marketing page.
- Load `https://www.gdpvision.com/` → expect the marketing page.
- Inspect `<html data-site-mode="…">` on each to confirm SSR mode.

## What I will NOT change
- No changes to `MarketingHome`, admin routes, kiosk data APIs, DB, or migrations.
- No new redirects yet (`www` → apex, cross-host path redirects). We can add those in a follow-up once the three hosts are confirmed serving the right shell.

## Most likely outcome
Step 1 alone resolves the 404 — the subdomain just isn't `Active` on this project yet. Steps 2–4 make the setup robust so we don't chase a ghost next time.
