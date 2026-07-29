## Goal

Replace the text-based "GDPVISION" wordmark with the uploaded seal + "GDP Vision" lockup image, rendered as large as the header container allows.

## Approach

1. **Upload the logo as a CDN asset**
   - `lovable-assets create --file /mnt/user-uploads/gdpvision-logo.png --filename gdpvision-logo.png > src/assets/gdpvision-logo.png.asset.json`
   - No binary added to the repo; referenced via the pointer's `url`.

2. **Rewrite `src/components/marketing/Wordmark.tsx`**
   - Render an `<img>` with the asset URL, `alt="GDP Vision"`, `loading="eager"`, `decoding="async"`.
   - Keep the existing `className` / `as` props so all ~15 call sites keep working unchanged. Sizing driven by height (`h-*`) with `w-auto` so the wide lockup scales proportionally; `max-w-full` guards narrow mobile widths.
   - Default height sized for a compact chrome bar (e.g. `h-9`), overridable per call site.

3. **Maximize it in the public header (`MarketingShell.tsx` line 46-49)**
   - Header currently has `py-5` padding; reduce to `py-2 md:py-3` so the logo, not the padding, sets the bar height.
   - Logo height: `h-12 md:h-16` — filling essentially the full header row while leaving a hairline of breathing room above/below.
   - Left `<Link>` gets `flex items-center shrink-0` and the header row keeps `min-w-0` on the nav side so the desktop nav still fits without wrapping at 1280px and below.

4. **Footer + app chrome**
   - Footer usage (line 132) gets an explicit smaller height (`h-8`) since it is a secondary mark.
   - The ~13 authenticated-shell call sites (`console.tsx`, `home.tsx`, `instrument/route.tsx`, admin routes, etc.) inherit the new default height; no per-file edits unless a shell visibly breaks.

5. **Verify**
   - Screenshot `/` at desktop (1386px) and mobile (390px) to confirm the logo is legible, fills the header, and the nav does not wrap or overflow.
   - Spot-check one authenticated shell header for vertical alignment.

## Technical notes

- The image is black artwork on a transparent/white field; on the paper background it reads correctly with no color token concerns. Since it is a raster image, the old `text-ink-950` styling no longer applies — the mark is intentionally exempt from the button/color token contract as a brand asset.
- The engraved seal inside the lockup matches the existing illustration house style, so no contract violation.
