# Show full country names on the Second Brain

## Problem
On `/admin/brain`, the constellation renders each country as a 3-letter ISO code (ATG, JAM, BLZ, …). You want the full country name (e.g. "Antigua & Barbuda", "Jamaica", "Belize") on the orbs and in the hover tooltip / center label.

## Change
In `src/components/country-data/BrainConstellation.tsx`, resolve each country code to its display name via the existing `CARICOM_OECS_REGISTRY` (`src/lib/caricom-registry.ts`, which already maps every code shown in the screenshot to a full name):

- Country orbs: render the full name instead of the code. Keep the ISO code available as a `title` attribute for hover, so admins can still see the code.
- Center label: when a country is focused, show the full name (e.g. "Saint Lucia · 23 memories") instead of "LCA · 23 memories".
- Hover tooltip / floating label (the "LCA · 23 memories" pill in the screenshot): same — full name.
- Handle unknown codes gracefully by falling back to the raw code so nothing breaks for non-registry scopes like `REGIONAL`.

## Typography / layout considerations
- Long names ("St. Vincent & the Grenadines", "Trinidad & Tobago") won't fit the current small circular orbs. Options: wrap to 2 lines inside the orb with a slightly smaller mono font, or render the name as a label just outside/under each orb and keep the orb itself compact. Recommendation: label under the orb, orb stays the same size — cleanest and preserves the constellation composition. The orb keeps a short glyph (first letter or dot) or nothing, and the full country name sits beneath it in the same mono style already used elsewhere on this view.

## Scope
- Only the constellation view (`BrainConstellation.tsx`) and its labels. No data model, no route, no other admin surface changes.
- No changes to sector orbs (publ, fina, tour, …) — those are sector slugs and out of scope for this request.
