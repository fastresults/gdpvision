# GDP Vision API after the gap fillers

## Short answer
You don't need to change anything in GDP Vision's API. It already sends the new results:
- Stories raised by the guarantee come through as **P1** (`priority_level: 1`).
- Each story also carries a new field, `priority_raised_from`. It shows the original level (2, 3 or 4) when a story was raised, and is empty when the story reached P1 on its own.
- Newly tagged older stories now carry their politics, GDP and government topics, so topic filters return more results.

The existing GDP Advisor key already has media access, so no new key or setting is needed.

## Your steps
1. **Publish GDP Vision.** Until then, the live site doesn't include the guarantee or the new field.
2. **Optional: update the GDP Advisor app.** Open that project's chat and paste:

   "GDPVision media signals now include `priority_raised_from` (2, 3, 4 or null). When it is set, show a small 'P1 · Guaranteed (from P{n})' badge next to the P1 label. Every country now always has at least one P1 GDP and one P1 political story. Make sure the country signals view shows the top P1 for each topic (`topic=gdp` and `topic=politics`, `min_priority=1`). No credential change is needed."

3. **Quick check after publishing.** In GDP Advisor, open Antigua's signals, filter to P1 and GDP, and confirm at least one story appears.

## Technical details
- No code change in GDP Vision is required. The `toPublicSignal` function in `src/lib/public-data/media.ts` already maps `priority_override` to level 1 and emits `priority_raised_from`. The MCP tool uses the same shaping.
- The internal raise reason (`priority_raised_reason`) stays private and is not shared.
