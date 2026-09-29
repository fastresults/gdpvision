# Data & Decision Flow — draw once, then run five scenario journeys

## What changes for the visitor
1. The map draws itself **once** when the window opens, then stays still. It no longer replays.
2. Once it's drawn, a **scenario caption** appears above the map. It names a real decision, for example: "Scenario 1 of 5 — If Citizenship by Investment receipts fall, what replaces the revenue?"
3. Gold **dots** then travel only along the route that scenario takes, from the evidence on the left to the GDP outcome on the right. The boxes on that route light up one after another. Everything else fades back. A short line under the caption names the current step, for example "Capital flows → Corpus: the revenue exposure is measured."
4. When the dots reach the outcome, the result holds for 3 seconds. A small dot travels the gold return line back into the evidence. Then the next scenario begins. After Scenario 5 it goes back to Scenario 1.
5. Controls: five numbered scenario tabs (jump to any), plus Pause/Play. Clicking a box still pauses the journey and opens its explanation. The path buttons (Evidence, Safeguards, Money, Delivery) stay.

## The five scenarios (recommended)
Each one shows a different Chamber at work, so together they cover the whole platform.

1. **Revenue shock: the Citizenship by Investment cliff**: Capital flows + Public statistics → Corpus → 01 Ledger → 03 Scenarios → Decision Brief → Cabinet decisions → Better-targeted spending.
2. **Attracting investment into a sector**: Caribbean peer benchmarks + Capital flows → Corpus → 10 Sector Studio + 04 FDI Studio → Investor packages → Investment attracted.
3. **A sensitive policy tested with citizens**: Private government records → Sovereign Vault → Citations, grades & Explain → 07 Persona Lab → 05 Narrative → Cabinet decisions → Less decision delay. This one shows private data staying inside the Vault.
4. **Turning the mandate into delivery**: Manifestos & mandates + Ministries & ministers → Corpus → 08 Mandate Compact + 02 Portfolios → Tracked commitments → Delivery on the record → the return loop.
5. **A digital service that removes friction**: National KPIs + Ministries & ministers → Corpus → 09 Digital Government → 06 Cabinet Room → Tracked commitments → Less decision delay → Delivery on the record.

Each step has a one-line plain-language narration. Each scenario ends on an outcome line, labelled as a pathway, never a forecast.

## Motion feel
- Several dots move in a staggered stream along each connection, about 1.2 seconds per step, so the flow reads as a journey rather than a single blink.
- A box glows gold as the dots arrive, then stays softly lit for the rest of that scenario.
- Each scenario runs about 10–12 seconds, then holds for 3 seconds.
- Reduced motion: no moving dots. Each scenario's route is shown fully highlighted as a still, and visitors step through the scenarios with the tabs.
- Phones: the same scenario caption and tabs. The route is shown by lighting up boxes in order in the stacked list.

## Technical details
- `DataDecisionFlow.tsx`:
  - Remove the replay timer and cycle key. The drawing animation plays once per open.
  - Add a `SCENARIOS` array: id, title, question, steps as ordered `[from, to, narration]` edges, and an outcome.
  - Store edge paths in a lookup so each dot can move along an edge's geometry using SVG `<circle>` with `<animateMotion>` over `mpath`, or a requestAnimationFrame loop using `getPointAtLength`.
  - Drive steps with a state machine (scenario index, step index, playing). Start 9s after open (once the drawing is complete). Hold 3s at the end of each scenario, then advance.
  - Any steps missing from `EDGES` are added (e.g. the Vault feeding Persona Lab, Persona Lab feeding Narrative, Portfolios feeding commitments, Digital Government feeding the Cabinet Room).
- Clicking a box or pressing Pause freezes the step timer. Resume continues from the same step.
- `styles.css`: add `ddf-dot` and `ddf-lit` styles. Remove the static/loop replay rules that are no longer used.
- Verify in the browser: the map draws once, all five scenarios cycle with the 3-second hold, tabs jump, pause works, reduced-motion stills show, and there are no console errors.
