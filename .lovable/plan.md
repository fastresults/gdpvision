# Official logos for all ten measuring bodies

## Recommended approach
Add each organization's authentic logo above its name in the existing homepage scroller. Use official SVG files where available, otherwise sharp transparent PNGs. Preserve original colours, proportions and required clear space rather than redrawing or forcing every logo to the same shape.

You have confirmed permission for all ten organizations. Follow the approved variants and each organization's usage conditions; retain the existing non-affiliation disclaimer.

## Scope
World Bank Group, International Monetary Fund, UN Development Programme, World Health Organization, UN Office on Drugs and Crime, Transparency International, World Economic Forum, World Intellectual Property Organization, UN Department of Economic and Social Affairs, and Financial Action Task Force.

## Implementation
1. Source and inspect the correct institutional logo for each body from its official website or approved media library. Do not substitute campaign symbols, regional chapter logos, SDG graphics or unofficial recreations. Official SVG sources were identified for World Bank Group and UNDP; the remaining exact files need verification during implementation. If an approved asset cannot be obtained, report the specific missing file and retain its name rather than inventing a logo.
2. Add a consistent logo area above each organization's name: approximately 80px high with a maximum logo width of 180px. Align all areas to the same top edge; size individual logos optically so tall emblems and wide lettering feel balanced, without cropping or stretching.
3. Keep the current organization names, index links, card order, gold top rules, manual arrows, scrolling and disclaimer unchanged. Replace the small abbreviation with the logo where available, avoiding duplicate labels.
4. Verify every logo on the light card background at desktop and phone sizes, including transparency, readability and clear space. Scroll through all ten cards and check that images load, controls work and nothing clips.

## Technical details
- Extend the existing `logo` support in `src/lib/marketing/global-indexes.ts` and the logo slot in `src/components/marketing/IndexBand.tsx`; no new service or runtime logo lookup is needed.
- Store downloaded media through Lovable Assets with project `.asset.json` pointers; keep downloads in temporary storage. Reference pointer URLs, not hotlinked external images.
- Record official source and approved variant for each asset. Preserve the project's permission requirement and document the static asset convention in `AGENTS.md`.
- Reserve the logo area's dimensions before images load to prevent layout shifts; keep the visible organization heading as its accessible identification.
- Check preview build diagnostics and browser results before reporting completion. No database changes or publishing are included.