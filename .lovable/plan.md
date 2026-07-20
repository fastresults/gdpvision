# Chamber 07 · Research Studio Wizard

Turn Chamber 07 from a "type a one-line brief → get a persona" utility into a full **modal wizard** that scopes a McKinsey-grade research study end-to-end. AI does the heavy lifting at every step; the corpus (public + private) is consulted first, then the open web fills the gaps.

Worked example we must handle: *"Grenada, 2 years post-rebrand, get a current snapshot of internal & external CBI stakeholders, run a focus group and surveys, align to the original brand intent doc I'm uploading."* → the wizard frames the scope, defines the deliverables, casts the personas + segments, and launches the study — grounded and cited.

## The wizard (pop-up modal, 5 steps)

Modal launched from Chamber 07 landing via a single primary CTA: **"Frame a study"**. Steps use a left rail (Brief → Outcome → Cast → Preview → Launch) with autosave draft (`persona_study_drafts`) so a PM can leave and return.

**Step 1 — Capture the brief (multimodal)**
- Three parallel input rails inside one card:
  - **Type**: rich textarea with McKinsey prompt scaffolds ("context / trigger / what changed / what's at stake").
  - **Speak**: reuse `useVoiceRecorder`, POST audio to Lovable AI Gateway STT (`openai/gpt-4o-mini-transcribe`) → transcript appended.
  - **Upload**: PDFs / DOCX / images / audio via existing storage; parse with `document--parse` equivalent server fn (pdf-parse for text, STT for audio, vision model for images). Files stored on `study-artifacts` bucket, private-by-default and scoped to the country.
- On "Enrich": AI (Gemini 2.5 Pro) turns raw inputs into a **Research Scope** — objectives, hypotheses, decisions this must inform, stakeholders (internal/external), timeframe, geographies, sensitivities, success criteria. Rendered as an editable structured card the user can accept/adjust.

**Step 2 — Define the output (McKinsey deliverable spec)**
- Same three input modes (type / speak / upload a template).
- AI proposes a **Deliverable Blueprint** from a curated McKinsey library: SCQA memo, MECE stakeholder map, Pyramid one-pager, Focus-group discussion guide, Survey instrument (Likert + open), Brand-alignment scorecard, Segment×Message matrix, Exec readout deck.
- Multi-select; each deliverable expands to show sections/columns; user tweaks tone (Cabinet, Investor, Public), length, and evidence density.

**Step 3 — Cast (AI-generated personas, segments, studies)**
- AI drafts the full research cast in one server pass, **corpus-first**:
  1. Pull country context pack (existing `buildCountryContextPack` — sectors, KPIs, ministries, signals, dossiers, sources) filtered by visibility the user has access to.
  2. Semantic search of `country_source_chunks` + `memory_objects` for the enriched scope keywords.
  3. **Gap detector**: model returns `missing_evidence[]` — for each gap, fire a Perplexity `sonar-reasoning-pro` deep-research call, ingest results into the corpus (public or private, per user choice) and cite them.
- Output preview: N personas (with archetype, quotes, motivations, objections, citations), M segments (with size proxies + evidence), and K study instruments (focus-group guide, survey, interview protocol) — all inline-editable, each claim carrying a `[N]` citation into the source modal.

**Step 4 — Preview & approve**
- Full read-only render of the study package: Scope → Deliverables → Cast → Instruments → Evidence ledger (public vs private badges, source counts, coverage bar). "Regenerate section" buttons per block. Cost/latency estimate for launch.

**Step 5 — Launch**
- Persists `persona_studies` row + child `personas`, `persona_segments`, `study_instruments`, `study_evidence` (all visibility-scoped). Kicks a background job (`onboarding_tasks` pattern) that:
  - Runs synthetic focus-group + survey simulations against each persona.
  - Produces the selected deliverables as markdown artifacts (stored in `comms_artifacts` reusing Chamber 05's editor / versioning / copy tools).
- User lands on the study detail page with live progress polling.

## Technical shape

**New / modified files**
- `src/components/personas/StudyWizard/` — `WizardModal.tsx`, `StepBrief.tsx`, `StepOutcome.tsx`, `StepCast.tsx`, `StepPreview.tsx`, `StepLaunch.tsx`, `MultimodalInput.tsx` (shared type/speak/upload), `DeliverableBlueprintPicker.tsx`, `EvidenceLedger.tsx`.
- `src/lib/personas/wizard.functions.ts` — server fns: `enrichBrief`, `enrichOutcome`, `draftCast`, `deepResearchGap`, `commitStudy`, `saveDraft`, `getDraft`.
- `src/lib/personas/transcribe.functions.ts` — audio → text via Lovable AI STT.
- `src/lib/personas/parse-upload.functions.ts` — PDF/DOCX/image parsing → normalized text + persist to `study-artifacts` bucket.
- `src/lib/personas/context-pack.server.ts` — extend to include `memory_objects` and per-brief keyword search; return `gaps[]`.
- `src/routes/_authenticated/admin/countries.$code.personas.index.tsx` — replace top form with the CTA that opens `<StudyWizard>`; keep library grid below.
- Migration: `persona_study_drafts`, `study_instruments`, `study_evidence`, `study-artifacts` storage bucket (private, RLS by country + uploader), plus grants and RLS mirroring existing personas tables (public-vs-private via `has_country_access`).

**AI orchestration**
- Enrichment + drafting: `google/gemini-2.5-pro` with strict JSON schema per step; hygiene guard (`sanitizeJsonCitationMarkers`, `validCitationsForRefs`) applied to every output.
- Deep research fallback: Perplexity `sonar-reasoning-pro`, results normalized and upserted into `country_sources` / `country_source_documents` / `country_source_chunks` via existing `upsertCountrySource` (dedup rule preserved).
- STT: `openai/gpt-4o-mini-transcribe`; input audio format from `MediaRecorder` (webm/m4a) passed as documented multimodal input.
- All outputs render through `<PrettyJson>` / `<CitedMarkdown>` per global rules; every citation is clickable.

**Grounding & citations**
- Corpus-first is enforced: the drafting server fn refuses to emit a claim without at least one citation from context pack OR a fresh deep-research citation it just wrote back.
- Private-uploaded evidence tagged `visibility='private'`, `owner_country_code`, `uploaded_by`; never shown to users without country access.

**UX guardrails**
- Modal is full-screen on mobile, ~1120px on desktop; step rail sticky; keyboard `⌘↵` advances; autosave every 8s.
- Every AI step shows a live activity ticker (Chamber 05 pattern) — "Reading 12 sources · querying corpus · 2 gaps → deep research".
- Cancel/close returns to draft list under the CTA ("Continue draft — Grenada CBI rebrand snapshot · 2h ago").

## Out of scope (this pass)
- Sending real surveys to human respondents (synthetic only for now).
- Multi-country studies in one wizard run.
- Realtime co-editing.

## Acceptance test (Grenada CBI example)
1. Open Chamber 07 as Grenada admin → click "Frame a study".
2. Speak the brief, upload the original brand-intent PDF.
3. AI returns a scope naming rebrand delta, stakeholders (CIU, agents, applicants, opposition, FATF, EU), decisions this informs.
4. Select deliverables: Focus-group guide, Survey, Brand-alignment scorecard, Exec readout.
5. Cast produces 8 personas / 4 segments, each with corpus citations; 3 gaps trigger deep research; new sources land in corpus (public) with dedup.
6. Preview shows full package with evidence ledger; Launch stores the study and produces artifacts editable in Chamber 05's document tools.
