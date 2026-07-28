Refine the closing paragraph of Section 01 · What is at stake so it carries more clarity and force.

The selected paragraph is `STAKES_CLOSE` in `src/lib/business-case.ts` (lines 108-109). It is the bridge between the six stake figures and the rest of the paper. Its job is to name the exact challenge a government faces, not merely to list the pressures again.

Problems with the current copy:
- It is one long sentence that carries too many ideas: three pressures, fiscal slack, emigration, and stale data all compete for attention.
- "The region must govern against all of them" is vague. It does not say what governing against them actually means in this context.
- "Using an evidence base that describes a country that no longer exists" is strong but gets buried at the end.
- The phrase "physical-risk corridor that is no longer seasonal" is abstract and could be crisper.
- The transition from the stakes to the next section ("It is instrumentation, not effort") is weak; the paragraph should tee up the instrumentation argument.

Proposed revision:
```
Set those figures together and the problem becomes unmistakable. Three sovereign pressures are now running on the same deadline: the revenue model that pays for half the state is ending; the trade rules that shape competitiveness are being written elsewhere; and the hurricane corridor is no longer a seasonal worry — it is a structural fiscal risk. A government facing all three at once has no fiscal slack, a shrinking pool of people who can do the work, and an evidence base that describes the country as it was two years ago. The challenge is not a lack of effort. It is a lack of instrumentation fit for the transition ahead.
```

Why this works better:
- One idea per sentence, sequenced from diagnosis to consequence.
- The three pressures are named in plain language that mirrors the preceding figures (CBI revenue, tariff regime, natural disasters).
- The final sentence pivots cleanly to the next section: "It is instrumentation, not effort."
- The stale-data point is preserved but sharpened: "describes the country as it was two years ago."
- The emotional weight is carried by the stacking of pressures and the mismatch between the evidence and the moment, not by adjectives.

Implementation steps:
1. Replace the `STAKES_CLOSE` string in `src/lib/business-case.ts` with the revised version.
2. Check that the revised paragraph does not break the layout: it is rendered in `src/routes/business-case.tsx` at line 192 inside a `grid` with the cliff illustration, so length should remain roughly comparable.
3. Verify tone consistency with the rest of `business-case.ts` — no exclamation points, no marketing hyperbole, no first-person plural, keep the sober decision-paper voice.
4. Run `bun run lint` to ensure no formatting issues.
5. Open the preview at `/business-case` and scroll to Section 01 to confirm the paragraph sits cleanly next to the cliff illustration and reads with the right cadence.

No other file changes are needed; the paragraph only appears in this one location.