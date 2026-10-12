# Reframe the opening proposition as GDPVision’s business case

## Recommendation

Turn the slide from a product description into a concise argument:

1. Governments cannot act confidently when evidence is fragmented, late or difficult to verify.
2. GDPVision creates one government-controlled place to test choices before Cabinet commits.
3. The chosen decision becomes an owned, traceable delivery record.

This gives the rest of the presentation a clear question to answer: how does GDPVision help a government know, choose and deliver better?

## Proposed slide copy

**Section label**  
01 · The case for GDPVision

**Title**  
Turn fragmented national evidence into decisions government can defend and deliver.

**Block 1 — Know what is true**  
Bring public records and protected government data into one trusted national picture. Every figure carries its source, method, confidence and date.

**Block 2 — Choose before committing**  
Compare credible options, consequences and trade-offs before Cabinet commits public money, political capital or implementation capacity.

**Block 3 — Deliver what was decided**  
Turn the chosen course into named ownership, milestones and an enduring record that carries decisions through delivery and across elections.

## Visual treatment

- Keep the restrained three-column structure, but make it read as a left-to-right progression rather than three unrelated descriptions.
- Add subtle `01`, `02`, `03` labels and a fine connecting rule across the columns: **evidence → decision → delivery**.
- Keep the headline to two lines at the presentation’s normal desktop size so the argument lands in one glance.
- Emphasize the first sentence of each block; use the second sentence as proof or safeguard.
- Preserve the existing paper, ink and fine-line visual system; no new illustration or decorative card treatment.
- On smaller screens, stack the three stages in order with a vertical connecting rule and no overlap.

## Scope

- Update only the “What it is” slide in the live briefing.
- Preserve the current reveal sequence, presentation navigation and surrounding slide order.
- Verify desktop and mobile readability, line wrapping and the staged reveal.

## Technical details

- Edit the existing `what` step in `src/components/present/PresentDeck.tsx`.
- Use the presentation’s existing semantic styles and animation primitives.
- Do not change data, viewers, routes or backend behavior.
