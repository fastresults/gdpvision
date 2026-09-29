# Data & Decision Flow — step-by-step copy rewrite

## Goal

Replace the "How to read this map" sidebar with a clear, succinct step-by-step flow that walks a visitor through the whole journey and makes the case that GDPVision is the definitive way to elevate GDP. No layout change, no functional change — copy only (plus one small headline touch-up in the dialog header).

## Proposed copy

### Sidebar: "How this flow works" (was "How to read this map")

A numbered five-step flow, each step one line, numbers matching the five columns of the map:

1. **Evidence in.** Real national data enters: statistics, ministries, KPIs, capital flows, peer benchmarks — and private records too.
2. **Protected.** Every source is checked, cited and graded in the Second Brain. Private data stays on state-owned servers in the Vault.
3. **Worked.** Ten Chambers understand, rehearse, decide and deliver — every option tested before it is announced.
4. **Decided.** Costed, cited briefs; tracked commitments; investor packages ready to fund the plan.
5. **GDP rises.** Less decision delay, better-targeted spending, new investment — results published, and each cycle decides faster.

Closing statement (the case):

> This is the loop that elevates GDP — and GDPVision runs it end to end: every number cited, every decision traceable, every record under national control. No other platform does this for a sovereign state.

Safety line kept, unchanged: "A pathway, never a forecast. Private data never leaves national control."

Interaction hint condensed to one short line beneath the steps: "Select any box to pause and see what it does. Use the path buttons to follow one thread."

### Dialog header (small touch-up, same voice)

- Title: "How a nation decides faster — and why that raises GDP" (was "How evidence becomes better decisions — and more GDP")
- Description: "One flow, five steps: evidence in, protected, worked, decided, GDP up." (was "Every part of the platform, and how it moves the economy forward.")

## Where the edits go

- `src/components/marketing/DataDecisionFlow.tsx` — sidebar block (lines ~464–470): replace the three paragraphs with the five-step list, the case statement, the condensed hint, and the unchanged safety line. Update the header label "How to read this map" → "How this flow works".
- `src/components/marketing/DataDecisionFlowDialog.tsx` — `DialogPrimitive.Title` and `DialogPrimitive.Description` strings.

## Guardrails

- No functional changes; the map, scenarios, dots and panels stay exactly as they are.
- Only tokens registered in `@theme inline`; buttons stay on `btn-*` utilities (none added here).
- Wording stays plain-language and relatable, claims stay credible (pathway, never a forecast).
- Verify in the preview that the sidebar renders cleanly on desktop (320px column) and mobile (stacked above the map), then publish.
