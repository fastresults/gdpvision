## Goal
Replace raw `JSON.stringify` blocks in Sector Dossiers with a beautifully formatted, human-readable presentation. Establish a global rule + reusable renderer so any JSON payload we surface in admin UIs renders as readable copy — never as raw JSON.

## Global rule
Add to `mem://index.md` Core:
> JSON payloads shown to users must be rendered via `<PrettyJson>` (semantic, human-readable). Never render `JSON.stringify(...)` in UI. Raw JSON is only allowed inside a "View raw" toggle for debugging.

## New component: `src/components/data/PrettyJson.tsx`
Generic, schema-agnostic renderer that turns any JSON value into editorial copy:
- **Object** → definition-style block: keys become small-caps labels (`humanizeKey("national_plans") → "National Plans"`), values render recursively; single-scalar objects render inline.
- **Array of strings** → bulleted list.
- **Array of objects** → stacked cards (one per item), each rendered as an object block; if items share a `title`/`name`/`label` key, that becomes the card heading.
- **Array of primitives (mixed)** → comma-separated inline chips.
- **String** → paragraph; auto-linkify URLs; strip trailing citation markers like `[4]`, `[7][10]` into subtle superscript refs.
- **Number / boolean / null** → typography tuned (`—` for null, monospace tabular for numbers with 2-decimal rule for floats).
- **Empty values** → hidden, not shown as `[]` or `{}`.
- Depth-limited indentation using existing `border-line-200` rails; no code font except for URLs/IDs.
- Optional `<details>` "View raw JSON" footer for admins.

Utility: `humanizeKey` (snake/camel → Title Case, with overrides map for domain terms: `oecs → OECS`, `kpi → KPI`, `gdp → GDP`).

## Sector Dossiers rewrite (`countries.$code.data.tsx` `DossiersTab`)
Replace the `<pre>{JSON.stringify(r.payload, null, 2)}</pre>` block with:
- Card header: dossier `kind` as serif title (e.g. "Communications", "OECS Peer Position", "Policy Landscape") via a `DOSSIER_KIND_LABELS` map, plus confidence pill and source count.
- Body: `<PrettyJson value={r.payload} />` — which for the known shapes produces:
  - **comms**: sections "Channels", "Narratives", "Spokespeople", "Reputation risks" as bulleted lists.
  - **oecs**: "Position" as a bold label ("Laggard / Leader / Middle"), "Peers" as chips, "Rationale" as prose.
  - **policy**: "National plans", "Statutes", "Regulatory instruments", "Institutions" as lists/cards.
- Sector heading uses country's sector display name (from `country_sectors` join) instead of raw code.
- Keep a small "View raw" `<details>` for admin debugging.

## Audit & propagate the rule
Sweep the four other files that render JSON as text and swap to `<PrettyJson>` where the payload is user-facing:
- `src/routes/_authenticated/admin/countries.$code.onboard.tsx` — draft/citation payloads.
- `src/routes/_authenticated/admin/audits.log.tsx` — diff payloads (keep raw toggle since it's audit).
- `src/routes/_authenticated/admin/index.tsx` — any inline payload previews.
- `src/routes/kiosk.admin.tsx` — same treatment.

For each, if the JSON is genuinely a debugging artifact (audit diffs, error traces), wrap the existing `<pre>` inside `<details><summary>View raw</summary>…</details>` and show a `<PrettyJson>` summary above it.

## Files
- **Create**: `src/components/data/PrettyJson.tsx`, `src/components/data/humanize.ts`
- **Edit**: `src/routes/_authenticated/admin/countries.$code.data.tsx` (DossiersTab), plus the four files above for consistency
- **Memory**: `mem://index.md` (add Core rule), `mem://design/pretty-json` (component contract)

## Out of scope
No schema changes, no dossier regeneration, no changes to how the AI produces payloads — presentation layer only.
