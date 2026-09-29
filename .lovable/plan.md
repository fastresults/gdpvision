# Sovereign Custody Seal animation

## Recommended direction

Replace the suitcase engraving in the homepage Sovereignty section with a compact, monochrome animated instrument called the **Sovereign Custody Seal**.

The animation will make control—not storage hardware—the central idea:

1. **National evidence enters** a clearly drawn country-controlled boundary.
2. **Role gates recognise authorised officials** while an unauthorised route remains closed.
3. **Custody and activity marks accumulate** into a visible, reviewable chain inside the boundary.
4. **A named approval gate opens** for one authorised release while the underlying national record remains sealed in place.
5. The completed state resolves to: **“Held nationally. Access governed. Release authorised.”**

This avoids repeating the Vault’s server-focused animation and directly explains the selected section’s promise.

## Build

- Create a dedicated `SovereignCustodySeal` visual using the established engraved graphite SVG language, paper/ink tokens, fine hatch marks, and restrained gold only for active authority and approval.
- Replace only the existing Sovereignty illustration; preserve the headline, explanatory copy, five safeguards, section layout, and Vault link.
- Make the four stages keyboard-, pointer-, and touch-accessible, with short plain-language explanations below the visual.
- Start the sequence when the section enters view, pause during exploration, stop when it leaves view, and replay continuously while visible.
- Let the full sequence complete, remain fully assembled for three seconds, then restart.
- Provide a complete static composition for reduced-motion users.

## Technical details

- Add a focused React/SVG component beside the existing public animation components.
- Add scoped animation classes and keyframes to the shared design stylesheet, using existing semantic tokens only.
- Remove the now-unused Sovereignty image import from the homepage component; leave the asset itself untouched.
- Keep dimensions stable so the section does not shift during playback and remains legible on desktop and mobile.

## Verification

- Check the full sequence, three-second completed hold, replay, pause/resume, and out-of-view stopping.
- Verify keyboard, touch, reduced-motion, desktop, and mobile presentations.
- Confirm no sideways scrolling, overlaps, console errors, or build errors.
