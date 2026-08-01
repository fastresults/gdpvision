## What this screen is today

`ProgramBriefIntake` (Stage 00, shown at `/admin/countries/$code/personas?project=…`) is a two-column form: intake rail on the left, a static "what the AI will look for" list on the right, then a raw scope dump and a footer with two competing buttons. It reads as a form, not as a briefing. Specific weaknesses:

- No sense of position — the user can't see how far along the programme is or what happens after they confirm.
- The right rail lists generic prompts even after the AI has already answered them; it never becomes a checklist of what was actually captured.
- The enriched Research Scope renders as one undifferentiated `PrettyJson` block — the most important content on the page is the least readable.
- Two dark buttons of similar weight ("Enrich" / "Confirm") with no clear primary; blocked states are explained only in a `title` tooltip.
- Buttons use inline `bg-ink-950` / `bg-emerald-700`, which violates the `btn-*` contract in AGENTS.md.

## Recommended redesign

**1. A briefing masthead instead of a form header**
Replace the header block with: programme title, country, instrument (Synthetic / Field / Blended), and a three-beat progress line — `Material read → Scope confirmed → Chamber opens`, with the current beat marked. State plainly what confirming does and what it does not lock.

**2. "What we gathered" evidence strip**
Above the fold, a compact provenance row: the one Source Brief (named, with its role badge), the count and names of supporting context items, and dictated/typed input, each with the extracted character weight. Promote/demote stays where it is. This is the "here's what we have" moment the screen is missing.

**3. Turn the scope into a readable read-out, not JSON**
Render the enriched scope as titled cards in a two-column grid — Decisions it must inform · Objectives · Hypotheses · Audience & segments · Geography & timeframe · Sensitivities · Open questions — matching the `ReadOut` pattern already used in `ProgrammeSetup.tsx`. Each empty field shows a "not stated in your material" hint rather than disappearing. Keep the raw JSON available inside a collapsed `<details>` debug block beside the rendered view (permitted by the PrettyJson rule).

**4. Coverage checklist replaces the static prompt list**
The right rail becomes live: each of the six dimensions (Decision, Audience, Hypotheses, Timeframe, Sensitivities, Source material) shows captured / thin / missing based on the enriched scope, with the guiding question shown only where it is still missing. This is the "here's where we're at" signal, and it tells the user exactly what to add before proceeding.

**5. A single decisive action bar**
Sticky footer with one primary action that changes label by state — `Read my material` → `Confirm scope & open the chamber` — plus a secondary `Re-read` and a plain-language reason line when the primary is disabled ("Add ~40 characters or attach the brief"). Use `btn-primary` / `btn-secondary` / `btn-ghost`, removing the inline colour classes.

**6. Explain hooks**
Wrap "Read my material" and the coverage verdicts in `<Explain>` using the existing `research.intake.readout`, `research.intake.recommendation` and `research.intake.brief-precedence` rationales, so the AI's reading is interrogable rather than tooltip-explained.

**7. One engraved marginalia spot**
A single `spot` `<Illustration>` beside the masthead, per the illustration contract — no full-bleed, nothing in the reading column.

## Technical notes

- All work is confined to `src/components/personas/StudyWizard/ProgramBriefIntake.tsx`, plus a small shared `ReadOut`/`CoverageRow` extraction so `ProgrammeSetup.tsx` and this screen render scope identically.
- No server-function, schema, or commit-logic changes: same `saveProjectBrief` / `enrichProjectBrief` / `commitProjectBrief` calls, same autosave and gating rules.
- Coverage state is derived client-side from `brief_scope`, no new fields.
- Fixes existing `btn-*` contract violations in this file as part of the pass.
