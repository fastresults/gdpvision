# Resolve the Sovereign Eye `filter` crash

## Diagnosis

The preview trace identifies the failure at `kpiTrend` in the map. That function assumes every KPI has a `points` array and immediately calls `kpi.points.filter(...)`.

Current workspace responses now include `points`, but an older React Query cache or a previously saved public-scene snapshot can still contain the earlier KPI shape without that field. TypeScript does not protect against these already-persisted runtime records, so the map crashes instead of showing the intended “Trend unavailable” state.

## Recommended approach

1. **Normalize KPI records at each data boundary**
   - Convert missing or malformed `points` values to an empty array when workspace data enters the page.
   - Apply the same normalization when reading public-scene snapshots, including scenes saved before KPI history was introduced.

2. **Make trend calculation fail-safe**
   - Update the trend helper to treat a missing/non-array `points` field as no history.
   - Return the existing honest message: “Trend unavailable. This view has only one comparable observation.”
   - Ignore malformed point entries rather than allowing one record to blank the map.

3. **Invalidate the incompatible live cache**
   - Version the Sovereign Eye workspace query key so an in-memory payload created before the data-shape change is not reused after hot reload.
   - Keep the defensive normalization because saved scenes can outlive any browser cache.

4. **Regression checks**
   - Verify current workspace KPIs with history still produce comparisons.
   - Verify legacy KPIs without `points`, malformed points, and old public snapshots render without crashing and state that trend is unavailable.
   - Recheck the authenticated Sovereign Eye page, legend interaction, public shared scene, generated maps, and build output.

## Scope

This is a compatibility and resilience fix only. It will not invent trends, migrate stored scenes, or alter economic calculations.
