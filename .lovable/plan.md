# Chamber 07 · One brief, many contexts

Today the intake treats every dropped file identically — one undifferentiated pile fed to the AI. The chamber must instead recognise two distinct roles, and file both into the second brain.

- **The source brief** — exactly one. The RFP, the cabinet memo, the tender notice, the dictated ask. It *governs* the programme: name, objectives, decisions, deadline, instrument.
- **Supporting context** — zero or many. Prior studies, statistics annexes, manifesto extracts, articles, links. They *inform* the programme; they never redefine it.

## 1. Intake surface (Beat 1)

Rebuild `ProgrammeIngest` as two stacked, clearly unequal zones.

```text
┌ THE SOURCE BRIEF ── required, one only ─────────────┐
│  Drop the document that defines this programme      │
│  ...or dictate it   ...or paste its link            │
│  [ once set: filename · "read · 4,200 words" · Replace ]
└─────────────────────────────────────────────────────┘

┌ SUPPORTING CONTEXT ── optional, as many as you like ┐
│  + files   + links     (list with per-item remove)   │
└─────────────────────────────────────────────────────┘
   Anything the documents don't say  [textarea]
   [ Read this and build the programme ]
```

Rules enforced in the UI:
- The brief slot holds one item. Dropping a second offers **Replace the brief** or **Add as context** rather than silently appending.
- Dictation and the typed note attach to the brief when no brief file exists (a dictated brief is a valid brief); once a brief file exists they become an addendum to it.
- The primary button stays disabled until a brief exists. Supporting documents alone cannot start a programme.
- Each context item shows name, source (file/link), and read status; removal is one click.
- Both zones share the existing upload → parse → excerpt pipeline, so nothing about parsing changes.

## 2. The read (Beat 2)

`proposeProgrammeFromMaterial` takes the material as `{ brief, context[] }` rather than one blob, and the prompt is explicit about precedence: the brief sets title, objectives, decisions, timeframe and instrument; context may only enrich hypotheses, sensitivities and open questions, and where context contradicts the brief the brief wins and the conflict is surfaced as an open question.

The read-out screen (`ProgrammeSetup`) gains a provenance line under the title — *"Read from **tender-notice.pdf**, informed by 3 supporting documents"* — with the context list expandable, plus an Explain entry covering brief-vs-context precedence.

## 3. Persistence

Migration on `persona_projects`:
- `brief_source jsonb` — the single governing document (name, path, mime, size, url, excerpt, captured_at).
- `brief_uploads` keeps its meaning but is now strictly the supporting set (existing rows migrate unchanged: if a project has uploads and no `brief_source`, the first upload is promoted to the brief).

`createProject`, `saveProjectBrief` and `getProjectBrief` all carry the two fields separately, and the Stage 01 `ProgramBriefIntake` screen renders the same two-zone split so the distinction survives into an already-open programme.

## 4. Second brain filing

Every item captured at intake is registered in the corpus, not just held on the project row:
- `upsertCountrySource` per item (deduped on the normalized URL/path key as the corpus contract requires), tagged `org = 'Research Chamber'`, with `doc_role: 'brief' | 'context'` and the programme id in metadata.
- The extracted text is chunked and embedded through the existing `chunkText` / `embedBatch` path into `country_source_documents` / `country_source_chunks`, so the material is retrievable by every other chamber's corpus search.
- Visibility follows the programme's Public/Private choice, and private items carry `owner_country_code` + `uploaded_by` so the RLS helper partitions them correctly.
- Filing runs after the project is created (so it can be attributed) and is idempotent — re-reading the same document adds nothing.

## Technical notes

- Files touched: `src/components/personas/ProgrammeIngest.tsx`, `ProgrammeSetup.tsx`, `TrackGateEntry.tsx`, `StudyWizard/ProgramBriefIntake.tsx`, `src/lib/personas/project-brief.functions.ts`, `projects.functions.ts`, plus a new `src/lib/personas/corpus-file.functions.ts` for the corpus filing pass and one migration.
- No change to the AI model or to the upload/parse plumbing.
- Header docblocks and `bun run headers && bun run map` refreshed for the new server module.
