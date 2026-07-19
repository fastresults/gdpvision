## Goal
Add a real screenshot of each of the seven chambers as the visual header of its card on the marketing homepage, so visitors see the actual product surface instead of an icon tile.

## Approach

### 1. Capture screenshots (one per chamber)
Use Playwright against the running preview, authenticated as a super admin, on a representative country (e.g. Anguilla / AIA which has full data) at a 1600×1000 viewport for crisp 2× exports.

Routes to capture:
| # | Chamber | Route |
|---|---|---|
| 01 | National Ledger | `/admin/countries/AIA/ledger` |
| 02 | Portfolio Workspaces | `/admin/countries/AIA/portfolio` |
| 03 | Scenario Engine | `/admin/countries/AIA/scenarios` |
| 04 | FDI Transition Studio | `/admin/countries/AIA/studio` |
| 05 | Narrative Chamber | `/admin/countries/AIA/narrative` |
| 06 | Cabinet Room | `/admin/countries/AIA/cabinet` |
| 07 | Persona Lab | `/admin/countries/AIA/personas` |

For each: wait for the hero/primary panel to render, dismiss any modal/onboarding overlay, screenshot the top ~640px band (the signature composition of that chamber, not the whole scroll). Save as JPG at 1600×640.

### 2. Store as CDN assets
Upload each JPG via `lovable-assets create` into `src/assets/chambers/chamber-0N.jpg.asset.json` (7 pointer files, no binaries checked in). This keeps the marketing page fast and CDN-cached.

### 3. Rework `ChamberPanel` on the marketing homepage
`src/components/marketing/ChamberPanel.tsx` currently renders as a text-only paper panel. Add an optional `imageUrl` prop and render it as a 16:6-ish header band above the existing "Chamber NN" eyebrow:

- Full-bleed image at the top of the panel, ~180–200px tall, `object-cover`
- Thin hairline separator + 2px sector-hue accent bar continues down the left edge across image + body (keeps the current visual system)
- Subtle bottom gradient on the image so eyebrow text remains readable if it overlaps
- Preserve current typography, bullets, spacing, and accent-var contract
- Graceful fallback: if no `imageUrl`, render the existing text-only layout unchanged

### 4. Wire images into `MarketingHome.tsx`
Import the 7 `.asset.json` pointers and pass `imageUrl={chamberNAsset.url}` to each `<ChamberPanel />`. No copy changes.

### 5. Accessibility & performance
- Each image gets an `alt` like "The National Ledger — authoritative decomposition of the national economy"
- `loading="lazy"` and `decoding="async"` on all seven
- `width`/`height` attributes to prevent CLS

## Technical notes
- Auth: reuse the `LOVABLE_BROWSER_SUPABASE_*` session injection pattern for the Playwright script; navigate to `http://localhost:8080` first, restore localStorage + cookies, then hit each chamber URL.
- Robustness: `wait_until="networkidle"` + a short settle delay so Recharts/animations stabilize before the shot.
- If a chamber shows an empty-state for AIA, fall back to a country that has data for that chamber (script picks per-route).
- Output path: JPGs written to `/tmp/chambers/` then uploaded; no binaries land in the repo.

## Out of scope
- No changes to chamber routes themselves
- No copy/blurb edits on the homepage
- No changes to `ChambersLauncher` (the in-app grid) — this plan is homepage marketing only
