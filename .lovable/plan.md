## Diagnosis (confirmed by DB + code read)

The draft in the screenshot (GRD, id `4f30e381…`) has:
- `brief_raw` present, `brief_scope` **null**, `step = "brief"`
- `phase_log = []`, `locked_at = null`
- `autorun_status = { phase: "brief", state: "running", ts: "18:04:42", message: null }`

That `autorun_status` shape (`phase` / `state`) is **not written by any current code**. The current orchestrator (`src/lib/personas/autorun.functions.ts`) writes the new shape `{ status, next_phase, last_phase, updated_at, message }`. Grep confirms only `autorun.functions.ts` writes the column, and no DB trigger touches it.

So the "AUTO · BRIEF · RUNNING" pill you see is **stale legacy state** from a pre-refactor auto-run that saved `brief_raw` and then crashed before writing `brief_scope`. Two compounding bugs keep it stuck:

1. **Shape mismatch — SessionsHub reads the old shape.** `SessionsHub.tsx:119-176` reads `autorun_status.state` / `.phase`. The new orchestrator writes `.status` / `.next_phase`. Result: legacy rows show "RUNNING" forever, and any *new* auto-run would show no pill at all (state undefined).
2. **No stale-state reset on "Auto-run" click.** `onAutoRun` just opens the console; it never calls `startAutorun` up front to clear a dead status. The console *does* call `startAutorun` on mount, but only after the hub button check `disabled={autoRunning}` — which the stale legacy row can trip.

Net effect: the brief was **partially saved** (raw text) but the AI-enriched `brief_scope` never landed, and the UI keeps showing "running" because it's reading a shape that hasn't existed for a release.

## Fix

### 1. Normalize `SessionsHub` to the current AutorunStatus shape
`src/components/personas/StudyWizard/SessionsHub.tsx`:
- Type `autoStatus` as `AutorunStatus` from `@/lib/personas/autorun.functions`.
- Derive `autoRunning = autoStatus?.status === "running"` (not `.state`).
- Show pill from `status` + `last_phase` (fall back to `next_phase`); tolerate the legacy shape for one release by also checking `.state === "running"` so nothing regresses, but render from normalized values.
- Show a stale badge (amber "stalled") when `status === "running"` but no `locked_at` within `LOCK_TTL_MS` — instead of blocking the button.

### 2. Reset before resume in the hub
In `onAutoRun(draftId)` (route file `countries.$code.personas.index.tsx`), call `startAutorun({ data: { draftId } })` before opening the wizard/console. `startAutorun` already nulls `locked_at`/`locked_by` and writes a fresh `AutorunStatus`, so any stale/legacy row is normalized on first click. Keep the console's own `startAutorun` call (idempotent).

### 3. One-shot cleanup of legacy `autorun_status` rows
Run a data-only update (via the migration tool, no schema change) that clears rows whose `autorun_status` uses the old shape or is stuck "running" with no live lock:

```sql
update public.persona_study_drafts
set autorun_status = null, locked_at = null, locked_by = null
where autorun_status is not null
  and (
    autorun_status ? 'state'                              -- legacy shape
    or (
      autorun_status->>'status' = 'running'
      and (locked_at is null or locked_at < now() - interval '2 minutes')
    )
  );
```

This unsticks the GRD draft (and any siblings) so the "Auto-run" button becomes actionable and the console can drive it to completion — starting from `brief` because `brief_scope` is null.

### 4. Belt-and-suspenders in the orchestrator
`src/lib/personas/autorun.functions.ts`:
- In `getAutorunStatus`, if `autorun_status` doesn't have a `status` key, treat it as `null` (ignore legacy shape) so the UI never renders it.
- In `runAutorunTick`, if `currentStatus.status === "running"` **and** the lock is stale (no `locked_at` or older than `LOCK_TTL_MS`), proceed (already handled by the CAS lock) but also overwrite the status to `queued` so a UI polling in between never sees phantom "running".

### 5. Verify
- Open GRD → Chamber 07 → the stuck draft. Confirm pill clears / becomes "stalled".
- Click Auto-run → console opens, `startAutorun` fires, `runAutorunTick` executes `brief`, `brief_scope` populates, phase_log grows, status advances to `outcome`.
- Requery `persona_study_drafts` for GRD: `brief_scope not null`, `phase_log` has a `brief · done` entry, `autorun_status.status = "queued"` with `next_phase = "outcome"`.

## Technical notes

- No schema change needed — `phase_log`, `locked_at`, `locked_by` already exist.
- The cleanup SQL is safe: it only clears orchestrator bookkeeping; `brief_raw`, `brief_scope`, `outcome_blueprint`, `cast_draft`, `study_id` are untouched, so `deriveNextPhase` correctly resumes from `brief` for this draft.
- No changes to `wizard.functions.ts` handlers — idempotency guards there already prevent double-writes when the tick retries.
