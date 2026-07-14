## Problem

Stage 6 (source_registry) ran successfully and produced valid sources in the draft, but the **Commit** button is disabled.

## Root cause

The generic `canCommitDraft` gate in `StageCard` (countries.$code.onboard.tsx ~line 986) requires:

```ts
canCommitDraft = !!draft && (citations.length > 0 || hasFlowSourceUrls) && !capitalFlowsNeedsReview
```

That gate assumes every stage stores evidence in the top-level `draft.citations` array (Perplexity `search_results`). For **source_registry**, the sources themselves ARE the evidence — Perplexity's response is the registry, and `result.citations` can legitimately be empty even when 20+ valid sources land in `payload.sources`. Result: draft is good, backend would accept the commit, but the UI button stays disabled.

`hasFlowSourceUrls` is a special-case bypass added for `capital_flows`. Nothing analogous exists for `source_registry`.

## Fix

Add a source_registry-specific bypass alongside `hasFlowSourceUrls`:

1. In `StageCard` (src/routes/_authenticated/admin/countries.$code.onboard.tsx):
   - Compute `hasRegistrySources`:
     ```ts
     const hasRegistrySources =
       stage.key === "source_registry" &&
       Array.isArray(payload?.sources) &&
       payload.sources.some((s: any) => typeof s?.url === "string" && /^https?:\/\//.test(s.url));
     ```
   - Extend the gate:
     ```ts
     const canCommitDraft =
       !!draft &&
       (citations.length > 0 || hasFlowSourceUrls || hasRegistrySources) &&
       !capitalFlowsNeedsReview;
     ```

2. No backend change — `commitSourceRegistry` already validates URLs, upserts via `upsertCountrySource`, and refuses zero-insert commits.

## Files

- `src/routes/_authenticated/admin/countries.$code.onboard.tsx` — add `hasRegistrySources`, extend `canCommitDraft`.

## Verification

Re-open the BRB stage 6 draft: Commit button becomes enabled; clicking commits, refresh shows rows in `country_sources` and stage marked committed.
