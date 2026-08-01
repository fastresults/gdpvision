## Goal

Chamber 07 today runs synthetic publics. This adds a parallel, first-class **real-world research track** that is fully brief-driven: any brief, any methodology, any duration. Nothing about the shape of a programme is hardcoded — the brief is the input, and AI derives the plan, the methods, the instruments, the recruitment profile and the schedule from it. The system then runs that programme end to end and feeds everything it learns back into the country's second brain.

## Governing principle: AI-first, brief-derived, zero templates

There is no canonical programme, no default number of weeks, no fixed phase names, no assumed mix of surveys and focus groups. A brief may describe a two-week rapid pulse, a nine-month longitudinal panel, a single expert roundtable, a nationwide quantitative wave, an ethnographic diary study, or something the platform has never seen. In every case the same pipeline applies:

```text
Brief in  →  AI comprehension  →  Proposed programme  →  Human review/edit  →  Run  →  Corpus
```

The AI proposes; the human is always sovereign over the result. Every derived element is editable, regenerable, and explainable via `<Explain>`.

## What the AI derives from a brief

Given a brief (uploaded document, pasted text, or dictated), the planner returns a programme proposal in which **every one of these is inferred, not assumed**:

- **Objectives and research questions** — what this programme must answer.
- **Duration and cadence** — total span and rhythm, derived from the brief's stated deadline, scope and urgency. If the brief names a deadline, dates back-solve from it; if it doesn't, the AI proposes a defensible span and explains why.
- **Phase structure** — however many phases the work actually needs, named for this programme, not from a template library.
- **Milestones and deliverables** — the specific artefacts this brief implies (screeners, guides, questionnaires, toplines, final reports, presentations), each with an owner slot and a due date inside the derived schedule.
- **Method mix** — which methods serve which objective: quantitative survey, focus group, depth interview, expert panel, diary, observational, desk research, or a combination, plus the reasoning for each choice.
- **Audience and recruitment profile** — who must be heard, in what proportions, at what sample sizes, with recruitment feasibility flagged.
- **Instruments** — draft questionnaires and discussion guides written to the objectives, not filled from stock question banks.
- **Risks and dependencies** — what could derail the schedule.

Everything arrives as a proposal with rationale attached, presented for review. The human can accept wholesale, edit any element, or send it back with steering notes for a regenerate. Re-planning mid-flight is supported: if scope changes, the AI re-derives the remaining schedule around work already completed.

## Concept model

```text
Research Programme (persona_projects)
  ├── Brief            (document / paste / voice)  → parsed → objectives + constraints
  ├── Derived plan     (AI: phases, milestones, deliverables, dates, method mix)
  ├── Participant CRM  (contacts, panels, consent, communications)
  └── Studies          — as many as the derived method mix calls for
        ├── mode = synthetic  (existing persona simulation)
        └── mode = field      (NEW — any real-world method)
              ├── Instrument (AI-drafted to this study's objective)
              ├── Fieldwork  ├─ hosted: per-contact invite links → responses
              │              ├─ sessions: groups/interviews w/ attendees + recording
              │              └─ imported: CSV / transcript / audio / notes
              └── Synthesis  → findings → corpus write-back (programme-scoped)
```

## What gets built

### 1. Brief intake and programme planner
- Brief intake accepts document upload, paste, or dictation, and captures only genuine constraints (deadline if any, budget if any, mandatory audiences if any) — never a template choice.
- `programme-plan.functions.ts`: brief + country context pack → full structured proposal covering everything in the section above, with per-element rationale.
- Proposal review UI: accept, edit inline, or regenerate with steering. Commit writes the plan; subsequent re-plans version it rather than overwriting.

### 2. Programme workspace
Route `admin/countries/$code/personas/programme`, entirely data-driven off the derived plan:
- **Masthead** — objectives, span, % complete, next milestone, at-risk count, live fieldwork counters.
- **Timeline** — renders whatever phases and span the plan produced; the axis scales to the programme's actual duration, whether that's days, weeks, or quarters.
- **Deliverables ledger** — the deliverables this brief implied, with due dates, owners, statuses, attachments.
- **Studies rail** — synthetic and field studies with mode and method badges.
- House style throughout: `btn-*` utilities, `<PrettyJson>`, `<Explain>` on every AI-derived figure (sample size, duration, method choice, confidence).

### 3. Participant CRM and communications
- **Contacts** — name, email, phone, organisation, role, tags, source, consent status, opt-out, notes, last-contacted. Manual add plus CSV import with column mapper; dedupe on normalised email/phone.
- **Panels** — saved filtered lists, reusable across studies and programmes.
- **Recruitment board per field study** — target vs invited vs responded vs declined vs scheduled, with a per-contact status ladder (invited → opened → started → completed / declined / no-show).
- **Communications** — invite, reminder, confirmation, thank-you and follow-up messages, AI-drafted from this programme's brief and this study's purpose, editable, with merge fields. Sends go through the project's email infrastructure and are logged with delivery/response state. Consent and opt-out are enforced at send time.
- **Sessions** — schedule groups, interviews or panels (date, time, venue or link), attach invitees, track RSVP and attendance, attach the recording afterwards.

### 4. Field instruments and collection
- **Instrument builder** — AI drafts to the study's objective; fully editable; supports single/multi choice, scale, ranking, matrix, open text, and moderator-guide prompts for qualitative work.
- **Hosted collection** — public route `/f/$token`; tokens are per-contact when invited (so responses attribute to a CRM contact) or anonymous-open when the study calls for it. Validated public server route, optional close date and response cap.
- **Imported collection** — CSV of external survey exports with a column→question mapper; transcript, audio and field-note upload for qualitative work, reusing the existing transcription path.

### 5. Everything returned feeds the second brain
A standing rule for the field track, independent of method:
- **Survey submissions** — stored, then aggregated responses and verbatims chunked, embedded and written to the corpus via the existing writers, tagged with `programme_id`, `study_id`, method and country.
- **Transcripts, audio and notes** — transcribed where needed, chunked, embedded, written with session and speaker attribution, tagged to the same programme.
- **Synthesis** — a `memory_object` (`research_finding` per study, `research_programme` at close) capturing toplines, quotes and confidence, linked to sources.
- Field-derived corpus rows default to **private**, owned by the country — they contain real citizen input. Contact PII never enters the corpus: quotes carry pseudonymous participant codes, and the CRM remains the only place identity lives.
- Because it's programme-tagged in the corpus, Ask the Ledger and the other chambers can cite real field evidence, always labelled as such and never silently blended with synthetic output.

### 6. Synthesis and calibration
- Field synthesis runs over real responses, transcripts and notes: toplines, segment cuts, verbatim quotes, confidence.
- Where a synthetic study and a field study answer the same objective, show the delta — a genuine calibration signal for the lab.

## Technical notes

**New tables** (each with GRANTs, RLS via `has_country_access`, `visibility` + ownership per the private-data contract, `updated_at` triggers):
- `programme_plans` (versioned; stores the derived structure as data, not fixed columns), `programme_phases`, `programme_milestones`, `programme_deliverables`
- `research_contacts`, `research_panels`, `research_panel_members`, `research_invitations`
- `comms_templates`, `comms_log`
- `field_sessions`, `field_session_attendees`
- `field_instruments`, `field_collections`, `field_responses`
- Column additions: `studies.mode`, `studies.method`, `studies.programme_milestone_id`

Schema is deliberately shape-agnostic: phases, milestones and methods are rows the planner creates, so a two-week pulse and a nine-month panel use the same tables with no special-casing.

**New server modules** under `src/lib/personas/`: `programme-plan.functions.ts`, `programme.functions.ts`, `crm.functions.ts`, `comms.functions.ts`, `field-instrument.functions.ts`, `field-collection.functions.ts`, `field-sessions.functions.ts`, `field-synthesis.functions.ts`, plus `field-corpus.server.ts` for write-back. Public respondent surface: `src/routes/f.$token.tsx` and `src/routes/api/public/field/$token.ts`.

All protected fns use `.middleware([requireSupabaseAuth])`, called from components via `useServerFn` + `useQuery`. The respondent page is public, Zod-validated server-side, and exposes only instrument text.

**Storage**: reuse `study-artifacts` for briefs, transcripts, audio, imports and deliverable attachments.

**Docs**: update `AGENTS.md` §3 and `docs/map/chambers.md`; run header/map scripts.

## Build order

1. Migration: shape-agnostic tables, columns, GRANTs, RLS, triggers.
2. Brief intake + AI programme planner (derivation, rationale, review, regenerate, re-plan).
3. Programme workspace UI rendering whatever the plan produced.
4. Participant CRM: contacts, import, panels.
5. Field study scaffolding + instrument builder.
6. Invitations, per-contact hosted links, respondent page.
7. Communications: templates, sending, logging, consent/opt-out.
8. Sessions, attendance, recording upload.
9. Imported collection (CSV, transcripts, audio, notes).
10. Corpus write-back on every return path.
11. Field synthesis + synthetic-vs-field calibration.
12. Map/doc regeneration.
