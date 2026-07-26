## Marketing home — copy upgrade v2

Copy, IA and CTA changes only. No visual redesign, no token/colour changes, no changes to authenticated surfaces. All figures and citations in `moment-variants.ts` stay untouched.

Confirmed: ship the recommended H1; ship the briefing preparation line. The non-CARICOM email address was not supplied, so that escape hatch ships as a keyboard-reachable line pointing at the existing briefing form (no `mailto:`) until an address is confirmed.

### 1. Threat responses (highest value)
`src/lib/existential-threats.ts` — add a `response: string` field to the interface and the eight verbatim responses from the PRD. Render in `MarketingHome` hero carousel beneath the body: gold hairline, mono uppercase label "The instrument's answer", response text in `text-ink-950`.

### 2. Register fixes
- `MarketingShell.tsx`: logged-out nav becomes The Instrument · Sovereignty · Request briefing · Sign in. Remove "Create account" and "Forgot?" (Forgot already lives on `/auth`). Logged-in state unchanged. Footer untouched.
- `src/routes/index.tsx`: new TITLE/DESCRIPTION per §6.12, applied to og: and twitter: variants; `og:image` unchanged.

### 3. Hero
Eyebrow "GDPVision · An instrument of state"; H1 "No small state should learn its own economy from someone else's report."; new four-sentence sub-headline (removes "measurably lift GDP"); primary CTA unchanged; secondary link becomes "See how a decision moves through the instrument ↓" anchored to `#loop`.

### 4. New `#loop` section
Between corpus and chambers. Eyebrow/title/lede plus four numbered steps (Rehearse / Decide / Track / Score) in the existing bordered-column pattern with gold mono numerals, closing on the doctrine line "At every step the instrument drafts and prices. Principals decide. Nothing releases autonomously."

### 5. Chamber hierarchy
Chambers 04 and 08 lift into a two-column featured band above the grid at ~1.5× scale with mono labels "04 → Where the revenue cliff is priced" / "08 → Where the manifesto becomes a delivery plan". Remaining six (01, 02, 03, 05, 06, 07) stay in the grid, copy unchanged. Section lede revised per §6.6. `ChamberPanel` API unchanged — the featured band wraps it in a wider column.

### 6. Counsel, corpus, sovereignty, provenance
- New `#counsel` band after the chamber grid; delete the mono footnote.
- Corpus lede loses the "No other GDP instrument governs both" claim.
- Sovereignty gains the new lede; panels reordered: Sovereign instance → Data ownership → Public and private → Access & audit → No trackers.
- Provenance lede rewritten; add fourth "Today · Built in the region, for the region" card.

### 7. Moment section
Eyebrow becomes "The moment · Eight regional exposures, graded and cited"; standing grading line added beneath the three `NumberTile`s. No stat, grade or citation touched.

### 8. Briefing CTA and form
Add fourth qualifier "— Nothing is recorded" and the confirmed preparation line. In `BriefingForm.tsx`, add the non-CARICOM note beneath the nation selector as focusable text pointing to the same form (address pending).

### 9. Carousel behaviour
Threat auto-advance pauses on pointer hover and on focus within the region, and stops permanently after any Prev/Next interaction.

### Technical notes
Files: `MarketingHome.tsx`, `existential-threats.ts`, `moment-variants.ts` (title/eyebrow-adjacent copy only), `MarketingShell.tsx`, `BriefingForm.tsx`, `routes/index.tsx`. Buttons keep `btn-*` / existing utility patterns; new sections use existing `SectionHeader` and heading order (`h2` per section, `h3` within). Verify with lint, typecheck and `bun run check:maps`.
