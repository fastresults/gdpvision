# Decision Brief animation replacement

## Recommended creative direction: “The Decision Dividend Engine”

Replace the static calculating-machine engraving with a purpose-built animated pen-and-hatch instrument in the same right-hand space.

The animation will make one idea immediately legible: **better evidence shortens the distance between a national question and a governed decision; shortening that distance protects or releases measurable value.** It will remain an estimate—not a promise or forecast.

## Visual story

1. **The unresolved question** — small graphite evidence marks enter from the left while a restrained clock arc records delay.
2. **The decision instrument** — evidence, assumptions and safeguards align inside a central engraved mechanism. Loose marks resolve into one qualified path.
3. **Two consequences** — a faint downward route represents the cost of delay; a confident gold route moves forward as the governed decision.
4. **National value** — the route finishes in a rising value register labelled **Decision dividend**, with **up to 1.2% of GDP · model ceiling** shown clearly rather than presenting a fabricated currency figure.
5. **Closing caption** — **Better evidence. Faster decisions. More national value protected.**

## Art direction

- Match GDPVision’s established monochrome graphite engraving and fine cross-hatching.
- Use gold only for the qualified route and final value pulse.
- Build the artwork as precise SVG linework, not a generic chart or stock illustration.
- Keep typography sparse: `EVIDENCE`, `DECISION`, `VALUE`, plus the model-ceiling disclosure.
- Preserve the current approximately 300px footprint and balance against the headline; no page reflow.
- Keep the animation quiet and institutional: draw-on lines, measured dial movement, evidence alignment and one restrained value pulse.

## Interaction and accessibility

- Start once when the artwork enters view, then settle into a subtle recurring instrument motion.
- Hover or keyboard focus reveals short stage explanations without obscuring the artwork.
- Pause while engaged so labels remain readable.
- Show a complete static composition when reduced motion is preferred.
- Keep the existing phone behaviour unless the finished artwork remains legible at small size; no animation will create sideways scrolling.

## Implementation

- Add a focused `DecisionDividendEngine` component beside the brief headline.
- Replace only the selected arithmometer illustration in the Decision Brief opening.
- Add semantic animation styles and reuse existing paper, ink, line and gold tokens.
- Preserve the calculator, its country data, assumptions, formulas and all page copy.
- Verify the final sequence, hover/focus details, reduced-motion state, desktop balance, mobile overflow, and current build status.
