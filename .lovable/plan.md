Tighten hero spacing so the body copy, threat carousel controls, and CTA buttons all fit in the same hero viewport without excessive whitespace.

### What will change
1. **Threat text container** — reduce the fixed `min-h-[260px] md:min-h-[300px]` on the `aria-live` wrapper so it sizes to the content instead of pushing the nav and CTAs down the page.
2. **Threat nav row** — compact the "Prev / 01 / 08 / Next" bar: keep the top border but reduce the top margin/padding so it sits directly under the body copy.
3. **CTA buttons** — reduce the top margin between the nav and the "Request a Cabinet briefing" / "See the instrument" buttons so they remain visible in the hero section.

### Implementation details
- Edit `src/components/marketing/MarketingHome.tsx`.
- Adjust Tailwind spacing tokens only (no new components, no color changes, no logic changes).
- Preserve the carousel auto-rotation (10s) and manual prev/next behavior.
- Keep all existing responsive behavior; verify the layout still breathes on mobile and desktop.

### Out of scope
- No changes to the threat copy or carousel timing.
- No changes to the "moment" section nav below.
- No changes to the SignatureRing visual or section colors.