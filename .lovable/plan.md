## Why the button doesn't flip

`StageCard`'s Run button label is:

```
{running ? "Researching…" : draft ? "Re-run agent" : "Run AI research"}
```

`draft` is the row from `onboarding_drafts` for this stage. The drafts query in `getOnboardingState` (`agents.functions.ts` L160-165) filters `.is("committed_at", null)` — only **uncommitted** drafts.

Stage 10 `runCorpusIngest` **auto-commits** its draft at the end (`corpus.functions.ts` L1532-1533 → `markDraftCommitted`). So the moment the run finishes, `committed_at` is stamped and the draft drops out of the list. The parent re-fetches (`refresh()`), `draft` becomes `undefined`, and the label snaps back to `Run AI research`.

The "committed" pill next to the header still shows because it reads `lastRun.status === "committed"` from the runs list (unaffected by the draft filter). So the state IS post-run — the label just doesn't reflect it.

Stages 1–9 don't auto-commit, so their draft sticks around and the label correctly flips to `Re-run agent`. Stage 10 (and any other auto-commit stage) is the only one affected.

## Fix

In `src/routes/_authenticated/admin/countries.$code.onboard.tsx`, change the label condition in `StageCard`'s Run button (currently around line 690) so it treats "already ran, no matter whether the draft is still open" as `Re-run agent`:

```
const hasRun = Boolean(draft) || Boolean(lastRun);
// …
{running ? "Researching…" : hasRun ? "Re-run agent" : "Run AI research"}
```

`lastRun` is already passed into `StageCard` and already reflects both open and committed runs for the stage, so no data-layer change is needed.

Also update the two "Run AI research" copy references that show inside stage 10's body when `!report` (line ~929 "No ingest run yet — click **Run AI research**…") — leave those alone; they're only shown when there's no run yet, which is the correct empty state.

## Verification

1. Reload `/admin/countries/LCA/onboard`, open stage 10 which already has a committed run.
2. Button reads **Re-run agent** immediately (previously read "Run AI research").
3. Open stage 1 with an open draft — still reads **Re-run agent**.
4. Open a stage with no runs at all — reads **Run AI research**.
5. Click **Re-run agent** on stage 10 → label goes `Researching…` → back to `Re-run agent` after completion (no longer flips to `Run AI research`).

## Out of scope

- Changing auto-commit behavior for corpus_ingest.
- Any change to `drafts` query, `onboarding_runs`, or other stage cards' logic.
