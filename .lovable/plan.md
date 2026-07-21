## Plan: make every Persona Lab report complete by default

### Confirmed current state
- The active KNA project (`Project Destiny`) has completed per-study memos, but no saved program-level report yet.
- The per-study memo text already contains some scope and instrument context, but the individual Markdown export does not deterministically include the full cast, segment/group framing, methodology narrative, and report conclusions as required.
- The program-level UI/export has a methodology dossier path, but it must become a non-optional global contract rather than a best-effort section.

### Global reporting rule to implement
Every Chamber 07 report — individual study and full program synthesis — must include, in this order:

1. **Report frame**
   - What this report is about
   - Country, project, decision context, study/program objective
   - What question it is intended to help answer

2. **Original brief / scope**
   - The committed research brief
   - AI-enriched objectives
   - Any uploaded/source material excerpts that shaped the study

3. **Methodology**
   - What the empirical workflow did
   - How Cast, Group, and Rehearse work in this run
   - Why these segments, personas, methods, and instruments were selected
   - Known limits and what remains unanswered

4. **Cast**
   - All personas used in the report
   - Persona name, archetype, segment, summary, relevant traits
   - No hidden roster; collapsed UI sections are fully expanded in Markdown export

5. **Groups / segments**
   - Segment names, prompts, rationale, persona counts
   - Which studies each segment was used in

6. **Rehearse / instruments**
   - Each study run
   - Method type: survey, focus group, creative test
   - Objective, segment, persona count
   - Full question set and response/transcript basis

7. **Main conclusions**
   - Synthesized findings written as decision-ready conclusions
   - Cross-cutting themes and evidence

8. **Recommendations**
   - Recommended moves
   - Why each matters
   - Owner, timing, horizon, risks

9. **Evidence appendix**
   - Questions, responses, transcripts, themes, raw structured sections
   - Sources and citations

### Implementation approach

#### 1. Create one canonical report dossier builder
- Add a server-safe/shared helper that assembles a deterministic `ResearchReportDossier` from existing project, brief, segments, personas, studies, questions, responses, transcripts, study reports, and program reports.
- Use this same dossier for:
  - individual study detail pages
  - program synthesis card
  - individual Markdown downloads
  - program Markdown downloads
  - any future report surfaces

This prevents the system from producing a thin report in one place and a complete report somewhere else.

#### 2. Strengthen individual study synthesis
- Update `runStudySynthesis` so the AI memo receives a complete deterministic methodology block:
  - original brief
  - segment label/prompt
  - full persona roster for that segment
  - question set
  - response/transcript evidence
- Require the returned memo to include the report frame, methodology, cast/group/rehearse explanation, conclusions, recommendations, and limitations.
- Persist a `context` snapshot with the persona roster and methodology so old data can still export consistently.

#### 3. Strengthen program synthesis
- Update `synthesizeStudyProgram` so the program memo is explicitly anchored in:
  - brief
  - blueprint/design rationale
  - all segments
  - all personas
  - all studies/questions
  - all study memos
- Persist the methodology dossier inside `study_program_reports.sections.methodology` every time.
- Keep the existing live fallback that rebuilds methodology for older reports, but make the report body itself follow the required structure.

#### 4. Upgrade Markdown exports
- Refactor `studyReportToMarkdown` and `programReportToMarkdown` so exports are not just the AI memo plus appendices.
- Each export will start with the deterministic report frame and methodology, then cast/groups/rehearse, then conclusions/recommendations, then full expanded evidence appendices.
- Ensure all accordion/collapsed UI data is included in Markdown.

#### 5. Upgrade UI report presentation
- On individual study detail pages, show the report frame and methodology dossier before the synthesis body.
- On program synthesis, make “Original brief,” “Methodology,” “Cast,” “Groups,” and “Instruments” first-class report sections, not secondary optional details.
- Add a clear “Main conclusions & recommendations” section so the decision output is not buried.

#### 6. Backfill current and older reports safely
- For reports already saved before this contract, render/export the missing methodology from live project data.
- For the current KNA project, once the remaining running/draft studies are complete, regenerate the program synthesis so the saved report body follows the new contract.
- Do not require a database schema change unless existing JSON fields are insufficient; the current `context` and `sections` JSON fields appear sufficient.

### Validation
- Verify the current KNA project report page shows:
  - report frame
  - original brief
  - cast/personas
  - groups/segments
  - rehearse/instruments/questions
  - conclusions and recommendations
- Download both an individual study Markdown report and a program Markdown report and confirm every collapsed/accordion section is expanded in the file.
- Confirm older reports still render methodology through the live fallback even if their stored memo predates the new contract.