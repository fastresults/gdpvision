# Executive perspective for economic charts

## Recommended experience

Add one shared, centered **Executive perspective** panel for every chart and economic measure in the CARICOM/OECS summary.

- Start a **2-second dwell timer** when the pointer rests on a chart, measure, comparison row, trend, or member-distribution mark.
- Cancel the timer if the pointer leaves before two seconds, preventing accidental flashes while scanning.
- Present a compact, non-blocking panel in the center of the screen after activation. It will not dim the page or capture focus like a conventional modal.
- Replace the panel content when the user deliberately hovers another item; close it on pointer exit after a short grace period or with Escape.
- Make click/tap pin the panel so users can inspect it without holding the pointer in place. Keyboard focus opens it immediately for accessibility.

## Panel content

Every supported visual will provide the same executive reading structure:

1. **Executive summary** — the current result in one plain-language sentence.
2. **Bloc perspective** — CARICOM versus OECS on the same measure, including the magnitude and direction of the difference.
3. **Trend** — improving, weakening, stable, or unavailable, based only on comparable historical observations.
4. **Member perspective** — whether the bloc result is broad-based or concentrated among a few members.
5. **Decision relevance** — what the result may imply for scale, resilience, fiscal room, employment, trade, or investment.
6. **Coverage and caution** — period, member coverage, aggregation method, and a clear warning where higher is not necessarily better.

The copy will avoid unsupported causal claims. It will clearly distinguish observed data, calculated comparisons, and interpretation.

## Coverage

Wire the experience to:

- headline measures and their comparison bars;
- performance measures and reference markers;
- trend charts;
- member-distribution strips and individual country marks;
- every CARICOM/OECS row in the Compare tab.

Section headings and decorative marks will not trigger it.

## Interaction and presentation

- Keep the panel centered within the visible viewport, above the right-side summary sheet, with a stable maximum width and height.
- Use the established paper, ink, CARICOM, OECS, gold, and signal tokens; preserve the current editorial visual language.
- Highlight the originating chart or measure while its perspective is active.
- On small screens, use a compact bottom sheet opened by tap instead of hover.
- Respect reduced-motion preferences and use an immediate fade rather than movement when enabled.

## Technical approach

- Create a reusable perspective controller/provider inside the economic-summary feature so all visuals share one timer, one active item, and one pinned state.
- Derive summaries deterministically from the already-loaded bloc metrics, trends, distributions, coverage, and comparison values. Do not invoke AI during hover.
- Add typed perspective builders for measures, trends, distributions, and comparison rows, keeping financial meaning rules explicit—for example, lower debt or unemployment can be preferable.
- Route derived statements through the existing Explain-this rationale registry and extend its entries for executive perspective and trend interpretation.
- Remove native `title` hover text from member marks once the richer accessible panel covers it; retain descriptive ARIA labels.

## Validation

- Confirm no panel appears before two seconds and that leaving early cancels it.
- Verify every chart and measure in all three tabs opens the correct summary and perspective.
- Verify rapid movement does not leave stale content or flicker.
- Verify click/tap pinning, Escape, keyboard focus, mobile presentation, and reduced-motion behavior.
- Run type, lint, map-consistency, build, and signed-in interaction checks.
