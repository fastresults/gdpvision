## Forensic diagnosis

Symptom: clicking **Build deliverable blueprint** in Chamber 07 · Step 2 fails / hangs / returns "AI returned no blueprint — try again."

What the evidence shows:
- The Lovable AI Gateway call succeeds (HTTP 200, ~12.5s, 1349 in / 1831 out tokens on the most recent attempt).
- The failure is on our side: `safeParse` in `src/lib/personas/wizard.functions.ts` cannot recover a `{ deliverables: [...] }` object from the model's response, or Gemini emits it under a different top-level shape / with markdown fences / with a reasoning preamble large enough that the greedy `\{[\s\S]*\}` regex grabs the wrong braces.
- There is no retry, no schema enforcement, no model fallback, and no way for the user (or us) to see the raw output. A single bad completion kills the whole step and the mutation surfaces one short red line.
- The 8-second-plus wait with a single spinner also reads as "broken" to the user even when the call is still in flight.

Root cause: the step is **one unguarded LLM call with a soft prompt-level JSON contract**. It has no schema, no repair, no fallback, no observability, and no deterministic floor — so any Gemini quirk (fenced output, extra prose, `type: reasoning` chunk, key rename) drops the whole step.

## Fix: a robust, multi-layer blueprint pipeline

Rebuild `enrichOutcome` as a small pipeline with a guaranteed floor, then wire the UI to show progress and debug detail.

### 1. Deterministic scaffold floor (server)

In `src/lib/personas/wizard.functions.ts`, add `DELIVERABLE_TEMPLATES` — a hand-authored map keyed by the 8 codes in `DELIVERABLE_LIBRARY`, each with McKinsey-grade default `sections`, `evidence_density`, `length_hint`. Build a `scaffoldBlueprint(selectedCodes, tone)` that returns a valid `DeliverableBlueprint` from templates alone. This is the floor: the step can never return "no blueprint" again.

### 2. AI enrichment with structured output + repair loop

Replace the current single `callGateway` call with `enrichBlueprintWithAi(scaffold, scope, extraGuidance, tone)`:

- **Primary attempt** — use the AI SDK (`generateText` + `Output.object`) via the existing `createLovableAiGatewayProvider`, model `google/gemini-2.5-flash`. Pass a strict Zod schema mirroring `DeliverableBlueprint` (no `.min/.max`, all fields required, `.nullable()` for optional). Prompt asks the model to *refine* the scaffold (tighten sections, tune length hint, respect tone, weave in scope + extra guidance), not create from scratch.
- **Self-repair on parse failure** — catch `NoObjectGeneratedError` (per `ai-sdk-lovable-gateway`), `JSON.parse` `error.text`, and if that also fails, run one repair call: "Your previous response wasn't valid JSON for this schema. Here is what you returned: <raw>. Return the same content, valid JSON only."
- **Model fallback** — on second failure, retry with `openai/gpt-5.4-mini` (build a second provider with `structuredOutputs: true` so `Output.object` enforces the schema server-side).
- **Floor merge** — whatever survives (AI or repair or fallback) is *merged into the scaffold*, per-deliverable, preserving any AI-improved `sections/length_hint/evidence_density` and falling back to scaffold values field-by-field. If every AI attempt fails, we still return the scaffold, mark `ai_status: "scaffold_only"`, and store the raw AI output + last error on the draft so the user can retry manually without losing the step.

### 3. Persist attempts + observability

Extend the `persona_study_drafts.outcome_blueprint` JSON payload with:
```
{ tone, deliverables, ai_status: "enriched"|"repaired"|"scaffold_only", ai_model, ai_run_id, ai_raw_excerpt, ai_error }
```
Forward the `X-Lovable-AIG-Run-ID` header from the provider (via `withLovableAiGatewayRunIdHeader` / `getLovableAiGatewayRunId`) so we always have a run id to correlate with `ai_gateway_logs`.

### 4. UI: honest progress + debug + never-empty state (`src/components/personas/StudyWizard/WizardModal.tsx`)

- Split the button state into 3 visible phases: `Scaffolding → Enriching with AI → Finalizing`. Drive with a `useState` phase updated by an optimistic timer while the mutation is pending, so the user always sees motion (matches Chamber 07 tone).
- On success, the right-hand panel always renders (scaffold is never empty). Add a small chip: `AI enriched` / `Repaired` / `Scaffold only — retry`.
- On `scaffold_only`, show an inline "Retry AI enrichment" button (calls a new `retryOutcomeAi` server fn) and a collapsed `<details>` "Debug" with `ai_model`, `ai_run_id`, first 400 chars of `ai_raw_excerpt`, and `ai_error`. Also surface the run id in the error toast so we can jump straight to gateway logs.
- Keep the `<PrettyJson>` contract for the debug JSON (per project memory).

### 5. Guard the other wizard steps with the same primitives

`enrichBrief` and `draftCast` have the exact same fragility. In this same pass, extract the retry/repair/fallback logic into a shared `callStructured<T>(system, user, schema, { fallbackModel })` helper in `wizard.functions.ts` and use it in all three steps. `draftCast` also gets a deterministic scaffold (personas synthesized from `context-pack` corpus rows) so the wizard can never bottom out.

## Files to change

- `src/lib/personas/wizard.functions.ts` — add `DELIVERABLE_TEMPLATES`, `scaffoldBlueprint`, `callStructured` helper, rewrite `enrichOutcome`, add `retryOutcomeAi` server fn, extend blueprint payload; apply the same helper to `enrichBrief` and `draftCast`.
- `src/lib/ai-gateway.server.ts` — accept optional `{ structuredOutputs?: boolean }` so OpenAI fallback enforces the schema (per `ai-sdk-lovable-gateway`).
- `src/components/personas/StudyWizard/WizardModal.tsx` — phased progress, always-visible scaffold, status chip, retry-AI button, debug `<details>` with `PrettyJson`.
- No schema/migration changes: everything fits in the existing `outcome_blueprint jsonb`.

## Success criteria

- Clicking **Build deliverable blueprint** never leaves the user with an empty red-lined step — worst case they see the scaffold blueprint with a visible "Retry AI enrichment" affordance.
- When AI succeeds, sections/length/evidence density reflect the scope and extra guidance (verified end-to-end on GRD with the CBI rebrand example).
- When AI fails, `ai_run_id` and a raw excerpt are visible in the UI and stored on the draft for forensics.
- Same robustness pattern is in place for Step 1 (brief) and Step 3 (cast), so the wizard degrades gracefully instead of dead-ending.
