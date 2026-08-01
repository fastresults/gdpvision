
# Commencement Briefing (Chamber 07 · Field programme)

A super-admin-only document that says to the client, before a single question is asked: here is what you asked, here is how we will answer it, who we will hear from and why, exactly what we will ask them, and how the evidence will be gathered and judged.

## When it appears

An "Assemble the commencement briefing" action sits on the field rail, live once the programme is *ready to commence*:

- brief committed
- plan approved and active
- participants stage complete (a panel with at least one live contact)
- instruments stage complete (every instrument the method mix requires is drafted)
- fieldwork and evidence still outstanding

Before that, the action is visible but disabled, and states the one thing still missing (it reads the same `getFieldProgress` the rail already uses, so it can never disagree with the stepper). After fieldwork begins it stays available — the briefing is simply stamped with the date it was assembled.

## What the document contains

1. **Cover** — nation, programme title, the decision question, classification, prepared-for / prepared-by, date, and status ("Ready to commence").
2. **Executive summary** — AI-written, 200–300 words: what is being decided, how this programme answers it, what the client will hold at the end and when.
3. **The brief, verbatim** — the committed source brief in full, the scope read-out (objectives, constraints, deadline), and the supporting context filed beside it, each item listed with what it contributed.
4. **The programme** — phases with their dates and purpose, milestones, deliverables, and the method mix with a short written justification of *why this mix answers this question*.
5. **Who we will hear from** — each recruitment persona: the label, who they are, why they matter to this decision, the survey target and whether they sit in a focus group. Then the actual panel: counts by segment, how candidates were sourced, and the consent basis. Names are included or reduced to counts, per a toggle at export.
6. **What we will ask** — every instrument in full: title, objective, and every question in order with its type and options, plus the objective-coverage map showing which plan objective each question serves.
7. **How the fieldwork will run** — the wave ladder derived from the plan: each wave's method, target, channel (hosted link, session, offline intake), sequence and close test, and what the participant sees.
8. **How the evidence will be judged** — the synthesis method, what a finding must carry to count, confidence grading, stated limitations, and how the finished evidence is filed to the second brain.
9. **What we need from you** — approvals, introductions and dates required from the client to keep the programme on schedule.
10. **Sources & provenance** — every citation carried through from the brief and recruitment research.

Nothing is truncated or hidden behind accordions; every figure that is derived carries an `<Explain>` rationale on screen.

## Front end

- `src/components/personas/field/briefing/BriefingPanel.tsx` — the entry surface on the rail: readiness checklist, "Assemble" button, and once assembled, a section-by-section on-screen reader with a sticky contents rail.
- `src/components/personas/field/briefing/PrintableBriefing.tsx` — print-only render following the Chamber 08 pattern (permanently in the DOM, visible only in `@media print`, real cover page, TOC, page numbers via paged-media CSS).
- `src/components/personas/field/briefing/ExportBriefingDialog.tsx` — cover configuration (classification, prepared-for/-by, date, participant names on/off, page numbers, TOC), then `window.print()` for PDF.
- Also offered: copy-to-clipboard and `.md` download, reusing the existing Chamber 07 markdown exporter conventions.
- Reached from the field rail as a new step-adjacent panel, plus a button on the Evidence stage's approach section, so it is findable from where the work is.

## Back end

- `src/lib/personas/commencement-briefing.functions.ts` — thin wrapper with three protected server functions: `assembleCommencementBriefing`, `getCommencementBriefing`, `reviseCommencementBriefing` (regenerate the narrative sections after a change, keeping edits the admin made).
- `src/lib/personas/commencement-briefing.server.ts` — the assembler. Reads the real artefacts (`persona_projects`, `programme_plans`, `research_panels` / `research_panel_members` / `research_contacts`, `field_instruments` and their questions, plus the derived wave board from `fieldwork-plan.server.ts`) and composes a typed `CommencementBriefing` document. Factual sections are assembled deterministically from the data — never invented. Only the executive summary, the method justification and the "why this persona" lines go through the AI gateway, and only over material already in the record.
- Stored as a versioned document on the programme so it can be re-opened, re-exported and compared. Re-assembly is idempotent per version.
- Filed to the second brain through the existing Chamber 07 corpus writer on first assembly, so the approach is part of the country's record.
- Access follows the existing gate: assembled by super admins; country users bound to the nation can read and export it.

## Technical notes

- Server fns are `createServerFn` with `.middleware([requireSupabaseAuth])`, called from components via `useServerFn` + `useQuery` — never from a route loader.
- Storage uses a jsonb document column on the existing programme record rather than a new table, avoiding a migration; if versioned history is wanted, a small `programme_briefings` table is added with GRANTs and RLS in the same migration.
- All buttons use `btn-*` utilities; any JSON shown in a debug view goes through `<PrettyJson>`; derived figures register rationales in `src/lib/explain/personas-entries.ts`.
- After the work: `bun run headers && bun run map`, and the chamber map entry updated.

## Verification

Assemble the briefing on the current Grenada programme, read every section on screen, then render to PDF and inspect each page for clipped text, broken tables and missing sections before reporting back.
