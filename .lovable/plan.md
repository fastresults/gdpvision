# Website Hero Thumbnails in Mobile Tray

Replace the favicon tiles in the mobile bottom sheet with real screenshots of each item's homepage hero, so every card looks like a tappable preview of the actual site.

## Approach

Use **Microlink's screenshot API** (`https://api.microlink.io`) to render each URL's above-the-fold view on demand. It's free for low volumes, requires no API key, returns a stable image URL, and aggressively caches results on their CDN — perfect for a kiosk with a small, mostly-static set of links. No Puppeteer / headless Chrome required (which wouldn't run on Cloudflare Workers anyway).

Image URL shape:
```
https://api.microlink.io/?url={ENCODED_URL}
  &screenshot=true&embed=screenshot.url
  &viewport.width=1280&viewport.height=720
  &waitUntil=networkidle0
```
The `embed=screenshot.url` parameter makes the endpoint respond with the image bytes directly, so it slots straight into `<img src>`.

## What changes

### 1. New helper: `getHeroThumbnail(url, category)`
- Lives in `src/lib/thumbnail.ts` (client-safe, pure URL builder)
- Returns the Microlink image URL for `websites`, `presentations`, and `docs`
- Returns `null` for `videos` / `brand` (those use the video's own poster — see below)

### 2. Mobile tray cards (`MobileKiosk.tsx`)
- Replace the small icon tile with a **full-bleed 16:9 hero image** at the top of each card
- Card layout becomes: image (top, ~60% of card) → label (bold, 2-line clamp) → small category chip with icon
- Image uses `loading="lazy"`, `decoding="async"`, and a graceful fallback:
  - On `onError`, swap to a dark gradient placeholder + category icon (so a failed screenshot never shows a broken-image glyph)
  - While loading, show a subtle shimmer over the same gradient
- Card aspect ratio changes from `4/5` to `3/4` to give the thumbnail room to breathe
- For video cards (`videos`, `brand`): show the `<video>` poster frame via `<video src preload="metadata">` rendered as a static thumbnail (first frame), or fall back to the gradient + Film icon if browser blocks it

### 3. No DB or admin changes (initial cut)
- Thumbnails are derived at render time from `item.url` — zero migration, zero new admin UI
- Microlink handles caching; first view of a new URL takes ~2-3s, subsequent loads are instant from their CDN

### 4. Desktop untouched
- All edits stay inside `MobileKiosk.tsx` and the new helper. The desktop top-bar tile strip keeps favicons (they fit that 31px-tall design).

## Visual spec for the new mobile card

```text
┌─────────────────────┐
│                     │  ← 16:9 hero screenshot
│   [website image]   │     (rounded top, dark gradient fallback)
│                     │
├─────────────────────┤
│  Site Label         │  ← 14px semibold, 2-line clamp
│  🌐 Websites        │  ← 11px, 50% opacity
└─────────────────────┘
```

## Fallback & failure handling

- `onError` on the `<img>` → swap to a CSS gradient tile with centered category icon
- 8s `<img>` load timeout (handled via state + setTimeout) → same gradient fallback
- Cards remain tappable regardless of thumbnail state

## Scope guardrails

- Only `src/components/mobile/MobileKiosk.tsx` and one new tiny file `src/lib/thumbnail.ts` change
- No schema migration, no admin changes, no server function changes, no new dependencies
- Desktop layout, idle screen, resource viewer, and blocked-iframe overlay all unchanged

## Out of scope (can be follow-ups)

- Persisting thumbnails to our own storage (only needed if Microlink becomes a bottleneck)
- Admin override to upload a custom thumbnail per item
- Pre-warming the cache on item creation
