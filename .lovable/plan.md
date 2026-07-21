# Full-Report Markdown Export (Chamber 07)

Every report in Persona Lab — each individual **Study** and the **Program Synthesis** memo — gets an "Export as Markdown" action that emits a single `.md` file containing **every section fully expanded**, including data that is collapsed behind accordions/toggles in the UI (Questions Asked list, per-question response rows, transcript, themes, recommendations, methodology cast/groups/instruments, brief, unanswered, citations).

## What ships

### 1. Study report export
On `admin/countries/$code/personas/studies/$id`, add a **Download .md** button next to Run study. It downloads `{country}-{study-title}-{date}.md` with these sections, in order, always expanded:

1. Frontmatter (title, country, kind, status, segment, N personas, created_at, project)
2. Objective
3. Methodology block (segment label + segment prompt, persona count)
4. **Questions asked** — full ordered list with kind (currently collapsed behind "Questions asked (N)" accordion in `SynthesisDigest`)
5. Synthesis memo (`report.summary_md`, citation markers preserved)
6. Themes (label, prevalence %, quote) — all, not sliced
7. Recommendations (move, why, owner, horizon) — all, not sliced
8. Transcript (focus groups) — every turn with speaker + utterance
9. Responses (surveys/creative tests) — grouped by question, every persona's answer + rationale (serialized from JSON when needed)
10. Sources — numbered citation list with title / url / org / excerpt

### 2. Program synthesis export
On the Program Synthesis card, add a **Download .md** button next to Regenerate. It downloads `{country}-program-synthesis-{date}.md` with:

1. Frontmatter (country, project, studies consolidated, generated_at)
2. Portfolio scope + brief link
3. Original brief (title, objectives, raw excerpt)
4. Consolidated summary (`summary_md`)
5. Methodology dossier fully expanded: Cast (segments), Groups, Instruments (studies) — no truncation
6. Design rationale (why_segments, why_methods, coverage_gaps)
7. Recommendations — all (not `.slice(0,6)`)
8. Unanswered — all (not `.slice(0,6)`)
9. Sources — numbered citation list

## Technical

- New file `src/lib/personas/report-export.ts` — pure formatters (`studyReportToMarkdown`, `programReportToMarkdown`) taking the shapes already returned by `getStudy` and `getStudyProgramReport`. No DB reads, no server round-trip needed since the data is already loaded in the page.
- Sanitize citation markers using the existing `citations/hygiene` helpers so `[N]` stays valid; append a **Sources** section built from the same `citations` array.
- Convert JSON answers (creative_test payloads, structured survey answers) to fenced ```json blocks so nothing renders as `[object Object]`.
- Escape pipe chars in table cells; wrap long quotes as blockquotes.
- Download via a small `downloadMarkdown(filename, body)` util (Blob + object URL), mirroring the pattern already used in `ArtifactPanel.tsx`.
- Buttons: reuse the existing mono-uppercase pill style; label `Download .md` with `Download` icon from `lucide-react`.
- No schema changes, no server functions, no new dependencies.

## Out of scope

- PDF / DOCX export (Markdown only, per request).
- Other chambers' reports (Cabinet, Ledger, FDI) — those already have their own document pipeline in `documents.functions.ts`; only Chamber 07 currently lacks an export.
