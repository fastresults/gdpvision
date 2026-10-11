# Make "Select the Chamber" and "Open the Chamber" more detailed and persuasive

## The problem today

- **Select the Chamber (step 4)** is a ring of ten numbered circles with one highlighted. It shows *which* Chamber was picked, but not *why*, or why the other nine weren't picked. A senior viewer gets no reasoning.
- **Open the Chamber (step 5)** is now five cards with In/Out lines. It's clearer, but it's still a flat row of text. It doesn't show evidence being worked, a person making the call, or safeguards along the way.

## Step 4 — "Select the Chamber": a routing decision you can see

Shown as three short beats (about 9 seconds in total, and the presenter can step through them):

1. **Read the question.** The question appears as a slip with 3–4 key words picked out in gold (e.g. "tax holiday", "15-year", "expand"). Each key word gets a signal tag: *Investment*, *Fiscal cost*, *Jobs*, *Time horizon*.
2. **Weigh all ten Chambers.** The ten Chambers sit in a 2×5 grid, each with its name and a one-line "what it answers". A fit bar fills on each one as the signals land, and each Chamber gets a short reason, e.g. "Prices the deal" or "Not a public-message problem". Most Chambers settle low and fade; one or two come out as *supporting* Chambers.
3. **Route the question.** The chosen Chamber lifts forward with a gold frame and a "Lead Chamber" stamp. Thin lines show the supporting Chambers it will call on (taken from the scenario's own flow, e.g. FDI Studio calling on Scenarios). A caption reads: "Routed to Chamber 04 · FDI Transition Studio — because this is a price-the-deal question, not a messaging one."

The fit scores are **illustrative** and labelled that way, with an explanation you can open. They are fixed per scenario: they come from which Chambers the scenario's flow actually passes through. Nothing is random.

## Step 5 — "Open the Chamber": a working session, not a list

Laid out as a vertical "decision dossier", one of the five stages active at a time (about 2.5 seconds each, with stage-by-stage stepping):

```text
 EVIDENCE TRAY        CHAMBER WORKBENCH (active stage)         DECISION FILE
 [source chips]  -->  02  Test national readiness         -->  [builds up line
 public / vault        What we ask      ...                     by line as each
 graded A/B/C          What we use      ...                     stage completes]
                       What we found    ...
                       Safeguard  [citations checked]
                       Who signs off   Minister · Treasury
```

- **Evidence tray (left):** 4–6 source chips for this scenario (e.g. "Peer hotel deals", "Tax expenditure records"), each marked *Public* or *Kept in country*, with a grade. The chips the active stage uses light up and move across.
- **Workbench (centre):** the active stage expands with five short lines: *What we ask*, *What we use*, *What we found*, *Safeguard*, *Who signs off*. The other stages shrink into a numbered rail above it so progress is always visible.
- **Decision file (right):** a document that builds up line by line as each stage completes, ending with the Cabinet decision, the owner and the review date. It carries a "Decision ready" seal when complete.
- **Header:** the time-to-decision clock stays (illustrative), plus a small "Evidence used: 5 sources · 2 kept in country" counter.
- **Close:** the dark banner keeps the one decision Cabinet can now take, and adds the next step to the right: "Then → Prime Minister value."

## Content depth

- Each Chamber's five stages get their own standing text for *What we ask*, *Safeguard* and *Who signs off*. These describe how the Chamber works, so they're written once per Chamber (10 × 5).
- *What we use* and *What we found* stay specific to each scenario and come from its existing flow steps and outcome, so all 50 scenarios get the richer view without 250 new paragraphs.
- Each scenario gets its source chips and the key words picked out in step 4. These are written for the six featured scenarios; the rest are derived from the evidence their flow uses (statistics, peers, flows, Vault and so on).

## Presentation behaviour

- Steps 4 and 5 run longer when playing on their own. Next/Previous moves one beat or stage at a time while paused, so the presenter can talk over each part.
- If the viewer has reduced motion turned on, every beat and stage is shown fully, without animation.
- At phone width everything stacks: question slip, then grid, then lead Chamber; and tray, workbench, file top to bottom.

## Technical details

- `ChamberDecisionJourneys.tsx`: replace the act 3 orbit SVG and the act 4 card row with `ChamberRouter` and `ChamberDossier` subcomponents (new files in `src/components/marketing/journeys/`), each driven by a `beat` index from the parent (auto timer plus manual stepping).
- `chamberDecisionJourneys.ts`: add `CHAMBER_PURPOSE` (one line per Chamber), `STAGE_PLAYBOOK` (10 × 5 entries with ask, safeguard and signoff), a `routing(journey)` helper (lead, supporting, fit scores taken from the scenario edges), and `evidenceChips(journey)` taken from the source nodes.
- Register an `<Explain>` entry explaining the illustrative fit scores and clock.
- Use only existing graphite and gold tokens and `card-choice` styles; add new animation styles under the existing `cjj-*` styles in `styles.css` and cover them in the reduced-motion block.
- Check in the browser at 1399×936 and 390px wide on several scenarios across Chambers, with no console errors.
