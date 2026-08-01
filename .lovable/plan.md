## Goal

End the commencement briefing with a section that answers, in the client's own terms: what will you actually get, and how does it satisfy the brief you gave us?

## What gets added

A new final section — **"The expected outcome"** (eyebrow: *Against your brief*) — appended after "Evidence, assurance and filing" in `src/lib/personas/commencement-briefing.server.ts`. It contains:

1. **A closing narrative paragraph** (AI-written, deterministic fallback) that restates the client's ask in plain language and states what the programme will hand back — the last words of the document.
2. **A commitment table: Ask → How it is answered → What you receive → When.** Each row is built from a committed objective in the programme plan, matched to the instruments/waves that address it and to the deliverable and milestone that carry it. Nothing invented — unmatched objectives are shown honestly as "covered by synthesis at close".
3. **A short "What this briefing does not promise" note** — the stated limits (sample sizes, confidence level, anything the risk register already flags), so the outcome claim is credible rather than salesy.

## Technical notes

- Extend the `Narrative` interface and `NARRATIVE_SYSTEM` prompt with a fourth key, `expected_outcome`: 2–3 paragraphs, written last, addressed to the client, explicitly referencing the source brief (`persona_projects.brief_raw` / `brief_scope`) and the committed deliverables. Update `isNarrative()` accordingly; if the model is unavailable, a deterministic fallback composes the same paragraph from plan summary + deliverables list.
- The narrative input payload already carries `brief`, `scope`, `objectives`, `waves` and instrument counts; add `deliverables` (title, kind, due date) and `milestones` so the model can name what lands and when.
- Objective → coverage mapping is deterministic: match on the objective text against instrument question `objective` tags where present, otherwise fall back to "all waves". No new tables, no migration.
- `PrintableBriefing.tsx` and `BriefingPanel.tsx` render sections generically, so the new section flows into screen, print/PDF and the table of contents with no component changes. Only the panel's intro copy is touched to mention the closing outcome statement.
- Readiness list gains no new row; this is a narrative/roll-up section, not a gate.
