# /record — making the National Record visible

Today the page is almost all text: a hero, the live tiles, and five sections of cards and tables. The idea of a "second brain" is described but never shown. The plan adds one strong visual per section. Each visual shows how the record works, and none is there only for decoration. Copy, order and the live tiles stay as they are.

## Direction
Quiet and precise, like a working instrument: graphite ink, gold accents, fine lines and slow, deliberate motion. Nothing flashy. Every animation plays once as it scrolls into view, can be replayed, and is switched off for people who turn off motion in their device settings.

## Visuals, section by section

1. **Hero: "The record, assembling."** A living constellation on the right of the headline. Source nodes (statistics office, central bank, budgets, IMF/World Bank, ministries) drift in from the edges. Each passes through a small gate labelled "cited · graded" and settles into one central ledger ring. Duplicate dots merge into one with a soft pulse. Three live counters tick up underneath: sources held, figures graded and duplicates merged. The counters use the real totals for the selected country, and fall back to platform totals when no country is selected.

2. **Live record: "Grade ring + evidence mix."** Above the existing tiles we add a radial gauge showing the share of figures graded A, B, C and assumption for the chosen country. When you switch countries, the ring animates to the new split. Tiles fade in one after another. Hovering a tile lights up its slice of the ring.

3. **Life of a figure: "Follow one number."** The six cards become a single path. One real figure (for example Antigua GDP US$2.21 bn) travels step by step along a gold line: Found, then Cited (a source tag attaches), then Graded (an A stamp), then Kept single (a ghost copy merges in), then Used (it branches to Brief, Scenario and Sector plan), then Kept current (a new period replaces it and the old value slides into history). The path runs as you scroll. On phones it stacks vertically.

4. **Three records: "Concentric custody."** Three nested rings: public evidence on the outside, government records in the middle and state-owned data at the core, with a vault lock. Findings rise outward from the core only through an "approved by named officials" gate. Hovering a ring highlights its card.

5. **What changes: "Weeks to minutes."** Each question row gets a small before/after bar. A long, faded bar shows "without a record" and a short gold bar shows "with the record". The bars draw in row by row. These are illustrative comparisons and are labelled that way. They are not measured claims.

6. **Confidence grades: "Trust scale."** A horizontal scale from assumption to A. The four grades are marked on it with a density strip showing how many figures in the live record sit at each grade.

7. **Corpus pulse band (new, thin, just before the briefing form).** A slow-scrolling ticker of recently refreshed public figures in the form "country · measure · period · grade". It shows that the record is kept current. It includes public figures only.

## Guardrails
- Only public figures appear. Restricted and Vault items are shown as shapes, never as data.
- Estimates and illustrations are labelled as such. Every number shown links to its explanation.
- No page errors, no sideways scroll on phones, and a fast first screen: the heavier visuals load only when scrolled to.

## Technical details
- Add the `motion` library for scroll-triggered animation. The visuals are hand-built SVG, with recharts reused for the grade ring.
- New components in `src/components/record/`: `CorpusConstellation`, `GradeRing`, `FigureJourney`, `CustodyRings`, `BeforeAfterBars`, `TrustScale`, `CorpusPulse`.
- New public server function `getCorpusStats` in `src/lib/record/corpus-stats.functions.ts`. It returns aggregate counts only (sources, graded facts by grade, merged duplicates, recent public refreshes) through a publishable client with narrow read access. It is called from the component, not a loader.
- Counters and ring figures get `<Explain>` entries in `src/lib/explain/record-entries.ts`.
- Respect `prefers-reduced-motion`. Use design tokens only (ink/gold/line/paper). Verify with Playwright on desktop and mobile.

## Question before building
Should the pulse band (item 7) and the live counters use real totals from the database? The alternative is to keep them to the existing figure tiles only, which is simpler with no new data access.
