# Chamber 07 — Synthetic Persona Lab

An AI-first synthetic market research chamber that lets a country admin ask "how would persona/segment X react to policy/asset/question Y?" Grounded in the country's Second Brain (sectors, KPIs, ministries, signals, memory objects, public+private corpus) so every persona and every response cites real country context — not generic LLM output.

**Top-line override:** every module runs through the AI Gateway with grounded context first. The PRD's static forms, credit economy, marketplace, and hybrid-human-panel bridge are v2 concerns; MVP is AI generation + grounded reasoning + persona-perspective analysis.

## 1. Scope (MVP → v1)

Ship these five surfaces integrated in the same chamber shell as 01–06:

1. **Persona Studio** — AI-generated personas grounded in country context (sectors, ministries, KPIs, signals). Manual attribute overrides available but optional. OCEAN + demographics + psychographics + behavioral traits. Persistent, reusable, versioned.
2. **Segment Generator** — natural-language prompt ("CBI applicants weighing Antigua vs St Kitts", "ABST-liable SME owners in St John's") → N unique personas with a controllable distribution, all citing country facts.
3. **Ask Away (1-on-1)** — live chat with a single persona, streaming, with citations back to Second Brain artifacts.
4. **Study Runner** — three study types over a segment: **Survey** (quant, AI-authored questionnaire + AI-answered), **Focus Group** (AI-moderated multi-persona room with true inter-persona reactions), **Creative Evaluation** (paste text / upload image / URL → per-persona scored reactions).
5. **Persona-Perspective Analyze** — attach any artifact from the Second Brain (memory object, source doc, ledger row, scenario, narrative brief) and ask "how does this land with persona/segment X?"

Deferred to v2 (documented, not built): credit economy, hybrid human panel bridge, longitudinal trackers, marketplace, video ingestion, custom fine-tuned models, conjoint/MaxDiff.

## 2. AI-first grounding contract (non-negotiable)

Every persona generation, question, and answer call assembles a **CountryContextPack** (same helper used by Chamber 03's recommender and Chamber 05 briefs):

- top sectors + shares, KPIs w/ latest values + targets
- ministry roster + mandates
- recent P1/P2 signals (Chamber 05)
- top matching `memory_objects` + `country_source_chunks` via pgvector (public + admin's private, respecting `visibility` RLS)
- active scenarios / threats (Chambers 03 + 04) when relevant to the prompt

Prompt scaffolding forces: cite `[N]` markers, refuse to invent facts not in the pack, output strict JSON. Renders through `<CitedMarkdown>` so refs open the existing source modal — same pattern as Chambers 04/05.

## 3. Data model (new tables, all country-scoped + `visibility` public|private)

```text
personas                 id, country_code, name, archetype, attributes(jsonb),
                         ocean(jsonb), grounding_refs(jsonb), origin('ai'|'manual'),
                         version, visibility, owner_user_id, created_at
persona_segments         id, country_code, label, prompt, distribution(jsonb),
                         size, visibility, owner_user_id
persona_segment_members  segment_id, persona_id
studies                  id, country_code, kind('survey'|'focus_group'|'creative'|'interview'),
                         title, objective, segment_id, status, config(jsonb),
                         visibility, owner_user_id, created_at
study_questions          study_id, ord, kind, prompt, options(jsonb)
study_responses          study_id, persona_id, question_id, answer(jsonb),
                         rationale, citations(jsonb), model, created_at
study_transcripts        study_id, ord, persona_id|null (moderator), utterance, citations
study_reports            study_id, summary_md, themes(jsonb), citations(jsonb)
persona_chats            id, persona_id, user_id, created_at
persona_chat_messages    chat_id, role, content, citations(jsonb)
```

Every table: `GRANT` block for `authenticated` + `service_role`, `RLS ON`, policies via existing `has_country_access(country_code)` helper + `visibility='public' OR owner_user_id = auth.uid()`. Follows the Public/Private framework already in place.

## 4. Server functions (all `createServerFn` + `requireSupabaseAuth`, in `src/lib/personas/`)

- `generatePersona.functions.ts` — Gemini 3.5 Pro, JSON schema, grounded on CountryContextPack.
- `generateSegment.functions.ts` — same, produces N personas + distribution audit.
- `askPersona.functions.ts` — streaming chat via AI Gateway (Vercel AI SDK).
- `authorQuestionnaire.functions.ts` — objective → 10-question survey.
- `runSurvey.functions.ts` — fan-out per persona, batched, writes `study_responses` with rationale + citations. Long-running → durable stage pattern like Stage 09 (client-driven granular loop, heartbeat, resume).
- `runFocusGroup.functions.ts` — AI moderator loop: introduce → probe → challenge → summarize. Writes `study_transcripts` with speaker attribution.
- `evaluateCreative.functions.ts` — text/image/URL asset scored per persona (appeal, clarity, intent + open-ended).
- `personaPerspectiveAnalyze.functions.ts` — artifact + persona → grounded reaction brief.
- `synthesizeStudyReport.functions.ts` — themes, sentiment, pull-quotes → `study_reports.summary_md` (rendered via `<CitedMarkdown>`).

All follow existing patterns: strict Zod input validators, structured outputs, 429/402 handling, fair per-persona work distribution, resumable runs.

## 5. UI (in Chamber shell, McKinsey-grade like 03/04/05)

Route tree:

```text
/admin/countries/$code/personas/
  index.tsx                  · Persona Studio grid + "Generate personas" hero
  segments.tsx               · Segments list + prompt composer
  segments.$id.tsx           · Segment detail (distribution, member personas)
  personas.$id.tsx           · Persona detail: profile, memory refs, "Ask away" tab
  studies/index.tsx          · Studies board (survey | focus group | creative)
  studies/new.tsx            · Guided 3-step wizard (Objective → Segment → Instrument)
  studies/$id.tsx            · Live run + results (transcripts, dashboards, themes)
  analyze.tsx                · Attach Second-Brain artifact + persona lens
```

Components in `src/components/personas/`:
- `PersonaCard`, `PersonaGrid`, `SegmentComposer`, `DistributionDials`
- `AskAwayPanel` (streaming, `<CopyButton>`, `<CitedMarkdown>`)
- `StudyWizard` (reuses `GuidedRail` / `StepProgress` from Chamber 03)
- `SurveyDashboard` (crosstabs, sentiment; recharts), `FocusGroupTheatre` (speaker-attributed transcript, live-typing), `CreativeScorecard`
- `PersonaPerspectiveBrief` (McKinsey layout, citations)

Chamber launcher: add tile #7 "Synthetic Persona Lab" to `ChambersLauncher.tsx` with icon + subtitle; matching return-code round-trip so wizards return to `/onboard`.

## 6. Second-Brain integration

- `DataStoresPanel` gets two new tabs: **Personas** and **Studies** (counts, recent, public/private split).
- `BrainConstellation` gets a `persona` node kind so personas + segments appear alongside sectors/ministries/signals; edges to memory objects they cite.
- Corpus writers: study reports and persona-perspective briefs are ingested back into `memory_objects` (visibility inherited from the study) so future prompts can cite them — full loop, same as Chambers 05/06.
- Chamber 03 (Scenarios) and 04 (FDI Studio) get an "Ask a persona" action on any artifact, routing through `personaPerspectiveAnalyze`.

## 7. Cron / automation

None required for MVP. v2 will add scheduled longitudinal waves (`pg_cron` → `/api/public/hooks/persona-wave` on the same pattern as `press-tick`).

## 8. Guardrails

- All numeric/JSON responses render via `<PrettyJson>` (project-wide rule).
- Every AI-generated persona/answer stores its citations; UI blocks display of any answer with zero grounding refs when `require_grounding` is true (default).
- Private uploads used to ground a persona flow through the existing `has_country_access` + `visibility` gate — the RLS layer already covers this.
- Model defaults: `google/gemini-3.5-flash` for generation, `google/gemini-3.1-pro-preview` for reasoning-heavy synthesis and focus-group moderation; user cannot pick model.

## 9. Build sequence

1. **Migration + RLS + grants** for the 9 new tables.
2. **CountryContextPack helper** extraction (shared with Chambers 03/05).
3. **Persona + Segment generation** server fns + Persona Studio UI + launcher tile.
4. **Ask Away** streaming chat.
5. **Study Wizard + Survey runner + dashboard**.
6. **Focus Group theatre + Creative Evaluation**.
7. **Persona-Perspective Analyze** wired into Second Brain artifacts.
8. **DataStores tabs + BrainConstellation node kind + memory writeback**.

Ready to build on approval.