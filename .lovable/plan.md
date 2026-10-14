# Homepage: Antigua’s live Second Brain

## Recommended approach
Replace the selected static Corpus illustration with **Antigua’s actual interactive Second Brain**, using the same sector-and-memory view shown in `/present`. Make it the central evidence of the section, not a small decorative image.

## Revised layout
- **Desktop: 55% Second Brain / 45% explanation**, measured across the usable section width after the column gap.
- Place the enlarged Second Brain on the **left**, with a clear label: “Antigua & Barbuda · Live Second Brain.” Keep the full diagram visible at its initial zoom.
- Place the headline, supporting paragraph, three evidence blocks and existing National Record link together on the **right**. Vertically centre this column against the diagram; remove the separate full-width row of evidence blocks.
- Present the three blocks as compact, unframed text sections with subtle dividers: public evidence, protected government evidence, and how both support a decision.
- On smaller screens, stack the introduction, full-width brain and evidence blocks in reading order. Keep controls and labels clear without horizontal scrolling.

## Copy and interaction
- Define Second Brain immediately as GDPVision’s connected national evidence library. Retain the current emphasis on sources, dates, confidence and government control.
- Keep the real view’s sector selection, evidence-type filters, verification filter and zoom controls.
- Treat Antigua as the live example—not a claim that every country already has the same evidence coverage.
- Provide distinct loading and unavailable/empty states with a retry action; never substitute invented memories or leave an endless “Loading” message.
- Preserve reduced-motion preferences and ensure the default diagram is completely visible, with no clipped controls or overlapping labels.

## Privacy and scope
The public homepage will use only the existing anonymous country-shape response. No private record titles, document text or admin-only memory queries will be added, including for signed-in visitors. No viewer, database change or new data integration is required.

## Technical implementation
- Add a focused homepage live-brain component using `BrainConstellation` and the existing `getCountryBrainShape` query, with the same Antigua country constant used by `/present`.
- Keep the country fixed when clearing filters. Reuse the public query cache key where appropriate.
- Update only the homepage Corpus section and any narrowly scoped presentation support needed for fit, accessibility or reduced motion. Preserve the existing `/present` appearance and behaviour.
- Remove the unused illustration import from the homepage without deleting the shared asset.
- Record the public-only homepage reuse rule in `AGENTS.md` during implementation.

## Verification
- Check desktop, tablet and phone layouts; confirm the brain receives at least half the desktop section width and starts fully visible.
- Exercise filters, clear and zoom with live data; verify loading and empty/unavailable states.
- Check that signed-out homepage requests return no record titles or private content.
- Check reduced motion, keyboard controls, the National Record link and `/present` for regressions.
- Confirm preview diagnostics are clean. Publishing is not included.