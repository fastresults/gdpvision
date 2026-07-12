## Goal
Enrich the Ministries workflow so each ministry profile carries the current Minister's identity, party affiliation, contact information, and short bio — sourced by the AI research pass and editable by admins, with citations wired through the standard `PrettyJson` source modal.

## Data model

Add a single structured `minister_profile` JSONB column to `ministry_profiles` instead of many scalar columns — the shape stays flexible (missing contact fields are fine) and matches how the AI returns it.

```sql
ALTER TABLE public.ministry_profiles
  ADD COLUMN IF NOT EXISTS minister_profile jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS citations jsonb NOT NULL DEFAULT '[]'::jsonb;
```

Shape (all fields optional except `name`):
```json
{
  "name": "Hon. Philip J. Pierre",
  "title": "Prime Minister & Minister of Finance",
  "party": "Saint Lucia Labour Party (SLP)",
  "appointed_at": "2021-07-28",
  "bio": "Attorney and long-serving parliamentarian for Castries East …",
  "birth_date": "1954-11-06",
  "education": ["LLB, University of the West Indies"],
  "career": ["MP Castries East since 1997", "Deputy PM 2011-2016"],
  "contact": {
    "office_phone": "+1-758-468-2101",
    "email": "pm.office@govt.lc",
    "office_address": "Sir Stanislaus James Building, Castries",
    "website": "https://www.govt.lc/ministries/finance"
  },
  "socials": {
    "twitter": "https://twitter.com/…",
    "facebook": "…",
    "linkedin": "…"
  },
  "portrait_url": "https://…"
}
```

`minister` scalar column stays for now (already used by other queries); commit path mirrors `minister_profile.name` into it.

Backfill: existing rows get `minister_profile = jsonb_build_object('name', minister)` where minister IS NOT NULL, `citations = '[]'`.

## Research agent (`corpus.functions.ts` → `runMinistryDeepDiveAgent`)

- Extend the `MinistryDeepDiveSchema` per-ministry item with `minister_profile` matching the shape above (name required inside the object; every other field nullable/optional).
- Update the system prompt to demand: current officeholder name, formal title, party affiliation, appointment date, short bio (≤400 chars), contact block (office phone, official email, address, ministry website), verified official social handles, and portrait URL when publicly available. Instruct the model to leave a field null rather than guess, and to prefer official government/ministry pages.
- Keep the existing `programmes`/`mandate` fields — no regression.
- Model stays `sonar-pro`, `recency: "year"`. Citations already flow through.

## Commit path (`commitMinistryDeepDive`)

- Snapshot ordered draft citations onto `ministry_profiles.citations` (same pattern as `sector_dossiers`).
- Persist `minister_profile` JSON as-is.
- Mirror `minister_profile.name` into the legacy `minister` scalar for backward compatibility.

## Admin UI

**`MinistriesTab` in `countries.$code.data.tsx`** — restructure each card:
- Header: ministry name (serif) + right-side meta (programmes / sources counts).
- **New Minister block** (only when `minister_profile.name` present):
  - Portrait thumb (32×40 rounded, fallback initials tile) beside a two-line stack of name (medium) and title.
  - Small metadata row: party badge (subtle border), appointed date (`tabular-nums`).
  - Contact row: phone / email / website as compact icon-less links; `mailto:` and `tel:`, external links open in new tab.
  - Bio paragraph (`text-sm text-ink-700`), truncated with `line-clamp-3` and an inline "Read more" that expands in place.
  - Career/education arrays render as small bulleted lists inside a collapsible "Background" `<details>`.
  - Socials appear as small text links when present.
- Mandate + programmes render as before, below the Minister block.
- "Edit Minister" button (top-right of the block) opens a dialog with the same fields as text inputs / textareas — admin can correct or fill missing info manually. Save calls a new `updateMinisterProfile` server function.

**New server function `updateMinisterProfile`** in `src/lib/country-data/manage.functions.ts`:
- `requireSupabaseAuth` + `assertAdmin`
- Zod validates the profile shape
- Updates `ministry_profiles.minister_profile` + mirrors `.name` into `minister`
- Writes a `data_revisions` entry (same pattern used elsewhere for auditability) if that table is available.

**Citations**: pass `citations={r.citations}` into any `<PrettyJson>` used in the Ministries tab; contact URLs render with the existing citation superscript wiring in `RichText` when the AI returns them with `[N]` markers.

## Auditing

- No changes to `sector_dossiers`, KPIs, sources, corpus tabs.
- No new tables — reuse `ministry_profiles` + audit table if present.
- No re-run of Perplexity for existing rows required; admins can trigger the Ministry Deep-Dive stage from the onboarding page as they do today, and the enriched shape lands automatically.

## Files
- Migration: add `minister_profile`, `citations` columns; backfill.
- Edit: `src/lib/country-onboarding/corpus.functions.ts` (schema, prompt, commit snapshot).
- Edit: `src/lib/country-data/manage.functions.ts` (new `updateMinisterProfile` fn).
- Edit: `src/routes/_authenticated/admin/countries.$code.data.tsx` (`MinistriesTab` redesign + edit dialog).
- Memory: add rule to `mem://index.md` Core — `ministry_profiles.minister_profile` is the canonical shape for minister identity/contact/bio; UI must render it before mandate/programmes; `citations` snapshot follows the dossier pattern.

## Out of scope
- No org-chart of deputy ministers or permanent secretaries — this is the political-leadership layer only. A follow-up can add a `leadership_team` array later.
- No portrait upload/storage — we store the AI-supplied URL; a manual upload flow can come later.
- No public-facing surface — admin-only until the shape stabilises.
