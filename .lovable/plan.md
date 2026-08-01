# Fieldwork: capture anywhere, land everywhere

Two halves of one loop. **Deploy** an instrument out of the chamber in whatever form the field actually uses, then **ingest** whatever comes back — file, transcript, spreadsheet, or paper — and have AI seat it against the right wave, the right participant, and the right question.

## Part A — Drop zones on every wave (as previously planned)

Each wave card in `FieldworkStage.tsx` gains an **Upload results** affordance alongside its existing "Next move":

- Hosted questionnaire wave → drop CSV/XLSX exports, PDF/scans of completed forms.
- Session waves (focus groups, depth interviews, panels) → drop audio/video, transcripts, moderator notes, DOCX/PDF.

Files land in the existing corpus storage path, are parsed via `parse-upload.functions.ts` / `transcribe.functions.ts`, then handed to an AI mapping pass.

## Part B — Instruments become deployable artefacts

Stage 03 instruments are currently only renderable inside the hosted participant page (`/f/$token`). Add a **Deploy** panel to `InstrumentsStage.tsx` and to each wave, offering four channels:

1. **Hosted link** — what exists today: tokenised per-participant invitations.
2. **Open link** — one anonymous URL with an optional response cap and close date, for when the ministry distributes it themselves (WhatsApp, email blast, kiosk).
3. **Printable form** — a paper questionnaire / moderator guide PDF, each question stamped with its stable question id and a form serial, so scanned returns are machine-mappable.
4. **Export for external tooling** — CSV/XLSX column template (one column per question id, with the value legend), plus a JSON schema for teams running Qualtrics/SurveyMonkey/KoBo/Google Forms.

The exported column template is the contract. Anything that comes back shaped like it maps with zero AI guessing; anything else falls to the mapper below.

## Part C — The ingestion mapper (the part that makes this work)

A single server pipeline, `field-ingest.server.ts`, with a strict order of attempts:

```text
file → parse → classify → map → stage → review → commit
```

- **Classify**: tabular (many respondents, one row each) vs. narrative (one session, many speakers).
- **Map, tabular**: match each column to a question id — exact id, then header text similarity, then AI adjudication against the instrument's prompts. Values are coerced to each question's type (choice options, scale bounds, matrix rows); unmatched columns are kept, never dropped.
- **Map, narrative**: AI reads the transcript against the discussion guide and answers each `moderator_prompt` / `open_text` question with the participant's own words plus a verbatim quote and a timestamp/线 offset. One `field_response` per identified speaker where speakers can be resolved, else one per session.
- **Identity**: resolve respondents to `research_contacts` by email/phone/participant code; unknown respondents get an anonymous participant code rather than being rejected.
- **Confidence**: every mapped cell carries a confidence and a provenance note.

## Part D — Review before anything counts

Nothing writes to `field_responses` until a human says so. A **Staging review** sheet shows:

- A mapping table: source column/prompt → instrument question, with confidence, editable by dropdown.
- A preview grid of the first rows / the extracted session answers.
- Duplicate detection against existing responses (same participant + same collection).
- Counts: N accepted, N flagged, N unmapped.
- One **Commit to wave** action, which inserts responses, marks matching invitations completed, and re-runs wave progress.

This is the discipline a real fieldwork operation needs: an import you can't audit is data you can't defend in a cabinet room.

## Part E — Progress, provenance, closure

- `field_responses.source` widens beyond `hosted`: `open_link`, `upload_csv`, `upload_transcript`, `paper`, `external`.
- Wave progress counts uploaded responses identically to hosted ones, so a wave can be satisfied entirely offline.
- Every ingested artefact is written to the second brain (`field-corpus.server.ts`) as a source document with `visibility: private`, deduped on file hash, so synthesis in Stage 05 cites the real instrument return.
- An `<Explain>` rationale (`research.fieldwork.ingest`) states how a given response arrived and how confident the mapping was.

## Recommendation from practice

Three things field operations get wrong, and how this handles them:

- **The instrument drifts.** Once a questionnaire leaves the system, someone edits it. So the export stamps an instrument **version**, and ingest warns loudly when returns reference a version other than the live one instead of silently merging them.
- **Partials are data.** Never discard a half-finished return; store it with its completion rate and let synthesis weight it.
- **Quotas beat totals.** Waves should track achieved-vs-target *by audience segment*, not just a headline N, or you finish fielding with 300 responses and no one from the group that mattered.

## Technical notes

- New: `src/lib/personas/field-ingest.server.ts`, `field-ingest.functions.ts`, `instrument-deploy.server.ts` (PDF/CSV/JSON generation), UI `fieldwork/UploadDropzone.tsx`, `fieldwork/IngestReviewSheet.tsx`, `field/DeployPanel.tsx`.
- Migration: `field_ingest_batches` (file ref, wave/collection, kind, status, mapping jsonb, counts) plus GRANTs/RLS scoped by `has_country_access`; widen `field_responses.source`; add `instrument_version` and `completion_rate` to `field_responses`; add `open_token`/`response_cap` support on `field_collections` for anonymous links.
- Public route `src/routes/api/public/field.open.$token.ts` for open-link responses, rate-limited by cap and close date, mirroring the existing token endpoint's shape.
- AI passes reuse `deriveJson` in `field-ai.server.ts`; transcription reuses `transcribe.functions.ts`.
