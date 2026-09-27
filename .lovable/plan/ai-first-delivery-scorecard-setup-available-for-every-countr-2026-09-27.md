# AI-first delivery scorecard setup, available for every country

## Goal
When a portfolio's **Set up KPIs** link is clicked, a guided setup window opens on the Portfolio page. It works for every country. AI drafts each ministry's scorecard from the country's own data, and people review and approve it. The window replaces the current jump to the Mandate studio form.

## User experience: the setup window (right-side panel, 5 steps)

1. **Context:** Shows what we already know about the ministry: its minister, the sectors it covers, its share of GDP, the country's figures linked to those sectors, the national plan or mandate commitments, and any existing KPIs. It also flags gaps (for example, "no targets on file").
2. **AI proposal:** One click ("Draft scorecard") produces 3 to 6 proposed KPIs. Each comes with its direction, baseline value and period, target and target date, the basis for the target (policy commitment, peer benchmark or scenario), tolerances, how often it is reported, and a cited source. Every number is checked against stored data, and anything the AI inferred is labelled **Inferred**. Caribbean peer medians are shown next to each proposal for context.
3. **Review and edit:** Accept, edit or reject each KPI. Required fields are highlighted, and a KPI cannot move forward until the qualification checklist passes. An **Explain** button next to each figure shows how it was calculated.
4. **Actuals:** Latest readings are pre-filled from the country's data where they exist. Missing ones can be entered with evidence.
5. **Submit for qualification:** Saves the KPIs as drafts and sends them to the back office queue. A second authorised person must approve them. A ministry can use one-person approval only if the existing global-admin exception applies.

The window keeps your progress, so you can close it and pick up later. It works on phones too (it opens as a full-height sheet).

## Back office: the qualification queue (all countries)
- A new **Delivery scorecards** tool in the admin area lists every country and ministry, with these states: Not started / AI drafted / In review / Qualified / Stale.
- Reviewers see a before-and-after comparison, the sources, and the checklist. They can approve, send back with a note, or reject. Every action is recorded in the existing audit history.
- **Coverage view:** shows what share of each country's GDP exposure has qualified KPIs. This drives the "measurement readiness" ranking.
- **Monthly upkeep:** added to the existing first-of-month refresh. It flags KPIs whose actuals are overdue for their reporting cycle (they switch to Stale/Unscored), pre-fills new readings from updated country data, and adds a "needs attention" item to the queue.
- **Bulk bootstrap:** admins can run "Draft scorecards for all ministries" for a whole country. This only creates drafts; nothing is qualified automatically.

## Guardrails
- The AI never qualifies anything. Only people can move a KPI from draft to qualified.
- Every proposed figure must match stored data or carry a source link, or it is marked Inferred and cannot be approved until someone confirms it.
- Proposals are deduplicated per ministry and indicator, so running the AI again updates existing drafts instead of adding duplicates.

## Technical details
- Additive migration:
  - Table `kpi_setup_sessions` (country, ministry, step, draft payload in jsonb, status, created_by) with grants, row-level security via `has_country_access`, and admin policies.
  - Columns `source` (manual/ai), `ai_rationale`, `peer_median` and `review_note` added to `kpis`.
  - A unique key on (country, ministry, normalized indicator).
- `src/lib/portfolio/scorecard-setup.functions.ts`:
  - `getSetupContext` assembles the country's KPIs, sectors, ministry profile, mandate items and peer benchmarks.
  - `draftScorecard` uses the AI SDK with a Responses stream on `openai/gpt-6-astra` and a small schema, followed by the existing repair and number-check pattern.
  - `saveSetupSession` and `submitForQualification`.
- `src/lib/portfolio/scorecard-queue.functions.ts`: list, approve and return. It reuses the `qualifyKpi` rules.
- UI:
  - `src/components/portfolio/KpiSetupModal.tsx`, opened from the "Set up KPIs" link on the Portfolio index and ministry pages. The link carries a `?setup=<ministry>` parameter so the window's open state is kept in the page address.
  - New route `admin/scorecards` for the back office queue, with a link from the admin navigation and the country row.
- The monthly cron gets a staleness and pre-fill pass.
- Explain rationales are registered for proposals, coverage and staleness.
- Docs: update the chamber map, then run `bun run headers && bun run map`.

## Validation
Run the Antigua flow end to end: open the window, have AI draft KPIs, edit one, submit, approve as a second admin, and confirm the Portfolio counts change from Unscored to scored. Confirm a second country works too. Also run the type checks and map checks.
