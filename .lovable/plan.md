## What went wrong

I failed because the earlier changes only made `/` choose between marketing vs kiosk inside the app. That does **not** actually move the whole kiosk website when:

- the custom subdomain is not active at the hosting layer, or
- non-root routes like `/admin` and `/api/*` are still reachable on the apex, or
- the apex host still has code paths that can render or call kiosk/admin behavior.

So the previous approach was too soft: it was host-aware rendering, not a full host-level separation.

## Goal

Make the existing kiosk shown in your screenshot the `present.gdpvision.com` experience, including:

- `/` kiosk presentation shell
- `/admin` admin console
- kiosk data APIs and upload APIs
- all media/gallery/PDF behavior already in the app

And keep `gdpvision.com` / `www.gdpvision.com` cleared for the new public website.

## Brute-force implementation plan

### 1. Define one canonical host rule

Use this hard rule everywhere:

```text
present.gdpvision.com  -> kiosk/admin/app
localhost + Lovable previews -> kiosk/admin/app

gdpvision.com + www.gdpvision.com -> marketing/placeholder only
```

No guesswork, no soft fallback to marketing on the subdomain.

### 2. Move the kiosk route behind host enforcement

Update the root route so:

- `present.gdpvision.com/` always renders the kiosk from the screenshot.
- Lovable preview still renders the kiosk so we can work on it safely.
- `gdpvision.com/` and `www.gdpvision.com/` never render the kiosk; they render only the temporary public website/marketing shell.

### 3. Block admin from apex/www

Update `/admin` so it is only usable on:

- `present.gdpvision.com/admin`
- Lovable preview/local development

If someone opens `https://gdpvision.com/admin` or `https://www.gdpvision.com/admin`, redirect or show a host guard that points them to `https://present.gdpvision.com/admin`.

### 4. Block kiosk APIs from apex/www

Add host guards to the existing app endpoints:

- `/api/kiosk-data`
- `/api/upload-media`
- `/api/upload-presentation`
- `/api/public/presentation-pdf`

On apex/www, these should not serve kiosk/admin data. On present/preview/local, they continue working normally.

### 5. Remove the fragile client-side reconciliation as the source of truth

The earlier implementation lets SSR pick one mode and the browser later correct it. For this split, the server host decision must be authoritative so published domains do not flash or hydrate into the wrong shell.

Keep a visible debug marker like:

```html
<html data-site-mode="present" data-site-host="present.gdpvision.com">
```

so we can verify the live host quickly.

### 6. Fix the marketing links to point back to present

Where the apex marketing shell links to the kiosk/admin, ensure every app/admin CTA uses the full subdomain URL:

- `https://present.gdpvision.com/`
- `https://present.gdpvision.com/admin`

No relative `/admin` links from the apex.

### 7. Verify after implementation

Use the preview/local host behavior first, then after you publish and confirm the custom domain is Active:

```text
https://present.gdpvision.com/       -> screenshot kiosk
https://present.gdpvision.com/admin  -> admin
https://gdpvision.com/               -> marketing/new-site placeholder
https://www.gdpvision.com/           -> marketing/new-site placeholder
https://gdpvision.com/admin          -> blocked or redirected to present
```

## Important note

If `present.gdpvision.com` itself still returns a hosting 404 before the app loads, no code can fix that by itself. The subdomain must be Active in the project domain settings. But this plan will make the app behave correctly the moment the host reaches this deployment, and it will prevent the apex from serving the kiosk by accident.