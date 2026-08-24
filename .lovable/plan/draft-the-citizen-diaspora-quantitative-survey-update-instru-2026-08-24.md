# Draft the Citizen & Diaspora Quantitative Survey + Update Instruments Document

## Goal

The Grenada CBI study promises a "robust quantitative survey of Grenadian citizens and Diaspora" sent by email/hosted link — but only a focus-group pre-session questionnaire (Survey v1) and a moderator guide (v3) were ever drafted. This plan drafts the missing field survey through the app's own instrument-drafting workflow, makes it emailable, and regenerates the markdown breakdown so it covers all instruments of record.

## 1. Draft the quantitative survey via the app's own drafting flow

- Invoke the existing `draftInstrument` server function (the same senior-methodologist prompt that drafted the moderator guide — objective coverage, plain neutral language, sensitive items late, frontline-insight closing block) against study `955ed067-973a-4dd5-a376-764c99845b69`, kind `survey`, with steering that specifies:
  - **Audience:** Grenadian citizens AND Diaspora combined in one instrument, with a residency segmentation question (mainland / Carriacou & Petite Martinique / overseas).
  - **Distribution:** self-completion by email and hosted open link — mobile-friendly, completable in under 10 minutes, ~15–18 questions.
  - **Coverage:** all four objectives (O1 Trust/CSAT baseline, O2 public mandate & national benefit, O3 CIU→IMA rebrand impact, O4 alternative models / June 2028 EU horizon), each question tagged with `objective_ref`.
  - **Complements, not replaces** the focus-group pre-session questionnaire.
- Result: a new `field_instruments` row, `generated_by: ai`, next version number per the study's versioning rule. It appears in the Instruments stage as the current survey of record; Survey v1 stays filed in history and its live collection keeps working.
- Fallback if the authenticated server function cannot be invoked from the sandbox: draft with the identical prompt and question JSON schema via the AI gateway and insert the same row shape directly.

## 2. Make it emailable

- Stand up a hosted open-link collection for the new survey through the existing deploy path (`buildDeployPacks` / `setOpenAccess`), so it has a shareable participant link plus CSV/JSON return packs — ready to email to citizen and Diaspora lists.

## 3. Regenerate the instruments document

Rewrite `public/cbi-stakeholder-survey-instruments.md` from the live data:

- **Instrument inventory** — three instruments: Pre-Session Questionnaire (Survey v1), the new National Public Mandate & Sentiment Survey (Citizens & Diaspora), and the Moderator Discussion Guide (v3).
- **New dedicated section** — full question-by-question breakdown of the new survey (IDs, types, options, scale anchors, `objective_ref`, frontline-insight block).
- **Updated appendix** — objective cross-reference matrix extended with the new survey's explicit `objective_ref` tags; coverage-check total updated (30 questions across three instruments).
- Provenance rule preserved: content drawn only from the study's own brief and instruments — no platform or chamber references.

## 4. Verify

- New instrument's questions conform to the app's question schema (ids snake_case, scales labelled, options mutually exclusive).
- All four objectives covered by at least one question in the new survey.
- Markdown renders cleanly: all three instruments present, tables intact, no truncated prompts.
- Instruments stage in the app shows the new survey as the current survey of record.

## Technical notes

- Drafting runs through `draftInstrument` in `src/lib/personas/field-instrument.functions.ts` → `draftAndStoreInstrument` in `instrument-draft.server.ts` — no code changes required.
- The Instruments stage shows the latest version per kind; the new survey becomes the visible survey while v1 remains in the instrument history (existing behaviour, not a regression).
- No schema or RLS changes; one new row in `field_instruments` (plus a field collection for the open link).
