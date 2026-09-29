# Replace the decision-loop engraving with the National Custody Relay

## Creative direction
Build a monochrome, hand-drawn **National Custody Relay** that mirrors the five steps directly beneath it. A protected national evidence register remains visibly inside a country-controlled boundary while an authorised decision marker moves through Understand, Rehearse, Decide, Deliver, and Learn. The evidence itself never travels outside the boundary; access marks and approvals accumulate around it.

This is the strongest approach because it supports the section’s existing decision-loop story while making national control unmistakable, without repeating the Vault’s server metaphor or the sovereignty section’s custody seal.

## What will change
- Replace only the selected static engraving in the homepage decision-loop opening.
- Introduce the five stages in sequence, then hold the complete composition on screen for three seconds before replaying continuously while visible.
- Use restrained graphite linework, cross-hatching, paper tones, and the existing gold accent for authorised actions only.
- Let visitors focus or point at each stage to pause the sequence and read a concise explanation.
- Keep the national evidence register stationary throughout; only governed actions and approvals move.
- Provide a fully composed still version for reduced-motion visitors.
- Preserve the section’s current headline, body copy, five explanatory columns, spacing, and links.

## Technical details
- Add a focused React/SVG animation component sized to the existing illustration area.
- Start and replay only while the section is in view; pause during interaction and resume cleanly.
- Support keyboard focus, meaningful accessible labels, mobile sizing, and no sideways overflow.
- Remove the obsolete image import from the homepage while leaving the source asset untouched.
- Add scoped animation styles using existing design tokens only.

## Verification
- Check the complete sequence, exact three-second final hold, and continuous replay.
- Check desktop, mobile, keyboard interaction, reduced motion, and section alignment.
- Confirm no page errors and a clean preview build.
