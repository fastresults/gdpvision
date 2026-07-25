
# Step 01 · AI-first Manifesto Drop Zone

Today Step 01 is a form. It should be a **drop zone**: the admin drops a manifesto (PDF, DOCX, TXT, or URL), and AI reads it and pre-fills election cycle, title, PM name, summary, source URL, and full text. The admin only reviews and signs off.

## What changes for the user

```text
┌─────────────────────────────────────────────────┐
│  ⬆  Drop the manifesto here                     │
│     PDF · DOCX · TXT  ·  or paste a URL / text  │
│     AI will read it and fill in the rest        │
└─────────────────────────────────────────────────┘
```

After drop:
1. **Extracting** — file parsed to text (PDF/DOCX/TXT) or URL fetched via Firecrawl.
2. **Reading** — Gemini reads the full text and returns structured fields.
3. **Auto-filled preview** — every field below the drop zone populates with a small "AI · edit" affordance. Admin can override any value inline.
4. **One button** — `Create Compact` (already active, no manual typing required).

Visibility (public/private) is the only field the admin still chooses explicitly, defaulting to Public.

## Fields AI extracts

- `election_cycle` (e.g. "2025-2030") — inferred from cover page / dates
- `title` — manifesto title
- `pm_name` — party leader / PM candidate
- `governing_party` name (matched against `country_parties`, else surfaced as unmatched)
- `summary` — 2-3 sentence exec summary
- `pillars_preview` — top 5-8 pillar names (used later in Decompose, shown as a read-only chip row so the admin sees AI already understood the document)
- `source_url` — carried through if URL was the input
- `full_text` — stored and chunk-embedded exactly as today

## Technical section

**New server fn: `src/lib/mandate-compact/extract.functions.ts`**
- `extractManifesto({ countryCode, fileBase64?, mimeType?, filename?, sourceUrl?, pastedText? })`
- Auth: `requireSupabaseAuth` + `has_country_access`.
- Text acquisition waterfall:
  - `fileBase64` PDF → `document--parse_document`-style extraction using existing `@/lib/ingest/pdf.server` if present, otherwise send the PDF as an `input_file` content block to Gemini 3.6 Flash multimodal.
  - DOCX/TXT → decode inline (mammoth for docx, utf-8 for txt).
  - `sourceUrl` → reuse existing Firecrawl helper (already used by `party-research.server.ts`).
  - `pastedText` → passthrough.
- Structured extraction: `generateText` with `Output.object` (Zod schema for the fields above, no `.min/.max`, prompt states the caps and we clamp in code). Model: `google/gemini-3.6-flash` via `ai-gateway.server`.
- Returns `{ extracted: {...}, rawText, charCount, sourceUrl, matchedPartyId }`.

**Ingest fn stays unchanged** (`ingestManifesto`). The drop zone calls `extractManifesto` first, then the existing `ingestManifesto` with the extracted values — no schema/migration changes.

**Route file: `src/routes/_authenticated/admin/countries.$code.mandate-compact.tsx`**
Rewrite `IngestPanel` (~lines 197-361):

1. **DropZone component** (new) — HTML5 drag/drop + file picker + URL input tab.
   - Accepts `.pdf, .docx, .txt`, max 20 MB.
   - On drop → base64-encode client-side → call `extractManifesto`.
   - States: `idle → extracting → reading → ready → error`, each with editorial mono status line under the zone (matches the current aesthetic).
2. **Auto-fill state**: single `extracted` object drives all form fields. Fields render as underline inputs (unchanged style) but pre-populated, each with a subtle "AI" mono tag that fades on user edit.
3. **Pillars preview** (read-only chip row) sits between summary and full-text, labelled `AI READ · 7 PILLARS DETECTED · will be committed in Step 02`.
4. **Create button** enabled the moment extraction finishes; no manual entry required for the happy path.
5. **Fallback**: if extraction fails, drop zone shows the error and reveals the current manual fields (progressive disclosure), so nothing is lost.

**Dependencies to add**: `mammoth` (~150 kB) for DOCX text extraction. PDF parsing reuses whatever the corpus pipeline already uses; if none exists, send the PDF directly to Gemini as `input_file` (multimodal) and skip a local PDF parser entirely.

**Files touched**
- `src/lib/mandate-compact/extract.functions.ts` — new server fn.
- `src/routes/_authenticated/admin/countries.$code.mandate-compact.tsx` — replace `IngestPanel` + supporting `DropZone` sub-component; delete `UnderlineField`-only fallback path from happy flow (keep for manual override).
- `package.json` — add `mammoth`.

No DB migrations, no changes to `ingestManifesto`, no changes to Steps 02-07.

## Out of scope
- Batch ingest of multiple manifestos.
- OCR of scanned/image-only PDFs (Gemini multimodal handles most cases; scanned edge case flagged as future work).
- Auto-triggering Step 02 Decompose after ingest (still a deliberate admin action, but the pillars preview shows AI is ready).
