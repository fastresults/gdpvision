# Data & Decision Flow — a scenario library: two journeys for every Chamber

## What the visitor gets
1. **A Chamber picker** above the map: ten numbered chips (01 Ledger … 10 Sector Studio), plus "All" to run everything.
2. Picking a Chamber shows **its two scenarios as cards** (the question, one line each). Pressing a card runs that journey straight away.
3. **Autoplay** stays: with "All" chosen, the map runs through all 20 scenarios in order (3-second hold between each). With one Chamber chosen, it alternates its two scenarios.
4. The caption keeps the format "Chamber 05 · Scenario 1 of 2 — A scandal breaks inside Cabinet. What do we do?" plus the step line underneath.
5. Pause/Play, clicking a box to explain it, and the path buttons keep working as they do now. On phones the chips scroll sideways and the cards stack.

## The 20 scenarios (my recommendation — wording can be changed)
- **01 National Ledger**: (a) The IMF questions our growth figure — can we defend it? (b) Tourism arrivals drop 15% — how big is the hit to GDP?
- **02 Portfolios**: (a) A new minister takes office — which growth levers do they own? (b) Two ministries claim the same programme — who delivers?
- **03 Scenarios**: (a) Citizenship by Investment receipts fall — what replaces the revenue? (b) Should we raise VAT or cut spending to close the deficit?
- **04 FDI Studio**: (a) A new national project is ready for global promotion — what do we do? (b) A major foreign investor threatens to leave — how exposed are we?
- **05 Narrative**: (a) A scandal breaks inside Cabinet — what do we do? (b) A natural disaster is imminent — how do we prepare the public?
- **06 Cabinet Room**: (a) Five urgent decisions, one Cabinet session — what comes first? (b) A flagship commitment is slipping — intervene or re-plan?
- **07 Persona Lab**: (a) Will citizens accept a new property tax before we announce it? (b) Will the diaspora invest in a national bond?
- **08 Mandate Compact**: (a) A new government takes office — turn the manifesto into a delivery plan. (b) The quarterly review shows three ministries off track.
- **09 Digital Government**: (a) Business registration takes six weeks — make it one day. (b) Launch a national digital ID people trust.
- **10 Sector Studio**: (a) Which three sectors should the next budget back? (b) Build a growth plan for the agriculture sector investors can back.

Each journey runs from evidence on the left, through the Chamber in question, to a GDP outcome on the right — labelled as a pathway, never a forecast. Private-data journeys (for example the scandal and the property tax) route through the Vault to show sensitive records staying at home.

## Technical details
- `DataDecisionFlow.tsx`: replace the 5-item `SCENARIOS` with 20 entries, each tagged `chamber: "01".."10"`, `title`, `question`, steps `[edges, text]`, `outcome`. Move them to a new data module `src/components/marketing/dataDecisionScenarios.ts` to keep the component readable.
- Add missing map lines where a journey needs one (e.g. `c05 → commit`, `c01 → brief` already exists; `vault → c05`, `c09 → delay`, `c04 → c03`, `c08 → c02`), keeping the existing check that every scenario only uses drawn lines — the check runs over all 20.
- State: `chamberFilter` ("all" | "01".."10"), `playlist` derived from the filter, `scenarioIdx` within the playlist. Replace the five numbered tabs with the chip row + two scenario cards; cards are buttons (`card-choice` / `card-choice-active`).
- Reduced motion: selecting a card shows that route as a still, as now.
- Verify in the browser: every Chamber's two scenarios run with dots and lit boxes in step, autoplay across all 20 with the 3-second hold, phone layout, no console errors.
