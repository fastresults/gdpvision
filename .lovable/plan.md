# Five decision journeys per Chamber, and a richer "Open the Chamber" + Prime Minister value

## Part 1 — Three new journeys per Chamber (30 new, 50 total)

Selection rule for every new journey: a situation a small-state Prime Minister and Cabinet actually face, that forces a time-bound decision, carries GDP or fiscal consequence, and plays to that Chamber's method. Each Chamber's five journeys mix one **shock**, one **opportunity**, one **slow-burn structural** issue, and one **political/credibility** test, so the set feels diverse rather than five variations of one theme.

Proposed additions (existing two stay as they are):

| Chamber | New journey 3 | New journey 4 | New journey 5 |
|---|---|---|---|
| 01 National Ledger | IMF Article IV mission arrives in two weeks | Debt-service spike after a rate rise | Remittances fall as diaspora economies slow |
| 02 Portfolios | Ministry overspending mid-year | Two ministries claim the same programme | Delivery stalled on a flagship road/port |
| 03 Scenarios | Category 4 hurricane track 96h out | Oil price jumps 40% — fuel and electricity bills | Major airline cuts routes for next season |
| 04 FDI Transition Studio | Citizenship-by-investment rules tightened abroad | Hotel group wants tax concessions to expand | Correspondent bank de-risking threatens payments |
| 05 Narrative | Leaked audit on a state enterprise | Opposition claims "cost-of-living crisis" | Viral misinformation during an emergency |
| 06 Cabinet Room | Budget week trade-offs across ministries | Public-sector wage negotiation and strike threat | 100-day review of election commitments |
| 07 Persona Lab | Appointing a new Minister of Tourism | Shortlisting a central-bank / statistics head | Preparing a Minister for a hostile donor meeting |
| 08 Mandate Compact | Manifesto promises vs fiscal room | Donor-funded programme off track | Mid-term mandate reset before elections |
| 09 Digital Government Studio | Government payments go digital (pensions, grants) | Cyber-attack on a government service | Business-licence approvals take months |
| 10 Sector Studio | Agriculture after drought — food import bill | Blue economy / fisheries licensing plan | Renewable energy transition to cut power costs |

Each new journey carries the full existing shape: question, evidence routing through the flow map, Chamber method, and five Prime Minister benefits — all written in the same plain, direct tone. I will ask to swap any you'd rather not show a Federal Reserve audience before building is finalised; otherwise these ship.

Selector UX for 50 journeys: keep the Chamber row, then show that Chamber's five journeys as compact cards tagged Shock / Opportunity / Structural / Credibility. "All" cycles one journey per Chamber, rotating which one each pass.

## Part 2 — Richer "Open the Chamber" (act 5)

Today it shows five stage labels and an output line. New version reads as a briefing, not a diagram:

- Each of the five stages becomes a card with three lines specific to the journey: **what goes in** (named evidence), **what the Chamber does**, **what comes out**.
- A running "decision clock" shows time saved vs the usual process (e.g. "3 weeks → 2 days"), labelled illustrative and explainable.
- Stages light up in sequence with the evidence dots from act 3 visibly feeding stage 1, and the output line building as each stage completes.
- Closing banner: the one decision the Cabinet can now take, in a single sentence.
- Pacing: slower act duration for this act only, presenter can pause/step per stage.

## Part 3 — Richer "Prime Minister value" (act 6, the five benefits)

Each of the five benefits (Knows, Choice, Risk, Owner, Measure) gets:

- A short headline (5–7 words) above the existing sentence, so the slide reads at a glance from across a room.
- A "before / with GDPVision" contrast line (e.g. "Before: conflicting figures from three ministries. With: one cited number.").
- A small engraved icon in the house style, and a staggered reveal.
- A final summary line tying the five to GDP: "Faster, defensible decisions — protected growth."

## Technical details

- Scenarios: add 30 entries to `dataDecisionScenarios.ts` (chamber, title, question, path through existing flow nodes/edges); the dev-time edge check already validates paths. Add a `kind` field for the tag.
- `chamberDecisionJourneys.ts`: add 30 `BENEFITS` entries; extend `BenefitSeed` with per-benefit `headline` and `before` fields (backfill the existing 20); add per-journey `stageDetail` (5 × {in, does, out}), `clock` and `decision`. Update the dev check to require ≥5 journeys per Chamber.
- `ChamberDecisionJourneys.tsx`: redesign act 4/5 renderers, per-stage stepping, longer act-5 timing, grouped selector; keep reduced-motion static states and graphite/gold tokens.
- The national map's "All" cycle and the 20-scenario caption on the homepage plates update to the new count.
- Verify all 50 journeys run end to end in the browser at 1399×936 and phone width, no console errors.
