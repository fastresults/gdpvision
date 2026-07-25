
## What's actually broken

I checked the network log and the recent dev-server log for the ATG session. After the page loaded and `listMandateCompacts` returned `[]`, **no `extractManifesto` request was ever sent** — so the failure is entirely client-side: the `drop` event never reaches `handleFile`. The server function, Gemini call, and DB writes are all fine; the browser simply isn't handing us the file.

Root cause (unverified until we instrument, but the code shape makes it near-certain): the drop zone is a `<label>` that wraps a `<input type="file">`. When a file is dropped onto a label that is the activator for a file input, Chromium's default behaviour is to route the drop to the nested input, which then does nothing because file inputs don't accept programmatic file drops. The React `onDrop` on the `<label>` never fires because the drop target resolves to the child input. Compounding this, `onDragEnter` isn't `preventDefault`ed — some Chromium versions refuse the drop for that alone.

## What we'll change

### 1. Fix the drop zone (Step 01 of Chamber 08)

- Replace the `<label>` container with a plain `<div>` and lift `<input type="file" ref>` out of the drop target. Trigger the picker with an explicit `inputRef.current?.click()` on div click / Enter / Space.
- Add `onDragEnter`, `onDragOver`, `onDrop` on the div, all calling `e.preventDefault()` + `e.stopPropagation()`. Use `dataTransfer.items` first, fall back to `dataTransfer.files`.
- Guard against directory drops and empty drops; surface a friendly toast.
- Add a one-line `console.debug("[mandate-compact] drop", ...)` so a follow-up run has visible evidence if anything still misbehaves.

### 2. Harden the extract server function against silent failures

- Wrap `pdf-parse` / `mammoth` dynamic imports so a Worker-runtime import error surfaces as a clear toast ("PDF parsing unavailable in this deployment — paste text or a URL instead") instead of a stack the UI swallows.
- Send back a structured `error` field on the client so the drop zone can render `phase="error"` with the real reason.

### 3. Multi-election index (many manifestos per country, each with its own plan)

Today the page shows one active compact via `selectedCompactId`, and a `CompactList` at the bottom. We'll promote this into a first-class Elections Index that matches how a country actually re-elects and re-drafts:

- **New "Elections" rail at the top of Chamber 08**, above the stepper: one row per `mandate_compacts` row for the country — election_cycle, PM, party, status pill (draft / signed / active / concluded), pledge count, deliverable coverage %, and a "Open plan" affordance. Sorted newest cycle first, current cycle marked.
- **"New compact" CTA** on that rail resets Step 01 to a blank drop zone and clears `selectedCompactId`. Ingest already keys on `(country_code, election_cycle)`, so a different cycle creates a new row; same cycle re-ingests the existing compact (with a visible "you're editing the 2025-2030 compact" banner so no one clobbers a live plan by accident).
- **Every downstream panel binds to the selected compact.** Decompose / Transform / Track / Ministries / Publish / History already accept `selectedCompact`; we just make sure switching a compact in the rail persists across steps and each compact keeps its own pillars, pledges, deliverables, scorecards, and revisions (they already do — foreign keys are per-compact_id).
- **Concluded cycles stay browsable read-only** so a new government can compare their compact against the outgoing PM's actuals.
- **Meta on each compact** (already stored, just surface): governing party badge, source URL, ingested-at, chunks indexed.

### 4. Small correctness follow-ups discovered while reading the file

- `IngestPanel` derives `canCreate` from `sourceUrl OR rawText`, but if extract fails silently the form is empty and Create is disabled with no explanation — the new error surface above covers this.
- Add a `data-testid="mandate-drop"` on the zone so we can drive Playwright verification in build mode.

## Verification plan (build-mode)

1. Load `/admin/countries/ATG/mandate-compact` in Playwright, drop a small PDF via `dispatchEvent('drop')` with a synthesized `DataTransfer`, assert that `extractManifesto` is POSTed and the form fills.
2. Ingest a second compact for a different `election_cycle` on the same country, confirm both appear in the Elections rail, confirm switching between them swaps the pillars/pledges in Decompose.
3. Read published worker logs after one real drop to confirm no `[unenv]` / pdf-parse import failure in the Worker runtime; if it fails there, keep the drop zone working and route PDF parsing to a text-only or URL path with a clear message.

## Technical notes

- Files touched: `src/routes/_authenticated/admin/countries.$code.mandate-compact.tsx` (drop zone rewrite + Elections rail), `src/lib/mandate-compact/extract.functions.ts` (error surface + import guards). No schema changes — `mandate_compacts` already supports multiple rows per country keyed by `election_cycle`.
- No changes to RLS, corpus writers, or downstream chambers.
- Global button and PrettyJson contracts respected.
