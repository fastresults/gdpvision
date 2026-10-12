## Briefing: a new "Sovereign corpus" section, and the real Second Brain in every chamber circuit

### Part A — New section: "One corpus. Two worlds. You hold the switch."
Same layout as the Narrative Chamber slide: the story on the left, a live GDPVision screen on the right. It sits right after "The corpus" section.

**Left side: the story, as an animated circuit**
- On the far left is the real Second Brain drawing from GDPVision (see Part B), labelled SECOND BRAIN.
- The question: *"Can we use the world's data and keep our own?"*
- Three stages, drawn the same way as the chamber slides:
  1. **Live global feeds.** Live connections pull IMF, World Bank, ECCB and other figures in as they are published. Each figure keeps its source and date.
  2. **The sovereign data center.** A mini data center provided to the government stores and joins tax, customs, ministry and cabinet records. These records never leave the country's hardware.
  3. **You hold the switch.** Officials turn each source on or off from one screen. Every change is logged.
- The outcome box: **"Evidence the government controls, end to end."**
- Small dots travel along the lines. Global feeds run in gold and enter from outside. Sovereign records run in red and stay inside a dashed national boundary.
- Click to pause, as elsewhere in the briefing. Reduced motion shows the finished drawing.

**Right side: the live screen**
- A live viewer shows GDPVision's real **Data Sources** screen for Antigua and Barbuda: the list of sources with their on/off switches. It loads as soon as the briefing opens, like the other viewers, with the same full-width fit and the same buttons to widen it or open it in a new tab.
- The caption reads "This is the live control panel — toggle a source and the Second Brain re-weights."
- As with the chamber viewers, someone who isn't signed in will see the sign-in screen inside the viewer.

### Part B — The real Second Brain replaces the dotted circle everywhere
Today each chamber slide draws a plain circle with ten dots. That circle will be replaced by a small version of the actual Second Brain drawing GDPVision shows admins: the constellation of real memories, sources and figures, grouped by type.
- It uses real totals from the system: how many sources, documents, figures and memories it holds. The briefing is public, so it gets **counts only**, never the content.
- The current chamber's group glows in that chamber's colour. The rest stay graphite.
- One shared drawing is used everywhere: all ten chamber slides, the new section, and the main corpus section.
- If the totals can't load, it falls back to a fixed drawing, so the slide never breaks.

### Checks
- Desktop at 1397×857 and phone at 390×844: the new section, three chamber slides, and the main corpus section.
- The viewer counter goes up by one, to 22 viewers.
- No errors, and the build passes.

### Technical notes
- New `src/components/present/SovereignCorpusStep.tsx`, inserted after `id="corpus"` in `PresentDeck.tsx`. It reuses the `Step`, `Reveal`, `LiveFrame` and `.prs-*` keyframes. The viewer `src` is `/admin/countries/ATG/data`.
- New `src/components/present/CorpusMark.tsx`. It draws a compact SVG constellation from a deterministic layout seeded by real counts. In `ChamberCircuit.tsx`, the brain circle block (lines ~59–95) becomes `<CorpusMark x y r highlight={demo.index} />`. `SecondBrainFeed` centres on it too.
- New public server function `src/lib/present/corpus-snapshot.functions.ts` (header docblock tags). It returns only aggregate counts per category (sources, documents, chunks, memory_objects, kpis), through a SECURITY DEFINER SQL function `public.corpus_public_counts()` granted to anon. No rows and no text are exposed. A static fallback is built in.
- Migration: create the function, `GRANT EXECUTE` to anon and authenticated. Record in AGENTS.md: the briefing reads only aggregate corpus counts.
