# Add the Decision Engine as its own step after "The corpus"

## Recommendation

Add a new full-screen step to `/present` straight after "How the Second Brain is fed". It shows the interactive Decision Engine from your screenshot inline, so you don't have to open a pop-up mid-briefing. It reuses the existing engine, so the 50 scenarios, Chamber filters, path buttons, click-to-pause and the "How this flow works" sidebar all work the same as on the homepage.

## What the step contains

- Small label: "05 · The decision engine"
- Title: "How a nation decides faster — and why that raises GDP"
- One-line lede: "One flow, five steps: evidence in, protected, worked, decided, GDP up."
- A tab switch for **National system** / **By Chamber**, same as the homepage pop-up, so you can follow one scenario through its Chamber live in the room.
- The interactive engine below, filling the slide width.

## Behaviour

- It slots into the briefing as a normal step: arrow keys and space move to it and away from it, and the progress list updates.
- The animation starts only when the step comes into view, so it isn't already halfway through when you arrive.
- The section labels after it each go up by one (chambers becomes 06, and so on).
- On a phone the engine stacks vertically, the same as it does on the homepage.

## Technical details

- New `DecisionEngineStep` inside `src/components/present/PresentDeck.tsx`, inserted between `<Step id="corpus">` and `<Step id="chambers">`, using `<Step id="engine" label="The decision engine">`.
- Render `<DataDecisionFlow />` / `<ChamberDecisionJourneys />` directly with local mode state. Mount them only after the step has been in view, using the existing `useInView`.
- Let the tall engine scroll inside the slide (`min-h-dvh`, internal height cap) so scroll-snap doesn't cut it off.
- Renumber the later `MICRO` labels.
- Verify at 1395×857 and 390×844: no overflow, arrow-key navigation still works, no console errors.
