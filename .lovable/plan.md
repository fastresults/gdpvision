## Goal

Enforce the existing project rule — "JSON in UI must be rendered human-readable via `<PrettyJson>`, never raw `JSON.stringify`" — globally and consistently. Fix the current Stage 12 committed view (screenshot: raw JSON under "View raw committed data") and every other UI offender, then harden the rule so it can't silently regress.

## What the screenshot shows

On `/admin/countries/ATG/onboard`, Stage 12 after commit shows only the "View raw committed data" `<details>` — raw `JSON.stringify` output — with no human-readable rendering above it. That violates the rule in spirit even though the raw block sits inside a `<details>` (the rule allows raw only as a debug toggle *alongside* a PrettyJson view, not as the sole rendering).

## Audit — where UI still renders raw JSON

Confirmed offenders (grepped `JSON.stringify` in `src/`, excluded server/.server/.functions/serialization/hashing/fetch-body use):

1. `src/routes/_authenticated/admin/countries.$code.onboard.tsx`
   - Line 1048 — committed stage shows a raw `<pre>{JSON.stringify(...)}</pre>` as the *only* rendering of committed payload. Must render `<PrettyJson value={...} citations={citations} />` as the primary view; keep the raw `<details>` toggle collapsed by default for admin debugging.
   - Line 1015 — raw JSON textarea inside "Edit raw JSON to override before commit". Allowed (it's an editor, not a display), but wrap in a clearly-labeled `<details>` and add a note that the human-readable view above is the source of truth.

2. `src/routes/_authenticated/admin/audits.log.tsx` line 60 — metadata cell renders `JSON.stringify(r.metadata)` inline in the table. Replace with a compact `<PrettyJson value={r.metadata} compact />` (or a small "View" popover using PrettyJson) so operators can read it.

3. `src/components/viz/EvidenceRail.tsx` line 84 — `JSON.stringify(payload).slice(0, 200)` used as a *fallback preview string* when no human label exists. Replace with a short human summary (first key/value pair or `"(payload)"`), never raw JSON in the visible rail.

4. `src/routes/_authenticated/admin/index.tsx` line 220 — `JSON.stringify(row.value_json, null, 2)` seeds a textarea editor. Allowed (editor input), but add a `<PrettyJson>` preview panel next to the textarea so the admin sees the human-readable version live.

Acceptable and left alone (not UI rendering):
- All `*.server.ts`, `*.functions.ts`, `*.functions.tsx` — `JSON.stringify` for `fetch` bodies, hashing, LLM prompts.
- `PrettyJson.tsx` internal fallback for unknown leaf types (line 343).
- `kiosk.admin.tsx` line 1319 — QR payload string encoding, not display.
- `country-data/*` diff comparisons and `counsel.functions.ts` hashing.

## Fixes

### 1. Stage 12 committed view (fixes the screenshot directly)

In `countries.$code.onboard.tsx` replace the committed-only raw `<pre>` block with:

- Primary: `<PrettyJson value={payload ?? draft?.payload ?? summary?.highlights ?? {}} citations={citations} />` always visible when committed.
- Secondary: keep the existing `<details>` "View raw committed data" (closed by default) for admin debugging only.

Do the same treatment for the draft edit block (line 1011-1018): PrettyJson above (already present at 1010) + raw editor inside `<details>` (already present) — verify the textarea `<details>` starts collapsed.

### 2. Audit log metadata

Swap the inline `JSON.stringify` at `audits.log.tsx:60` for `<PrettyJson value={r.metadata} />` inside the table cell (with a `max-w` / `truncate` wrapper so wide payloads don't blow up the row). If PrettyJson is too tall inline, render a "View" trigger that opens a popover/modal containing PrettyJson.

### 3. EvidenceRail fallback preview

Replace the raw JSON slice with a friendlier fallback (e.g. first meaningful string field, or `"(structured payload)"`).

### 4. Admin `index.tsx` value_json editor

Keep the textarea for editing but add a live `<PrettyJson value={parsedFromText} />` preview beside/under it so the human-readable view is always present.

## Prevent regression (global rule enforcement)

1. Add ESLint rule (custom, `no-restricted-syntax`) that flags `JSON.stringify` calls inside JSX children or `<pre>`/`<code>` bodies in files under `src/routes/**` and `src/components/**` (excluding `PrettyJson.tsx` and files matching `*.server.*`, `*.functions.*`). Message: "Render JSON via <PrettyJson> from @/components/data/PrettyJson. Raw JSON.stringify is only allowed inside a <details> debug toggle."
2. Update the project memory Core rule (`mem://index.md`) to explicitly state: *"Every JSON-shaped value shown to a user MUST render via `<PrettyJson>`. Raw `JSON.stringify` is permitted only (a) as the value of a textarea used for editing, or (b) inside a collapsed `<details>` block whose sibling is a `<PrettyJson>` view."* No other exceptions.
3. Add a lightweight README note at the top of `src/components/data/PrettyJson.tsx` documenting the same rule so future contributors see it in-place.

## Verification

- Reload `/admin/countries/ATG/onboard`, expand Stage 12 → confirm the human-readable PrettyJson view (with clickable `[1]` citation) is the primary rendering, and "View raw committed data" is collapsed.
- Visit `/admin/audits/log` → metadata column reads as key: value, no `{"foo":"bar"}` blobs.
- `bun run lint` (or `bunx eslint src`) passes; intentionally add a temporary `JSON.stringify(obj)` in a JSX child and confirm the new rule flags it, then revert.
- `tsgo` clean; production build succeeds.

## Files touched

- `src/routes/_authenticated/admin/countries.$code.onboard.tsx`
- `src/routes/_authenticated/admin/audits.log.tsx`
- `src/routes/_authenticated/admin/index.tsx`
- `src/components/viz/EvidenceRail.tsx`
- `src/components/data/PrettyJson.tsx` (doc comment only)
- `eslint.config.*` (add restricted-syntax rule)
- `mem://index.md` (tighten Core rule wording)
