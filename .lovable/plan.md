## Problem

Payload strings in Sector Dossiers contain Perplexity-style citation markers like `[48]`, `[52,53]`. `PrettyJson` already extracts them into subtle `<sup>` refs — but the numbers are **dead**: the committed dossier row has `source_ids: []`, and the ordered Perplexity `citations` array (url, title, domain, quote) is stored per-draft in `onboarding_citations` and never linked to the dossier. So the reader has no way to see what `[48]` actually points to.

## Goal

Every citation ref shown in a `<PrettyJson>` payload becomes clickable and opens a modal listing the referenced sources (URL, title, domain, quote when available). Establish a global rule so any surface rendering payloads with citation markers wires up the resolver.

## Fix path

### 1. Persist the citation set with the dossier
- At `commitSectorDossiers` time (`src/lib/country-onboarding/corpus.functions.ts`), read `onboarding_citations` for the draft **in insert order** and snapshot them onto the row.
- Store the ordered snapshot as `sector_dossiers.citations` (new `jsonb` column, array of `{ url, title, domain, quote, published_at }`). Ordering matches the `[N]` numbering emitted by Perplexity (1-indexed).
- Keep `source_ids` as-is for future linkage to `country_sources`; the snapshot is the source of truth for the marker resolver.
- Backfill: for existing dossiers where `citations IS NULL`, one-shot migration copies from the latest `sector_dossier`-stage draft's citations for that country (best-effort; per-sector match not guaranteed for the current pre-fan-out draft).

### 2. Server: expose citations on the read
- `getSectorDossiers` (`src/lib/country-data/manage.functions.ts`) returns `citations` alongside `payload`, `source_ids`, `confidence`.
- Types regen picks up the new column.

### 3. Component: interactive citation refs

**`src/components/data/humanize.ts`**
- `splitCitations` already returns `{ text, refs: number[] }`. Extend to also parse combined markers like `[48,52]` and consecutive `[48][52]` (already handled) into a flat `refs` list — no change to callers.

**`src/components/data/PrettyJson.tsx`**
- Add optional prop `citations?: Array<{ url, title?, domain?, quote?, published_at? }>` (1-indexed).
- Add optional prop `onCitationClick?: (refs: number[]) => void` for consumers wiring their own dialog. Default behaviour: if `citations` is provided, `PrettyJson` owns a `<Dialog>` and clicking a `<sup>` opens it with the resolved rows.
- The `<sup>` becomes a `<button>` (unstyled, subtle hover: text-ink-700, underline dotted) that fires the resolver. Refs beyond the list render disabled/muted.
- Dialog content: serif heading "Sources [48,52]", each ref as a card with domain badge, title (linked to URL, new tab), quote in blockquote, published date. Unknown refs show "Source unavailable".

### 4. Wire consumers
- **Sector Dossiers tab** (`countries.$code.data.tsx` `DossiersTab`): pass `citations={r.citations}` to `<PrettyJson>`.
- **Onboarding drafts** (`countries.$code.onboard.tsx`): any preview of a draft payload with an accompanying `citations` array must pass it to `<PrettyJson>`.
- Audit remaining `<PrettyJson>` call sites (currently only DossiersTab); document the rule.

### 5. Global rule
Update `mem://index.md` Core:
> When rendering `<PrettyJson>` for a payload that carries citation markers (`[N]`), always pass the associated ordered `citations` array so refs become clickable and open the source modal. Never render citation markers without a resolver — dead numbers are not acceptable.
> 
> New citation column: `sector_dossiers.citations` (jsonb ordered array snapshotted at commit time). Preserve ordering — it is the `[N]` index.

## Technical details

**Migration**
```sql
ALTER TABLE public.sector_dossiers
  ADD COLUMN IF NOT EXISTS citations jsonb NOT NULL DEFAULT '[]'::jsonb;
```
Backfill pass: for each dossier row missing citations, look up the most recent `onboarding_drafts` row with `stage='sector_dossier'`, `country_code` matches, and copy the ordered `onboarding_citations` for that draft.

**Files**
- Edit: `src/lib/country-onboarding/corpus.functions.ts` (snapshot citations on commit)
- Edit: `src/lib/country-data/manage.functions.ts` (`getSectorDossiers` selects `citations`)
- Edit: `src/components/data/PrettyJson.tsx` (new props, Dialog, clickable sup)
- Edit: `src/components/data/humanize.ts` (parse `[48,52]` combined markers)
- Edit: `src/routes/_authenticated/admin/countries.$code.data.tsx` (`DossiersTab` passes `citations`)
- Edit: `src/routes/_authenticated/admin/countries.$code.onboard.tsx` (pass draft citations to PrettyJson previews)
- Migration: `sector_dossiers.citations` column + backfill
- Memory: `mem://index.md` Core rule

## Out of scope
- No re-run of Perplexity or dossier regeneration.
- No changes to `country_sources` linkage — separate concern.
- No changes to the KPI or Corpus tabs' rendering.
