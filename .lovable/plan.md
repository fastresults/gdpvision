## Fix: make "committed" reflect reality, not just the latest run's status

### Root cause
`committed` is derived from `lastRun.status === "committed"`. Re-running a stage creates a fresh run in `planning`/`ready`, which flips `committed` to false even though the target table still holds the previously-committed rows. And nothing garbage-collects stuck `planning` runs or superseded drafts.

### Changes

**1. Server: `listOnboarding` returns a new `committedTargets` map**
Add per-stage target-row counts to the payload:
```
committedTargets: {
  profile: { rows: 1, lastCommitAt: '2026-07-13T15:13:11Z' },
  gdp: { rows: 1, ... },
  sector_composition: { rows: N, ... },
  source_registry: { rows: 15, ... },
  ministries: { rows: N, ... },
  ministry_sector_map: { rows: N, ... },
  kpi_seed: { rows: 0, ... },
  sector_dossier: { rows: 0, ... },
}
```
`rows` comes from a targeted count query per stage (`countries` for profile/gdp, `country_sectors`, `country_sources`, `ministries`, `ministry_sectors`, `country_kpis`, `sector_dossiers`). `lastCommitAt` = max `finished_at` of committed runs for that stage.

**2. Client: single source of truth for `committed`**
Replace the two mismatched derivations:
- Parent progress counter and each stage card BOTH use `committedTargets[stage].rows > 0`.
- `lastRun.status` is only used for the *activity* line ("Last run: … status planning"), never for the commit badge.

**3. Four explicit stage states, each with a distinct header UI**

| State | Header shows |
|---|---|
| **Committed, no newer draft** | Green `✓ Committed (N rows) · MM/DD HH:mm` pill only |
| **Committed + newer draft awaiting** | Amber `Re-commit draft to X` button + `✓ Committed (N rows)` pill next to it |
| **Uncommitted, has draft** | Green `Commit to X` button (current behavior) |
| **Uncommitted, no draft** | Disabled `Commit (no draft)` with tooltip |

The Re-run confirmation for a committed stage adds: *"Existing committed rows stay until you commit the new draft."*

**4. Draft hygiene**
- `listOnboarding` returns only the newest draft per stage; older drafts are labeled `superseded: true` and hidden from the header (available in "View raw" for debug).
- Add a server-fn `reconcileStuckRuns(countryCode)` that marks `onboarding_runs` older than 15 min in `planning`/`ready` with no `finished_at` as `stale`. Called automatically on page load. Never touches `committed` runs or the target tables.

**5. One-time cleanup for ATG**
The two stuck `planning` runs (`kpi_seed` 16:41, `sector_dossier` 16:41) will be reconciled to `stale` so their earlier `ready` drafts become the surfaced draft again — the commit button will actually work.

### Files touched
- `src/lib/country-onboarding/list.functions.ts` (or wherever `listOnboarding` lives) — add `committedTargets`, dedupe drafts, expose `reconcileStuckRuns`.
- `src/routes/_authenticated/admin/countries.$code.onboard.tsx` — swap `committed` derivation, add the four-state header, call `reconcileStuckRuns` on mount.
- No schema migration. No changes to committed data. No changes to the research pipeline.

### Out of scope
Changing what happens *during* commit, the research pipeline, or the domain-promotion logic. Purely a display-truth + draft-hygiene fix.
