## What "Queued for auto-run" means

The current state is **not a stuck runner** — it is a **valid-but-misleading status**. The draft `4f30e381-0498-44bc-a258-1d32ca1c69d0` for GRD has:

- `brief_raw` = empty
- `brief_scope` = null
- `autorun_status` = `{ status: "queued", message: "Queued for auto-run" }`
- `locked_at` = null
- `phase_log` = empty

So the auto-run has been queued, but the first phase (`brief`) has not executed. It cannot execute because `runAutorunTick` → `executePhase("brief")` calls `enrichBrief`, which requires `brief_raw` to be non-empty. When it finally runs, it will fail immediately with "Draft has no brief text." The UI still shows the initial queue message, so the user reads this as stuck.

## Root-cause fixes

1. **Pre-flight validation before allowing auto-run**
   - Block `startAutorun` and the UI "Auto-run" affordance when the draft has no brief text.
   - Show a contextual message: "Add a brief to auto-run the full study end-to-end."

2. **Distinguish queue states in the UI**
   - "Queued for auto-run" → show when a brief is present and the runner is polling.
   - "Waiting for brief" → show when auto-run is desired but the draft cannot start.

3. **Fail fast on the first tick**
   - If `runAutorunTick` finds `brief_raw` empty, set the status to `failed` with a clear message immediately, rather than leaving the draft in `queued`.

4. **SessionsHub card clarity**
   - If a draft has `autorun_status = queued` but no `brief_raw`, render it as "Waiting for brief" (amber) instead of "Queued for auto-run" (neutral grey).
   - Disable the auto-run button on empty drafts; keep the "Resume" path open.

5. **Wizard UX guardrail**
   - In the Brief step, when the user clicks "Auto-run full study", validate `text.trim()` before setting the modal into auto-run mode. If empty, show an inline error and keep the composer open.

## Implementation scope

| File | Change |
|------|--------|
| `src/lib/personas/autorun.functions.ts` | Add `brief_raw` to `loadDraft` select; in `startAutorun` reject empty drafts; in `runAutorunTick` fail fast on empty `brief_raw`. |
| `src/lib/personas/wizard.functions.ts` | (Minor) ensure `listDrafts` returns `brief_raw` so SessionsHub can validate. |
| `src/components/personas/StudyWizard/SessionsHub.tsx` | Disable auto-run on empty drafts; rename display status to "Waiting for brief" when queued but empty. |
| `src/components/personas/StudyWizard/WizardModal.tsx` | Add inline validation on the "Auto-run full study" button; prevent auto-run state if brief is empty. |
| `src/components/personas/StudyWizard/AutoRunConsole.tsx` | Detect "queued but no brief" and surface "Waiting for brief" with a clear CTA to add the brief. |

## Outcome

Users will never see an idle "Queued for auto-run" spinner on a blank draft. The system will explicitly ask for a brief first, and the runner will fail fast with a human-readable message instead of hanging.