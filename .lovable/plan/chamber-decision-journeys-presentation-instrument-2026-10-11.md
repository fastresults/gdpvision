# Chamber Decision Journeys — presentation instrument

## Recommendation

Extend the existing **Data & Decision Flow** experience with a second view called **Chamber Decision Journeys**. Keep one prestigious entry point and add a clear two-option switch inside the full-screen presentation:

- **National system** — the existing end-to-end map.
- **By Chamber** — the new scenario-led presentation.

Do not use a conventional dropdown. It hides the breadth of GDPVision and is awkward during a live presentation. Use a left-side **scenario library** with ten numbered Chamber marks and two concise scenario questions per Chamber. Large targets make it easy to present without searching or typing.

## The presentation sequence

Every selected scenario plays the same six-act story, so the audience learns the system once and can compare Chambers easily:

```text
1. THE QUESTION
   A real decision fills the screen.
                ↓
2. ASK GDPVISION
   The inquiry enters the national evidence system.
                ↓
3. GOVERNED EVIDENCE
   Corpus, Vault and safeguards gather only what the decision needs.
                ↓
4. SELECT THE CHAMBER
   All ten Chambers appear as an engraved constellation;
   the relevant Chamber is chosen and moves forward.
                ↓
5. OPEN THE CHAMBER
   The selected Chamber expands into its own internal method,
   with evidence moving through each stage and outputs forming visibly.
                ↓
6. VALUE TO THE PRIME MINISTER
   A short executive dividend register shows what changed.
```

The first journey should be **Chamber 03 · Scenario Engine: “Tourism receipts fall sharply — what should the Prime Minister do in the next 72 hours?”** It is immediately legible to a Federal Reserve audience: external shock, foreign exchange, fiscal exposure, employment, policy trade-offs and confidence.

## What the Chamber expansion shows

Each Chamber gets a distinct internal decision anatomy based on what the platform actually does:

1. **National Ledger:** question → cited figures → linked sectors → explanation → defensible national position.
2. **Portfolio Workspaces:** mandate → ministry influence → overlaps/dependencies → accountable owner → ministerial action.
3. **Scenario Engine:** baseline → shock/levers → GDP/debt/FX consequences → trade-offs → Cabinet option.
4. **FDI Transition Studio:** exposure → readiness gaps → replacement target → investor proposition → investable package.
5. **Narrative Chamber:** signal → verified facts → position → challenge test → authorised public response.
6. **Cabinet Room:** decision queue → evidence readiness → option comparison → recorded decision → owned commitment.
7. **Persona Lab:** policy proposition → audience design → simulated response → friction/acceptance → improved proposition.
8. **Mandate Compact:** pledge → pillar → deliverable → owner/KPI/date → quarterly accountability.
9. **Digital Government Studio:** service problem → requirements → governed design → approval → trusted public service.
10. **Sector Studio:** sector evidence → priority choice → diagnosis → growth roadmap/projects → Cabinet commitment.

This is deeper than the existing national map: the national map shows **where the decision travels**; this view shows **what the chosen Chamber does to the decision**.

## Scenario selection and live controls

- A **Featured for this briefing** row appears first with 4 high-relevance journeys: tourism shock, fiscal deficit choice, investor exit and financial/digital identity trust.
- The ten numbered Chamber marks remain visible beneath it; selecting one reveals its two existing scenarios as large question cards.
- A presenter can move with **Previous / Replay / Next** controls or let the journey advance automatically.
- A six-step progress rail labels the current act. Selecting any act jumps directly to it.
- The complete result holds on screen until the presenter advances; it does not automatically disappear during discussion.
- A **Benefits** control can reveal the final register immediately when time is short.

## Visual and motion direction

Preserve the selected animation’s engraved graphite-on-paper language, semantic colours and gold meaning:

- Graphite is structure, evidence and inactive paths.
- Gold appears only after a route has been authorised or completed.
- The ten Chambers begin as a compact ring around the Second Brain. The selected Chamber detaches, enlarges and unfolds into a full-width technical plate.
- Evidence travels as three staggered dots. A stage lights only when the dots land.
- The chamber interior uses the same draw-once rule: structure draws once, then remains static while scenario evidence moves through it.
- Motion feels measured and institutional, not theatrical: approximately 35–45 seconds per complete journey, with presenter-controlled pacing.
- Reduced motion shows each act as a complete still composition.

## The final executive dividend register

End each journey with four or five scenario-specific benefits, never generic promises:

- **What the Prime Minister now knows**
- **What choice is now clearer**
- **What risk was exposed or avoided**
- **Who owns the next action**
- **What will be measured and returned as evidence**

For the opening tourism-shock journey, the register should resolve to:

1. The GDP, revenue, foreign-exchange and employment exposure is visible in one cited view.
2. Policy options are compared before public money is committed.
3. The least damaging response is ready for Cabinet, with assumptions exposed.
4. A named owner, timetable and measures carry the choice into delivery.
5. Results return to the national record, improving the next decision.

Close with a restrained claim suited to a senior monetary-policy audience: **“GDPVision turns sovereign evidence into decisions that can be explained, governed, delivered and learned from.”** Avoid unsupported superiority claims or forecasted GDP gains.

## Build scope

1. Add the **National system / By Chamber** switch to the existing full-screen flow presentation without changing the current national map.
2. Build a dedicated Chamber journey view with the scenario library, presentation controls, act rail, Chamber constellation, expanded Chamber plate and executive dividend register.
3. Reuse the existing twenty scenario questions, but enrich each with Chamber-specific internal stages and Prime Minister benefits in a separate presentation data module.
4. Add the four Federal Reserve-relevant featured journeys and make the tourism shock the opening selection.
5. Preserve keyboard navigation, screen-reader narration, reduced motion and a phone layout; optimise the primary composition for a 16:9 presentation screen.
6. Verify every one of the twenty journeys end to end, including dot/path alignment, stage labels, benefit copy, replay, act jumping and full-screen presentation.

## Technical details

- Keep the current `DataDecisionFlow` unchanged and introduce a sibling `ChamberDecisionJourneys` inside the same full-screen dialog.
- Store presentation copy in a new data module keyed by the existing scenario and Chamber identifiers; each journey contains six acts, Chamber-specific stages and benefits.
- Use deterministic SVG geometry for the Chamber ring and expanded process plates. Animate only with the existing `ddf-*` conventions plus focused journey classes; no free-running decorative motion.
- Keep semantic design tokens and existing `btn-*` controls. Gold remains the travelled/authorised state only.
- Preserve the existing twenty-scenario validation and add validation that every journey names a real Chamber stage, has a complete evidence-to-benefit path and contains four or five executive benefits.
- Test at 16:9 desktop, the current desktop preview, phone width and reduced motion; confirm no overflow, overlapping copy or console errors.