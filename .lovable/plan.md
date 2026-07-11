## Diagnosis

Yes — the live `https://present.gdpvision.com/` is still serving the marketing page. I verified the live page content and it matches your first screenshot, not the kiosk screenshot.

The failure is that the current app still allows `/` to render `MarketingHome` when the server-side host detection says `marketing`. If the hosting layer forwards the wrong host, or if the latest host-split build is not published, `present.gdpvision.com` can still land on marketing. That is not acceptable for your requirement.

## Brute-force fix

### 1. Make `/` impossible to show marketing on `present.gdpvision.com`

Update `src/routes/index.tsx` so the browser hostname is a final override:

```text
if window.location.hostname === "present.gdpvision.com" -> render KioskPage, always
```

This means even if SSR or forwarded headers incorrectly classify the host, the visible UI at `present.gdpvision.com` becomes the kiosk from your attached screenshot after hydration.

### 2. Strengthen server host detection specifically for present

Update `getRequestSiteMode()` so it checks every available host source and treats any source containing `present.gdpvision.com` as `present` before checking apex/www marketing rules.

Order:

```text
x-forwarded-host
host
request URL host
getRequestHost()
```

If any one of those is `present.gdpvision.com`, mode is `present`.

### 3. Add a hard guard inside `MarketingHome`

As a second fail-safe, make `MarketingHome` immediately redirect to `/` or render nothing if it ever mounts on `present.gdpvision.com`.

That prevents the marketing UI from surviving on the subdomain even if something routes there incorrectly.

### 4. Keep apex/www clear for the future public website

Keep the marketing shell only for:

```text
gdpvision.com
www.gdpvision.com
```

But the present subdomain wins over everything.

### 5. Verify locally against simulated hosts

Confirm:

```text
present.gdpvision.com /       -> kiosk UI marker/title
present.gdpvision.com /admin  -> admin available
gdpvision.com /               -> marketing shell
gdpvision.com /admin          -> redirects to present admin
gdpvision.com /api/kiosk-data -> blocked
present.gdpvision.com /api/kiosk-data -> allowed
```

### 6. Publish/update the live site

This is required. The live screenshot proves the published deployment is either stale or still resolving host mode incorrectly. After implementing, publish/update the site so `present.gdpvision.com` receives the corrected code.