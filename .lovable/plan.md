# Fix domain behavior

## Desired result

```text
https://present.gdpvision.com  → stays on present.gdpvision.com  → kiosk app
https://gdpvision.com          → stays on gdpvision.com          → marketing app
https://www.gdpvision.com      → usually redirects to gdpvision.com → marketing app
```

## What is happening

If `present.gdpvision.com` redirects to `gdpvision.com` even in incognito, the app code is not getting a chance to choose kiosk vs marketing. That redirect is happening before the React app renders.

The most likely cause is Lovable custom-domain canonicalization: one custom domain is marked **Primary**, and other connected domains redirect to it.

## Fix in Lovable domain settings

1. Open **Project Settings → Project → Domains**.
2. Ensure all intended domains are connected and **Active**:
   - `gdpvision.com`
   - `www.gdpvision.com`
   - `present.gdpvision.com`
3. Check which one is marked **Primary**.
4. If Lovable forces all non-primary domains to redirect to the primary domain, this single-project setup cannot keep both `gdpvision.com` and `present.gdpvision.com` as independent hostnames at the hosting layer.

## Robust architecture if Lovable enforces one primary redirect

Use two Lovable projects:

### Project A — Marketing
- Connect `gdpvision.com`
- Connect `www.gdpvision.com`
- Set `gdpvision.com` as primary
- Render only the marketing site

### Project B — Kiosk
- Connect `present.gdpvision.com`
- Set `present.gdpvision.com` as primary
- Render only the kiosk/admin app

This avoids fighting the hosting redirect behavior and guarantees each typed hostname stays on its own domain.

## Code cleanup after domain split

Once domains are split:
- In the kiosk project, remove the marketing host switch and always render kiosk.
- In the marketing project, keep only marketing routes/components.
- Keep shared content/assets only where needed.

## Immediate verification

After changing domain setup, test with:

```text
https://present.gdpvision.com
https://gdpvision.com
```

Use incognito or a different browser because 301 redirects can be cached.

## Recommendation

Because you need both domains to remain separate, the correct fix is likely **two projects / two primary domains**, not more host-detection code in this app.