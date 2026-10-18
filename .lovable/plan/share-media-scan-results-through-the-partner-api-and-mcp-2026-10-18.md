# Share media scan results through the Partner API and MCP

## Current state
- The Partner API (v2) and MCP share 11 data types: brand, kpis, commitments, ministries, government, sectors, datasets, procurement, projects, brain, sources.
- Media scan results (Narrator Chamber signals, source strength profiles, the new politics/GDP/country tags) are not among them. They were left out on purpose because signals can include draft responses and internal notes.
- So right now API users do not get the new scan data, and no setting turns it on.

## What to build
1. New `media` data type: confirmed or promoted media signals from the last 30 days, per country. Each one includes headline, outlet, verified link, published date, topic tags (politics / GDP / country), priority level P1–P5, importance score and source strength tier S1–S5.
2. Never shared: draft statements, recommended responses, pin/flag notes, items marked Noise, internal reviewer actions.
3. Optional `media-sources` data type: outlet name, country, reach/frequency/influence tier. No internal health or error details.
4. Filters: `since`, `topic`, `min_priority`, matching the existing `since` style.
5. MCP gets a matching read-only `list_media_signals` tool.
6. Admin → Partner API: new tick boxes for these data types.

## What you need to do
- Existing keys keep their current access. To give GDP Advisor the media data, tick the new box on its key (or issue a new key).
- Publish afterwards so it goes live.

## Technical details
- Add `media`, `media_sources` to `API_SCOPES` and labels in `src/lib/egov/api-keys.functions.ts`.
- Add readers in `readPublicResource` (public-data) using the admin client inside the handler, with a column allow-list and status filter (exclude noise/dismissed, 30-day window, limit 200 with `next_since`).
- Add the MCP tool behind the same allow-list; update the API docs page and `docs/map` (`bun run headers && bun run map`).
- Tests: Noise and draft fields are never returned; items older than 30 days are excluded; a key without the scope gets 403.
