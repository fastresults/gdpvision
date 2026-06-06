# Mobile-First Experience Plan

Today, mobile users hit a dead end: a single line saying "GDP Vision is optimized for desktop." We replace that with a polished, native-feeling mobile experience that mirrors the desktop kiosk's purpose (browse resources by category and view them) but reimagined for touch, one-thumb use, and small screens.

## Goals

- Feel like a premium mobile app, not a shrunken desktop site
- One-thumb reachable: primary controls live in the bottom half
- Fast category switching and content discovery
- Graceful handling of iframes that block mobile embedding

## Experience

### 1. Idle / Home screen
- Full-bleed dark canvas with the admin-uploaded idle image centered (capped ~55% of viewport height on mobile, with soft radial glow behind it)
- Large bold kiosk title beneath the image
- Subtle "Swipe up to explore" affordance with an animated chevron
- Tapping anywhere or swiping up reveals the category browser

### 2. Category browser (bottom sheet, primary surface)
- Persistent bottom sheet, two snap points: peek (shows category pills) and expanded (shows resource grid)
- Top of sheet: horizontally scrollable category pills (Websites, Presentations, Docs, Past Events, Brand) with the active pill highlighted using the accent color
- Below pills: 2-column tappable card grid of items in the active category
  - Each card: favicon/thumbnail, label (2-line clamp), category icon badge
  - Generous 44pt+ tap targets, springy press states
- Empty state per category with friendly copy

### 3. Resource viewer (full-screen takeover)
- Tapping a card pushes a full-screen view with slide-up transition
- Top bar: back chevron (left), label (center, truncated), "Open in browser" external-link icon (right) — all 44pt targets
- Iframes: rendered full viewport below the top bar
- Videos: native `<video controls playsInline>` filling the viewport, black letterbox
- If iframe is blocked (existing 3.5s timer logic): bottom card slides up with favicon, label, "This site can't be embedded on mobile," and a prominent "Open in browser" CTA

### 4. Admin access
- Small settings gear in the top-right of the idle screen only (out of the way during browsing)

## Interaction details

- Bottom-sheet drag with momentum; snap points at peek (~110px) and expanded (~75vh)
- Safe-area insets honored (notch + home indicator) via `env(safe-area-inset-*)`
- Haptic-style micro-animations: pill activation, card press scale 0.97, sheet snap easing
- All transitions use existing CSS variables; no new color tokens needed
- Respect `prefers-reduced-motion`

## Scope guardrails

- Desktop experience is unchanged — branch on `isMobile` and render an entirely separate `MobileKiosk` component
- No backend, schema, or admin changes
- Reuses existing `listItems` / `listSettings` server functions and `VIDEO_CATEGORIES` logic
- Reuses existing `--eyeframe-*` color tokens

## Technical approach

```text
src/routes/index.tsx
  └─ if (isMobile) return <MobileKiosk items settings />
  └─ else                 existing desktop layout (untouched)

src/components/mobile/MobileKiosk.tsx   (new)
  ├─ IdleScreen          (image + title + swipe-up hint)
  ├─ CategorySheet       (bottom sheet, pills + grid)
  └─ ResourceViewer      (full-screen iframe/video + blocked overlay)
```

- Bottom sheet implemented with a lightweight controlled component using transform + touch handlers (no new dependency); falls back cleanly without JS gestures
- Reuses `CategoryIcon`, `VIDEO_CATEGORIES`, and the existing blocked-iframe timer pattern
- Mobile detection stays at the 768px breakpoint already in use

## Out of scope

- PWA install prompt / service worker
- Offline caching
- Tablet-specific layout (tablets continue to get the desktop layout for now — can be a follow-up)
- Any change to `/admin`
