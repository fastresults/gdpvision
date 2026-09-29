# Get the 20 Chamber scenarios showing where you're looking

## What's going on
The two-per-Chamber version is already built: 20 scenarios, a row of Chamber buttons (All, 01–10), and two scenario cards for each Chamber. I opened it in the preview at 21:57 UTC, picked Chamber 05 and played "A scandal breaks inside Cabinet."

Your screenshot shows the older version (buttons 1–5, "Scenario 4 of 5 — Mandate into delivery"). So the screen you're looking at hasn't picked up the change yet. That happens in one of two cases:
- **The live website** (gdpvision.com) still has the version from before. The new version only goes live once it's published.
- **The preview** was already open before the change, so it's still showing the old page.

## Steps
1. Reload the preview, open "Data & Decision Flow" and confirm the Chamber buttons 01–10 appear. Take a screenshot as proof.
2. Play both scenarios for every Chamber (all 20) and check that the dots and lit boxes stay in step and there are no errors.
3. Check the phone layout: the Chamber buttons scroll sideways and the two cards stack.
4. Publish, so the live website shows the 20 scenarios too.

## Technical details
- Code in place: `src/components/marketing/dataDecisionScenarios.ts` (20 entries tagged `chamber`), and `DataDecisionFlow.tsx`, which uses `CHAMBER_NAMES`, the chamber chip row, scenario cards and a `playlist` state.
- Checks use Playwright, waiting for `networkidle` before clicking so the page has finished loading. A script clicks each chamber chip and each card, and samples the lit boxes against the step edges.
- Then publish.
