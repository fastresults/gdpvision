## What's broken

On `/blueprint` for Project Destiny the AI returns **"Program brief is too short to design a research plan."** even though the brief was committed. Commit already enforces ≥40 chars *combined* (typed + upload excerpts) plus a valid `brief_scope`. But `composeBlueprint` reads **only** `brief_raw` and rejects anything under 20 chars — it ignores the upload excerpts and the enriched `brief_scope` that the intake already produced. So any brief that leans on an uploaded RFP / dictation snippet with a short typed intro dead-ends here with no recovery path.

The fix must be AI-first: the Blueprint should assemble every piece of context it already has (typed brief, upload excerpts, enriched scope, country + program metadata, and — when still thin — the country's second-brain corpus) and only *then* ask the model to draft segments and studies. The UI should never leave the admin stranded at "too short" with only a Generate button.

## Plan

### 1. `composeBlueprint` — assemble the full brief, not just `brief_raw`

`src/lib/personas/blueprint.functions.ts`

- Select `brief_raw`, `brief_uploads`, `brief_scope` (in addition to what's already read).
- Build a `combinedBrief` = trimmed `brief_raw` + each `uploads[i].excerpt` (labeled) + a compact serialization of `brief_scope` (objectives, hypotheses, decisions, stakeholders, timeframe, geography, sensitivities, success_criteria).
- Replace the current `brief.length < 20` guard with `combinedBrief.length < 40` (matches commit's own floor). This alone fixes Project Destiny.
- Pass `combinedBrief` (capped ~12k chars) to the model as the `COMMITTED BRIEF` block, and include a `RESEARCH SCOPE` block rendered from `brief_scope` so the model reasons off the structured version, not just prose.

### 2. AI-first auto-augment when the brief is still thin

Same file, before calling the model:

- If `combinedBrief.length < 400` OR `brief_scope` is missing key fields, call a **context pack** helper that pulls country-level signals already in the corpus:
  - country name + iso, active ministries, priority sectors, recent narrative signals, top KPIs. Reuse existing helpers where possible (`src/lib/personas/context-pack.server.ts`, `country-onboarding` accessors).
- Append this as a `COUNTRY CONTEXT` block in the prompt so the model can still design a defensible plan even from a terse brief, rather than refusing.
- Never throw "too short" from Blueprint — if the combined signal is still genuinely unusable, return a structured `needs_more_brief` result (see step 3) instead of erroring.

### 3. Structured "assist me" response instead of hard error

- On the rare case where even country context can't ground a plan, `composeBlueprint` returns `{ status: "needs_more_brief", suggestions: string[], missing: string[] }` where `suggestions` are AI-drafted questions the admin should answer (e.g. "Which decision must this inform by when?", "Which 2-3 audiences do you already suspect matter?"). No thrown error.
- `BlueprintReview.tsx` renders that state as an AI-assisted callout with:
  - the AI's specific missing-signal questions,
  - a one-click **"Draft brief additions with AI"** button that calls a new small server fn `suggestBriefAdditions` (reuses country context) and appends the suggestions to `brief_raw` via existing `saveProjectBrief`,
  - a **"Back to Brief"** link that reopens `ProgramBriefIntake` with those questions pre-loaded as guided prompts.

### 4. UI: replace the red "too short" toast on `/blueprint`

`src/components/personas/StudyWizard/BlueprintReview.tsx`

- Remove the raw-error rendering path for the "too short" message; route that condition through the new `needs_more_brief` UI from step 3.
- Keep Generate / Regenerate for all other cases. Add an inline note under the Generate button when auto-augmentation ran: "Blueprint drafted from brief + country corpus."

### 5. Verify

1. Load `/blueprint?project=<destiny>` → clicking **Generate Blueprint** now produces segments + studies (no "too short" error).
2. Create a new program, commit a deliberately terse 45-char brief with no uploads → Blueprint still generates using country context, and shows the "drafted from brief + country corpus" note.
3. Create a program with an essentially empty brief (edge case) → Blueprint returns `needs_more_brief`, the UI shows AI-suggested questions and the "Draft brief additions with AI" button; clicking it appends suggestions and re-runs Generate cleanly.
4. Existing programs with rich briefs behave identically to today.

### Files to touch

- `src/lib/personas/blueprint.functions.ts` — combined brief, auto-augment, `needs_more_brief` return shape, new `suggestBriefAdditions` fn.
- `src/components/personas/StudyWizard/BlueprintReview.tsx` — render `needs_more_brief`, wire the assist buttons, drop the raw "too short" surface.
- (Read-only reuse) `src/lib/personas/context-pack.server.ts` and country accessors already in the tree — no schema changes.

No DB migrations. No changes to Cast / Group / Rehearse. Blueprint remains the single guided cockpit; it just stops refusing to help.
