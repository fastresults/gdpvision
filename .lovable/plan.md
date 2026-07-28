## Plan: Replace hero H1 with chosen headline

### Approved headline
**"Your nation's GDP growth engine"**

This option was selected by the user from the previously proposed set of five hero-headline alternatives. It is short, punchy, and places sovereign GDP growth as the primary value proposition.

### Where the change is made
- File: `src/components/marketing/MarketingHome.tsx`
- Line: 156 (the `<h1>` inside the hero section)
- Current text: `No small state should learn its own economy from someone else's report.`
- New text: `Your nation's GDP growth engine`

### Scope of work
1. Replace the H1 text in `src/components/marketing/MarketingHome.tsx`.
2. Verify the new line wraps cleanly across `text-[32px] sm:text-[43px] md:text-[68px]` breakpoints.
3. Run `bun run lint` to confirm no JSX or formatting issues.
4. Check the preview to ensure the headline remains visually dominant within the hero grid.

### Implementation note
The short headline should sit comfortably on one line at desktop width, preserving the strong visual hierarchy between the eyebrow (`GDPVision · An instrument of state`), the gold divider, the H1, and the sub-paragraph below.

---
**Ready to implement.** Please switch to build mode so I can apply the change.