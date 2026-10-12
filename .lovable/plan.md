## New briefing section: "Antigua's Second Brain, live"

A new full-screen section in the briefing, laid out like the chamber slides: the drawing on the left, a live viewer on the right. It sits immediately after "The sovereign corpus" section.

### Left: Antigua's real Second Brain, enlarged
- The same constellation GDPVision shows admins: the dark **ATG** centre with its memory count, and the sector circles around it. These are Real Estate, Agriculture, Public Administration, Financial, Tourism, Construction, Energy, Manufacturing, Digital, Other Services and Cross. Lines and dots connect each sector to the centre.
- It fills the whole left half of the slide, much larger than in the admin screen.
- It stays interactive. Click a sector to highlight it, and the side note shows that sector's memory count and how many are verified.
- Above it is a short kicker and the headline: **"This is Antigua's Second Brain — live."** One line underneath: "Every circle is a sector the government's evidence is organised by; every dot is a memory GDPVision can cite."
- **What visitors see:**
  - Signed in as an admin, you see the full drawing with real memory titles.
  - A public visitor sees the same real shape and counts, but never the titles or contents of any memory.

### Right: the live data-source switches
- A viewer loads **gdpvision.com/admin/countries/ATG/onboard**. It starts loading as soon as the briefing opens, with the same fit-to-width, widen and new-tab controls as the other viewers.
- Caption: "The live control panel — turn a source on or off and the Second Brain re-weights."
- As with the other live screens, someone who isn't signed in will see the sign-in page inside the viewer.

### Checks
- Desktop at 1397×857 and phone at 390×844. On a phone, the drawing stacks above the viewer.
- Check both signed in (titles visible) and signed out (counts only).
- The viewer count goes up by one. No errors.

### Technical notes
- New `src/components/present/AntiguaBrainStep.tsx`, inserted after the `sovereign-corpus` Step in `PresentDeck.tsx`. It reuses `BrainConstellation` from `@/components/country-data/BrainConstellation`, with `filter={{ country: "ATG" }}`, scaled to fill the left column.
- New public server function `getCountryBrainShape` in `src/lib/present/corpus-snapshot.functions.ts`. It returns, for ATG only, counts grouped by `sector_code` × `kind` × `verified` from `memory_objects`, with no titles or ids. The component turns these counts into anonymous `BrainRow`s with blank titles to draw the same shape.
- When the viewer is a signed-in admin, the component instead calls the existing protected `listAllMemory` through `useServerFn` + `useQuery` and filters to ATG, so real titles appear.
- `LiveFrame src="/admin/countries/ATG/onboard"`.
- Update the AGENTS.md briefing-data rule: public visitors get only aggregate counts; real rows only for signed-in admins.
