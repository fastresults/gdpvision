
## Forensic root cause — why "Enrich the brief" hangs forever

The Auto-run console is a **client-driven, single-shot-per-phase** pipeline. Phase 1 (`enrichBrief`) never returns for these reasons (all confirmed in code):

1. **No fetch timeout to the AI Gateway.** `callGateway()` in `src/lib/personas/wizard.functions.ts` calls `fetch("https://ai.gateway.lovable.dev/...")` with **no `AbortSignal`**. If the upstream stalls, the Worker request stalls with it until the Cloudflare wall-time limit kills it — the browser fetch then hangs or 5xx's, but the UI row stays "RUNNING…".
2. **Three serial retry attempts, no per-attempt budget.** `callStructured()` runs up to 3 gateway calls sequentially (primary → self-repair → fallback). With no timeout each, worst-case exceeds Worker CPU/wall budget → the whole phase dies mid-flight without ever writing `autorun_status`.
3. **Client swallows the failure.** `runOnce()` in `AutoRunConsole.tsx` wraps the whole pipeline in `try { … } catch { /* halted */ }`. If a fetch throws *between* `patchRow("brief","running")` and the next `patchRow`, the console never marks the row `failed` — it just stops. The row visually stays "RUNNING…" and the Retry button never appears.
4. **Wrong model generation.** `GEN_MODEL_PRIMARY = "google/gemini-2.5-flash"` is a *prior* generation; the current catalog default is `google/gemini-3.5-flash` with `google/gemini-3.1-flash-lite` for cheap/fast repair passes. Prior-gen calls are more prone to slow queueing.
5. **No server-side idempotency lock.** Two tabs, a reload, or a stray Retry can double-start the same phase. Nothing guards on `brief_scope IS NULL` in a transaction.
6. **Phase 3 (`draftCast`) does N Perplexity `sonar-reasoning-pro` calls in a `for` loop** with no timeout, no concurrency cap, and no budget. Even if Phase 1 is fixed, this is the next timebomb.
7. **Auto-run is not durable.** Progress is persisted only through best-effort `saveDraft({ autorun_status })`. Close the tab and the job dies. There is no server orchestrator, no heartbeat, no resume — unlike the onboarding stages, which already use `onboarding_tasks` for exactly this pattern.

## The workflow, corrected — AI-first, durable, resumable

Mirror the pattern that already works for country onboarding (`onboarding_tasks` + client-driven micro-batches + heartbeat + self-heal). Move Auto-run from *"one big browser fetch per phase"* to *"tiny idempotent server steps the browser ticks through a work queue"*.

```text
Browser  ──tick()──►  Server: runAutorunTick(draftId)
                        │
                        ├─ acquire heartbeat lock (60s TTL, refreshes on tick)
                        ├─ read draft → decide next phase from stored state
                        │    (brief_scope? → outcome_blueprint? → cast_draft? → study_id? → synthesis?)
                        ├─ execute exactly ONE phase, with per-phase time budget
                        │    and AbortSignal on every upstream fetch
                        ├─ write phase result + autorun_status + phase_log[]
                        └─ return { nextPhase, done, error? }
Browser  ◄─ poll every 1.2s, render phase_log, retry-on-error with backoff
```

### Concrete changes

**A. Gateway hardening (`src/lib/personas/wizard.functions.ts`)**
- Add `AbortSignal.timeout(45_000)` to every `fetch` in `callGateway` and `perplexityDeepResearch`.
- Switch `GEN_MODEL_PRIMARY` → `google/gemini-3.5-flash`, `GEN_MODEL_FALLBACK` → `google/gemini-3.1-flash-lite`.
- Add `response_format: { type: "json_object" }` to the chat-completions body; keeps `safeParse` as belt-and-braces.
- Reduce `callStructured` attempts from 3 → 2 (primary + fallback-lite), each ≤ 45 s. Third attempt only if the *fallback* itself parses partially.
- Send `X-Lovable-AIG-SDK: vercel-ai-sdk` and propagate the returned `X-Lovable-AIG-Run-ID` back into `autorun_status.run_id` for correlation with AI Gateway logs.

**B. Perplexity budget (Phase 3 gap probes)**
- Cap gaps at 3 (not 5), run with `Promise.allSettled` and a 30 s timeout each; skip on timeout instead of blocking the phase.
- Total Phase 3 wall budget: 90 s; if exceeded, commit whatever cast we have and mark `cast_draft.partial: true`.

**C. Durable orchestrator (new: `src/lib/personas/autorun.functions.ts`)**
- `startAutorun({ draftId })` — creates/refreshes an `autorun_status` row with `{ status: "queued", locked_at: null, phase_log: [] }`.
- `runAutorunTick({ draftId })` — the only long-lived call. Acquires an advisory lock (compare-and-set `locked_at`, 60 s TTL), runs **one** phase, refreshes `locked_at` mid-phase, releases on return. Returns `{ nextPhase, done, error }`. Idempotent: re-runs re-derive the next phase from persisted state (`brief_scope` set? skip Phase 1, etc.) — no double-work.
- `cancelAutorun({ draftId })` — sets `status: "canceled"`; the next tick exits cleanly.
- `getAutorunStatus({ draftId })` — cheap poll endpoint (used by the console).

**D. Rewrite `AutoRunConsole.tsx` as a poller**
- On mount, call `startAutorun`, then poll `getAutorunStatus` every 1.2 s.
- After each poll, if `nextPhase` is set and no lock is held, call `runAutorunTick` (fire-and-forget with a 60 s client timeout; the tick self-completes even if the browser closes).
- Render `phase_log[]` from the server as the source of truth (no more client-only `PhaseRow[]`).
- On `error`, show inline message + "Retry this phase" button that calls `runAutorunTick` again; the server decides whether to resume or restart the failing phase.
- Remove the silent outer `try/catch` — every error now travels through `phase_log`.

**E. Idempotency guards on every phase**
- `enrichBrief`: no-op if `brief_scope` already present.
- `enrichOutcome`: no-op if `outcome_blueprint.deliverables` present *and* `ai_status !== "scaffold_only"`.
- `draftCast`: no-op if `cast_draft.personas.length > 0`.
- `commitStudy`: no-op if `study_id` present on the draft.
- Synthesis (`draftStudyQuestions` + `runStudy`): guarded by `study.status`.

**F. Observability**
- Every phase writes a `phase_log` entry `{ phase, state, model, run_id, duration_ms, error? }`.
- `AutoRunConsole` shows model + run-id under each phase so we can jump straight to `ai_gateway_logs--get_ai_gateway_request`.

**G. Migration**
- One migration: add `phase_log jsonb DEFAULT '[]'`, `locked_at timestamptz`, `locked_by text` to `persona_study_drafts` (piggybacking on the existing `autorun_status jsonb`). Include the required `GRANT`s per the public-schema rule.

## What the user will see

- Phase 1 finishes in ≤ 45 s or fails clearly with a Retry button — no more infinite spinner.
- Closing the tab mid-run and reopening resumes exactly where it stopped.
- Each phase card shows model + latency + a link-worthy run-id.
- Two tabs on the same draft can't collide (lock).
- Phase 3 stops being a Perplexity black hole; missing gaps degrade gracefully.

## Out of scope

- No redesign of the Studio UI/UX beyond the auto-run console itself.
- No change to the Wizard's manual step-by-step path (it already works and the new server functions replace only the auto-run driver — the underlying `enrichBrief` / `enrichOutcome` / `draftCast` / `commitStudy` handlers stay the same, just hardened).
