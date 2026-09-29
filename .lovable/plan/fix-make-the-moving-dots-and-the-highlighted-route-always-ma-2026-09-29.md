# Fix: make the moving dots and the highlighted route always match

## What's going wrong
Your screenshot shows the dots on the first step of Scenario 5, moving from National KPIs and Ministries into the Corpus. But the boxes lit up are a different set: Portfolios, Narrative, Cabinet Room, Mandate Compact, Digital Government, Sector Studio, Cabinet decisions, Tracked commitments, Less decision delay and Delivery on the record. That is exactly the set the **"Delivery" path button** highlights.

So two different things are drawing on the map at once:
1. **A path button overrides the scenario highlighting, but the dots keep running.** Once Evidence, Safeguards, Money or Delivery is selected, the map shows that path while the dots carry on with the scenario. That is why the Corpus looks greyed out while dots are arriving at it.
2. **Some lines are always gold,** whatever is showing. Every line into the Decisions and Outcomes columns is coloured gold by default, so they look "active" even when no dots use them.
3. **Boxes light up too early.** A box turns gold the moment its step begins, before the dots reach it. The highlight runs ahead of the flow.

## The fix
- **One thing drives the map at a time.**
  - Scenario mode: only the current scenario's route is lit, and dots run.
  - Path mode: pressing a path button pauses the scenarios and hides the dots. The caption changes to "Showing the Delivery path — press Play or pick a scenario to resume."
  - Pressing Play or a scenario number clears the path button and goes back to the scenarios.
  - Clicking a box behaves like path mode: dots pause, only that box's connections light up.
- **Gold means "on the current route" only.** Remove the fixed gold on lines into Decisions and Outcomes. In scenario mode, only lines the dots have already travelled turn gold. The line the dots are on now is drawn in a stronger graphite while they cross it. Everything else stays faint grey.
- **Boxes light when the dots arrive.** Each step lights its starting boxes immediately. The destination box lights only when the dots land, about 1.2 seconds later, with a brief gold pulse. Lit boxes stay lit until the scenario ends.
- **Routes always follow drawn lines.** Add a check that every scenario step uses a line that exists on the map, so dots never travel along an undrawn route. Fix any step that fails.

## Technical details
- `DataDecisionFlow.tsx`:
  - Replace the separate `selected` / `filter` / scenario checks with a single `mode`: `"scenario" | "path" | "node"`. Setting a filter or selecting a box sets `playing=false` and hides dots. `jump()` and Play reset `filter` and `selected` to null.
  - Lit sets: `litEdges` = completed steps. `activeEdges` = current step, shown in stronger graphite. `litNodes` = sources of the current step plus all nodes from completed steps. Add a `landed` flag, set by a 1.2s timeout per step, that adds the current step's destinations.
  - Edge colour: `gold` only when in `litEdges` (scenario mode) or linked to a selected box (node mode). Remove the hard-coded destination-based gold.
  - A development-time assertion that every scenario edge is in `EDGES`.
- `styles.css`: add a `ddf-land` pulse keyframe for box arrival.
- Verify in the browser: sample all five scenarios step by step and confirm the lit boxes and lines match each step's dot route. Confirm path buttons stop the dots and show the path caption, and that Play restores the scenarios. No console errors.
