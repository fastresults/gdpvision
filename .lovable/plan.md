# Reconnect Perplexity research to its new service

## Finding
- The saved Perplexity key is valid and now has credits (a test search succeeded).
- Perplexity has retired the old address the app uses. Every research call now gets "Sonar is now the Agent API — use /v1/responses", so all Perplexity-powered features are still blocked: onboarding research, persona research, press discovery/classification, ledger research.

## Plan
1. Move all Perplexity calls onto one shared helper that talks to the new Agent API (`/v1/responses`), keeping today's behaviour: system + user prompt, domain allowlist, recency, JSON output, citations, open-web retry, timeouts.
2. Map old model names to the new presets (e.g. `sonar` -> `fast-search`, `sonar-pro` / `sonar-reasoning-pro` -> the deeper search presets, `sonar-deep-research` -> the deep-research preset), confirming each preset name with a live test first.
3. Keep the clear "out of credits" message (401 insufficient_quota) and surface any other provider error with its status.
4. Verify with one live call per feature, then re-run the Tourism persona research pass (draft set 24ec8b8f…) so the 50 profiles get citations, leaving the set as a draft.

## Technical details
- Files: `src/lib/country-onboarding/perplexity.server.ts` (rewrite `callSonar` on `/v1/responses`, parse `output` text + search results into citations), and switch direct fetches in `ledger.functions.ts`, `narrative-chamber.functions.ts`, `personas/wizard.functions.ts`, `press-discover.server.ts`, `press-monitor.functions.ts`, `press-monitor.server.ts` to the helper.
- No database changes. Run `bun run headers && bun run map` after edits.
