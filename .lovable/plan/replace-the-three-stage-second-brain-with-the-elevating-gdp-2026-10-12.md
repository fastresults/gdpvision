# Replace the three-stage Second Brain with the “Elevating GDP” puzzle

## Recommendation

Use the existing **Corpus + ten interlocking Chambers** artwork as the source of truth, but create a purpose-built compact version for the three-stage diagram rather than shrinking the homepage’s entire interactive component. This keeps every puzzle piece, Chamber number, central Corpus, gold GDP line and “Elevating GDP” message legible inside the presentation.

The current sovereign-corpus diagram has one small dotted Second Brain circle on the left feeding Stage 1, Stage 2 and Stage 3. That single mark will be replaced; the three stage cards and their meaning will remain intact.

## Implementation

1. **Create a reusable presentation puzzle mark**
   - Reuse the same ten-piece geometry and Chamber order as the existing “Elevating GDP” ring.
   - Preserve the central `CORPUS · GRADED · CITED` core, numbered puzzle pieces and restrained gold GDP line.
   - Add a compact `ELEVATING GDP` caption beneath it; omit the long outer Chamber names at this smaller size to avoid unreadable text.
   - Give the mark a complete screen-reader description.

2. **Replace the dotted circle in the three-stage flow**
   - Remove the small `SECOND BRAIN` circle from the left side of the Stage 1–3 illustration.
   - Place the larger puzzle mark in that position and rebalance the SVG so it has enough visual authority without crowding the stage cards.
   - Route all three animated paths from the Corpus core/puzzle assembly into:
     - Stage 1 — Live global feeds
     - Stage 2 — The sovereign data center
     - Stage 3 — You hold the switch
   - Keep the red sovereign-data path and gold public/control paths visually distinct.

3. **Make the motion explain the relationship**
   - Draw the Corpus core first, assemble the ten Chamber pieces, then send the three signal dots toward their corresponding stages.
   - Keep click-to-pause/resume behavior exactly as it works now.
   - Under reduced-motion settings, show the fully assembled puzzle and completed paths immediately.

4. **Keep the visual language consistent**
   - Use the existing paper, ink, line, gold and signal-red tokens only.
   - Preserve the current Stage 1–3 typography, state boundary and final “Evidence the government controls, end to end” outcome.
   - Update the project note that currently reserves `CorpusMark` for briefing circuits, documenting this intentional “Elevating GDP” exception for this sovereign-corpus diagram only.

## Validation

- Check the new section at the current 1397×857 presentation size and on a phone-sized viewport.
- Confirm all ten puzzle pieces and Chamber numbers remain visible, stage copy does not overlap, and the final outcome remains readable.
- Confirm animation order, click-to-pause/resume, and reduced-motion behavior.
- Confirm no horizontal scrolling, console errors or build errors.
