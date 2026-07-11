## Problem

`/kiosk` renders empty ("No items in this category") because the API endpoints it depends on are still host-guarded. When the browser is on `gdpvision.com` (marketing host), every `/api/*` call returns 404 via `blockMarketingRequest`, so the kiosk gets no items, no categories, and no settings.

The same guard also breaks admin uploads (`/api/upload-media`, `/api/upload-presentation`) and the public PDF endpoint when accessed from `gdpvision.com`.

`__root.tsx` also still sets `data-site-mode`/`data-site-host` via `getRequestSiteMode`, which is now dead weight.

## Fix

Kiosk and marketing live on the same origin now, differentiated purely by path. Remove all host-based gating.

### Changes

1. **`src/routes/api/kiosk-data.ts`** — remove `blockMarketingRequest` call and its import.
2. **`src/routes/api/upload-media.ts`** — same.
3. **`src/routes/api/upload-presentation.ts`** — same.
4. **`src/routes/api/public/presentation-pdf.ts`** — same.
5. **`src/routes/__root.tsx`** — drop the `getRequestSiteMode` loader and the `data-site-mode` / `data-site-host` attributes; keep the plain `<html lang="en">`.
6. **Delete** `src/lib/host-guard.ts`, `src/lib/site-mode.ts`, `src/lib/site-mode.functions.ts` — no longer referenced after the above.

### Verification

- Reload `/kiosk` on `gdpvision.com` → categories dropdown populates and items render.
- `/admin` still works (create/upload items).
- `/` still shows marketing.
