# New briefing section: "From the Second Brain to a living eGov website"

## Recommendation

Add one new full-screen section to the live briefing (/present), placed straight after "07 · The chambers" and before the GDP events. It tells a single story in two halves:

- **Left: how it works.** A short animated pipeline showing how the Second Brain becomes a government website, and keeps it current.
- **Right: the proof.** A live viewer that loads **atg.gdpvision.com** (Antigua and Barbuda), using the same viewer as the Chamber and event sections: it fits the column, preloads as soon as /present opens, and has the reload, larger-view and new-tab controls.

## What the section says

- Label: "08 · Digital government"
- Title: "The Second Brain builds the nation's website, and keeps it current"
- Lede: "The same verified evidence that briefs Cabinet feeds a public API. Chamber 09 turns it into an eGov site that updates itself when the record changes."

## The pipeline animation (left column)

Five engraved steps in the graphite-and-gold house style, lit one after another with a dot travelling between them. It loops, and you can click it to pause or resume, like the other animations:

1. **Second Brain**: approved national figures, ministries, services and sources, each one cited.
2. **Sovereign boundary**: only approved, public-grade findings pass. Private Vault rows never cross.
3. **Ongoing country API**: a versioned, keyed public feed (`/api/public/v1/countries/ATG/...`), shown as an endpoint card with a small sample response.
4. **Digital Government Studio (Chamber 09)**: the site plan is drafted, signed off by named officials and branded.
5. **Live eGov site**: atg.gdpvision.com publishes. A "Refreshed from the record" pulse loops back to step 1 to show the cycle repeats as data changes.

Below the steps, three short outcome lines: "Always current, no re-typing", "Every figure traceable to its source", "Owned and approved by government".

## Behaviour

- Works with the arrow keys and the progress list like every other section. Later section numbers each go up by one (events 09, conclusion 10).
- The briefing bar's viewer counter goes from 19 to 20.
- On phones the viewer stacks below the pipeline.
- Wording stays careful: the site is described as a demonstration for Antigua and Barbuda. No GDP figures are claimed.

## Technical details

- New `EgovStep` in `src/components/present/PresentDeck.tsx` (`<Step id="egov" label="Digital government">`), using `<LiveFrame src="https://atg.gdpvision.com" label="atg.gdpvision.com" …/>` with the existing wide/narrow state pattern from `EventStep`.
- New `src/components/present/EgovPipeline.tsx`: an SVG and CSS animation reusing the `prs-*` reveal classes, `useHoverIntent` for click-to-pause, and a static completed state for reduced motion. The sample response renders through `<PrettyJson>`.
- The endpoint path matches the existing route `src/routes/api/public/v1/countries.$code.$resource.ts`. The sample data shown is illustrative and labelled as such.
- Renumber the later `MICRO` labels. `ViewerReadiness` counts frames automatically.
- Verify at 1397×857 and 390×844: atg.gdpvision.com loads in the viewer (if the site refuses to be embedded, fall back to the new-tab control and report it), no overflow, no console errors.
