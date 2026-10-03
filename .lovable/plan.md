# Run the Tourism Ideal Minister end to end, then accuracy-check the 50 personas

## Where the admin UI is (the answer to the question)

- Board: `Admin → Countries → Antigua & Barbuda → Persona Lab → Ministers track` — URL `/admin/countries/ATG/personas/portfolios`. Every portfolio is one card; Tourism and Aviation (TOUR) sits in the First wave row.
- The run itself: each card shows Regional status and a "Cast 50 personas" button; once a run exists the card links to `/admin/countries/ATG/personas/portfolios/<setId>` where the right rail has the Run/Stop controls and tabs for The cast, Skills, The Ideal Minister and Convene.
- Nothing has been run yet: `portfolio_persona_sets` is empty, so this starts from zero. The run needs the AI gateway key (present) and, if `PERPLEXITY_API_KEY` is absent, the cited-research pass is skipped and the gap is recorded on the run — profiles then ground in the corpus alone.

## Plan

1. **Sign in and check access.** Restore the injected session in the browser preview, open the board, and confirm the account can start regional runs (`writeRegional`). If it cannot, stop and report before spending anything.
2. **Start the Tourism run.** On the board, press "Cast 50 personas" on Tourism and Aviation. This creates a regional draft set at 50 personas.
3. **Keep the run going.** The run only progresses while the set page is open: the page calls one server tick after another (scope → matrix → generate 50 personas in batches of 5 → QA → aggregate → synthesise). A Playwright session holds the page open in the background until `done`, polling the run rail. Expect roughly 30–90 minutes of AI calls; if anything interrupts it, the stored phase is where it resumes — re-open the page and press Run again. If a tick fails, record the error, fix nothing silently, and report.
4. **Read all 50 personas.** When the run reaches `done`, read the 50 persona rows and the synthesis from the database (not just the UI) — full text of each: bio, values, skills, decision model entries, and the QA verdicts.
5. **Accuracy check.** For every persona, judge:
   - Grounding — does it plausibly reflect real Caribbean tourism/aviation office-holding backgrounds, ministry mandates and the cited research the run collected?
   - Composite discipline — no persona may be a portrait of a named real person.
   - Variety — no clone pairs; the design matrix axes should be visibly populated.
   - Coherence — skills must come from the 67-skill taxonomy and support the claimed decision model.
   Report the findings per slot (numbered 1–50) with concrete examples, plus an overall verdict on whether the profile is fit to submit for approval.
6. **Leave it as draft.** No approval, no code changes. The report tells you where to approve when you are ready: the Approval bar on the set page.

## Technical notes

- Tables read/written: `portfolio_persona_sets`, `portfolio_personas`, `portfolio_persona_syntheses` (created by migration 0028, already applied). No schema changes.
- The run is driven client-side by `useRunLoop` calling `runPortfolioTick`; each tick does one AI-gateway batch, so 50 personas ≈ 10 generate ticks plus QA batches. Usage is billed per Lovable AI request from workspace credits.
- Cost check before starting: one run is roughly 15–25 gateway calls. I will report if the gateway returns a credit or availability error and stop rather than retry.
- The accuracy report is chat output (plus, if useful, saved to Files as a markdown file).
