## What's wrong today

Stage 00 asks the user to *type a programme name* on a blank line before anything else, then — only after the project exists — offers the brief intake (type / dictate / upload) inside `ProgramBriefIntake`. That inverts the product: this is an AI-first instrument, so the material should lead and the naming, framing and instrument choice should fall out of it.

## The new Stage 00: "Give the chamber the material"

The gate becomes two beats instead of "pick instrument → type a name":

```text
1  INTAKE      drop zone · record · paste link · type
   AI reads everything → proposes brief, title, track
2  CONFIRM     one screen: proposed name (editable), the AI's read of the
               decision, recommended instrument (Synthetic / Field,
               overridable), visibility → Open the chamber
```

The user may still skip ingest with a quiet "I'll start from a blank brief" link, which lands on today's naming behaviour.

### Beat 1 — Intake surface

A single full-width capture panel with four equal ways in:

- **Drop zone** — drag or browse; PDF, DOCX, PPTX, XLSX, images, audio. Multi-file, each chip shows parse state and an excerpt tick.
- **Record** — existing voice recorder + transcription, appended into the brief text.
- **Paste a link** — new. Paste an RFP page, a news article, a ministry PDF URL, a tender notice; it is fetched, extracted and attached as a source with title + excerpt.
- **Type / paste text** — the same textarea, now secondary rather than the only path.

Everything captured is held client-side until the project is created, then written straight into `brief_raw` / `brief_uploads` so nothing is re-entered.

### Beat 2 — AI read-out

One AI pass over the combined material returns:

- a proposed programme title (one Cabinet-recognisable line),
- the decision it must inform, audience, hypotheses, timeframe, sensitivities (the existing Research Scope shape),
- a recommended track with a one-line reason ("citable evidence with named households → Field Programme"),
- 3–5 open questions the material does not answer.

Shown as an editable card: title in the serif input, the read-out beneath, track as two selectable chips with the recommendation pre-selected, visibility chips as today. `Open the chamber` creates the project already carrying the brief and scope.

### Downstream

Because the brief arrives seeded and enriched, `ProgramBriefIntake` opens in *review-and-commit* state rather than an empty page — the admin edits and commits, and the blueprint stage follows unchanged. The gate hook, stepper and locking rules stay exactly as they are.

## Technical notes

- New `src/components/personas/ProgrammeIngest.tsx` — the capture panel; reuses `MultimodalInput`'s upload + transcribe plumbing (`signUploadUrl`, `parseUpload`, `transcribeAudio`) and adds the link row.
- New server fn `ingestBriefLink` in `src/lib/personas/parse-upload.functions.ts` — fetches a URL via the existing Firecrawl path used in `src/lib/country-onboarding/ingest.server.ts`, falls back to a plain fetch + text extraction, returns `{ url, title, excerpt }` stored in the same upload-chip shape.
- New server fn `proposeProgrammeFromMaterial` in `project-brief.functions.ts` — same gateway helper and model fallback already in that file, JSON-object response, returns `{ title, scope, recommendedTrack, trackReason, openQuestions }`.
- `TrackConfirm.tsx` becomes `ProgrammeSetup.tsx`: intake → proposal → confirm, calling `createProject` with `brief_raw`, `brief_uploads` and `brief_scope` seeded (extend `createProject`'s validator to accept them).
- `TrackGateEntry.tsx`: the two-panel instrument fork stays, but is reached *after* ingest as the recommendation/override step; the chamber entrance now opens on intake.
- Explain entries in `src/lib/explain/personas-entries.ts` for "how the instrument was recommended" and "what the AI read from your material".
- Illustration, `btn-*`, `card-choice`, `<PrettyJson>` and Explain contracts observed throughout; no new tables — `persona_projects.brief_*` columns already exist.
