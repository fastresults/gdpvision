## Problem

`sector_dossier_briefs` already caches the Gemini brief, but it is treated as a **24-hour TTL cache**, not a permanent artifact:

- `build.functions.ts` line 110: `ttlOk = Date.now() - cachedAt < 24h`. After 24h the cached row is ignored and the drawer re-runs the heavy Gemini call.
- The drawer's "Regenerate" button calls `refetch()` without `{ refresh: true }`, so it does not actually force a rebuild.
- No pre-warm — the first person to open a sector after onboarding always eats the full latency.

The row is stored, but from the user's perspective it may as well not be: a week or a quarter later they still wait.

## Goal

Once a McKinsey-grade dossier is generated, it opens **instantly, forever**, until (a) the user explicitly clicks Regenerate, or (b) the underlying second-brain data actually changes.

## Plan

### 1. Make the cache permanent (no TTL)

`src/lib/sector-dossier/build.functions.ts`
- Remove the 24h `ttlOk` check. If a row exists in `sector_dossier_briefs`, return it — regardless of age — unless `data.refresh === true`.
- Add a fingerprint check as the *only* staleness signal: compute a cheap hash of the inputs that would change the brief (counts + max `updated_at` of `country_kpis`, `country_capital_flows`, `sector_dossiers`, `ministry_profiles` for that country/sector, plus a `SCHEMA_VERSION` constant). Store it on the cache row.
- On read: return cached brief immediately. If fingerprint differs, also return `stale: true` so the UI can show a subtle "Refresh available" chip — but do **not** auto-regenerate.

### 2. Schema

Migration on `sector_dossier_briefs`:
- Add `input_fingerprint text` (nullable), `schema_version int not null default 1`.
- No data backfill needed — missing fingerprint just means "unknown, treat as fresh".

### 3. Drawer behavior

`src/components/sector/SectorDossierDrawer.tsx` and `getSectorContext`
- `getSectorContext` returns `cachedBrief`, `cachedAt`, and new `stale` flag.
- `briefQuery` runs **only** when `!hasCached` (first-ever open) OR user clicks Regenerate.
- Regenerate button calls `buildSectorDossier` with `{ refresh: true }` (fix current bug where refresh flag is not passed).
- When `stale === true`, show a small "Data updated · Refresh" pill next to the header instead of auto-refetching.

### 4. Pre-warm after onboarding (so the first open is also instant)

New server fn `prewarmSectorDossiers(countryCode)` in `src/lib/sector-dossier/prewarm.functions.ts`:
- Lists every sector in `country_sectors` for the country.
- For each missing/stale entry in `sector_dossier_briefs`, calls the same internal builder used by `buildSectorDossier` — sequentially, with a small delay, so we don't burst the model.
- Idempotent: skips sectors whose fingerprint already matches.

Wire it in:
- `src/lib/country-onboarding/corpus.functions.ts` — at the end of the `sector_dossier` commit stage, fire-and-forget `prewarmSectorDossiers` (non-blocking; failures logged, not fatal).
- Add a manual "Prewarm sector dossiers" action on the country onboard page so admins can trigger it for existing countries.

### 5. No other behavioral changes

- Ancillary DB reads in `loadAncillary` stay as-is (already fast).
- Citation hygiene, superscript rendering, and "no source, no citation" rules are unchanged.
- Global `PrettyJson` and existing UI contracts untouched.

## Result

- First open after onboarding: instant (pre-warmed in the background).
- Any subsequent open, today or next quarter: instant from `sector_dossier_briefs`.
- Regenerate is now the only path that re-runs Gemini, and it works correctly.
- When underlying KPIs/flows change, the user sees a discrete "Refresh available" chip — they choose when to spend the wait.
