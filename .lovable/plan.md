# Fieldwork · Offline intake (AI drop zones)

Today Stage 04 assumes fieldwork happens inside the system: a hosted questionnaire wave collects `field_responses` via tokens, and session waves expect a transcript typed or pasted into `attachSessionTranscript`. There is no path for "we ran this survey on paper / in WhatsApp / in a room" — the only import route (`importResponses`) takes pre-structured rows and is not surfaced in the wave UI.

This adds an AI-first **Offline intake** beat to every wave: drop documents, audio, photos or paste a link, and the AI reads them against that wave's instrument and turns them into structured responses or a session record.

## What the admin sees

Each wave card in the Fieldwork Desk gains a second action next to its "Next move": **Intake results**. It opens a wave-scoped intake panel with:

- A drop zone (files, multi-file), a "record / upload audio" option, and a paste-link field — same intake vocabulary as Chamber 07's programme ingest.
- A live **Reading** state showing per-file extraction status.
- A **Proposed mapping** review before anything is written:
  - Collection waves: a table of detected respondents × instrument questions, with confidence per cell, unmatched answers flagged, and per-row accept / edit / discard.
  - Session waves: a proposed session (title, method, date, detected participants, transcript, key moments), matched against already-scheduled sessions so an uploaded recording attaches to the right one instead of creating a duplicate.
- Accept writes through the existing paths, then offers **Ingest to second brain** (already wired via `ingestCollection` / `ingestSessionToCorpus`).
- An **Explain this** rationale on the mapping ("how we matched this document to your instrument").

Wave progress counts offline-intaken results the same as hosted ones, so a wave run entirely offline can be closed normally.

## Backend

New `src/lib/personas/offline-intake.server.ts`:
- `extractArtifacts()` — reuses `parseUpload` extraction (text/markdown/JSON direct, images via vision OCR, PDF/DOCX via the existing parser) plus `transcribe.functions.ts` for audio.
- `mapToInstrument()` — AI pass grounded in the wave's instrument questions (from `instrument-draft.server.ts` / stage 03 output) and the approved plan. Returns per-respondent answer sets keyed by `question_id`, with `confidence`, `verbatim`, and `unmatched[]`. Strict Zod schema, tolerant of reasoning-model `<think>` wrappers (same hardening as the recruiter agent).
- `mapToSession()` — AI pass producing transcript (cleaned, speaker-labelled where possible), detected attendees matched against `field_session_attendees` / accepted participants, method, date, and key moments.

New `src/lib/personas/offline-intake.functions.ts` (`requireSupabaseAuth`):
- `proposeOfflineIntake` — takes `{ waveId/studyId, kind, artifacts[] }`, runs extract + map, persists a draft proposal, returns it for review. No writes to responses/sessions.
- `commitOfflineIntake` — accepts the reviewed rows; for collection waves inserts into `field_responses` against an `offline` collection for that wave with `source: 'offline_intake'`; for session waves upserts `field_sessions` and calls the existing `attachSessionTranscript` path.
- `discardOfflineIntake`.

Migration: `research_offline_intakes` (id, study_id, country_code, wave_key, kind, artifacts jsonb, proposal jsonb, status, created_by, timestamps) — with GRANTs, RLS scoped by `has_country_access`, plus a `wave_key` column on `field_collections` so offline collections bind to a wave. Uploads reuse the existing private `study-artifacts` bucket via `signUploadUrl`.

## UI files

- `src/components/personas/field/fieldwork/OfflineIntakePanel.tsx` — drop zone, extraction status, proposal review, commit.
- `src/components/personas/field/fieldwork/ResponseMappingTable.tsx` and `SessionProposalCard.tsx` — the two review shapes.
- `CollectionWave.tsx` / `SessionWave.tsx` — add the "Intake results" action and offline counts.
- `src/lib/personas/field-progress.server.ts` — wave completion counts offline results.
- `src/lib/explain/personas-entries.ts` — rationale `research.fieldwork.offline-intake`.

All buttons use the `btn-*` contract; any JSON shown renders through `<PrettyJson>`; long AI passes run per-artifact so a large drop never trips a single request timeout.
