# Clear economic value across all ten Chambers

## Recommended approach

Rewrite each card as a concise business case for the Prime Minister and Cabinet:

1. **Benefit headline:** one direct, empowering economic outcome.
2. **Chamber name:** a plain name that makes its purpose immediately recognisable.
3. **Description:** how the Chamber helps government make or deliver a better decision, without repeating the headline.
4. **Two bullets:** concrete actions and outputs, retaining the relevant evidence, approval and accountability safeguards.

Use confident language about what government can do—not promises of guaranteed GDP growth, investment, policy acceptance or savings. Keep each card to roughly 45–65 words excluding its number and name.

## Proposed copy

### Chamber 01 — National Evidence Ledger
**Put trusted evidence behind every economic decision.**

Bring national and sector data into one sourced record so Cabinet can assess the economy and direct resources with confidence.

- Compare trends, sources and evidence strength before setting priorities.
- Build briefings that link every key figure to its supporting evidence.

### Chamber 02 — Ministry Growth & Delivery
**Give every minister a clear role in growth.**

Connect each ministry’s responsibilities to economic priorities, sector dependencies and delivery measures so government can coordinate action.

- Identify where ministry decisions influence growth and other portfolios.
- Carry options into Cabinet review with clear measures of progress.

### Chamber 03 — Policy Scenario Engine
**Understand the trade-offs before committing public resources.**

Compare policy choices and their modelled economic effects so Cabinet can choose a course with its costs, risks and assumptions visible.

- Test effects on GDP, debt, foreign exchange and the budget.
- Compare policy combinations against Cabinet’s objectives and stated assumptions.

### Chamber 04 — Investment & Resilience Studio
**Build investment alternatives to vulnerable national revenue.**

Assess exposed income and prepare investment propositions that support a more resilient economy, with practical barriers identified before commitments are made.

- Estimate revenue gaps and the time available to respond.
- Test investment readiness across land, law, skills, incentives and institutions.

### Chamber 05 — National Confidence & Communications
**Protect national confidence with a credible public position.**

Turn emerging developments into evidence-backed briefings so government can respond clearly when uncertainty threatens investment, confidence or growth.

- Assemble relevant events, sources and prior government knowledge.
- Prepare responses for authorised review and approval before release.

### Chamber 06 — Cabinet Decisions & Delivery
**Make every Cabinet decision an accountable commitment.**

Connect the decision to its owner, conditions and delivery record so ministers can track progress and intervene where action stalls.

- Compare options and record decisions, responsibilities and conditions.
- Track commitments and identify issues requiring Cabinet attention.

### Chamber 07 — Policy & Leadership Persona Lab
**Anticipate concerns before putting policy into practice.**

Explore how different audiences may respond and what leadership requires, helping government refine proposals before committing to implementation.

- Run evidence-grounded simulations for citizens, diaspora and investors.
- Examine ministerial skills and policy concerns; simulated findings are not public opinion polls.

### Chamber 08 — Mandate Delivery & Accountability
**Turn public promises into measurable government delivery.**

Translate the mandate into ministry-owned commitments so government can review progress, explain changes and demonstrate what has been delivered.

- Give each pledge clear deliverables, measures, owners and review dates.
- Keep approvals, evidence and quarterly progress in one accountable record.

### Chamber 09 — Digital Government Planning Studio
**Define better public services on government’s terms.**

Turn national needs and verified government information into a clear digital-service blueprint, giving government control over scope, evidence and approval.

- Specify services, audiences, institutions and governance using cited requirements.
- Approve information before sharing it through authorised digital connections.

### Chamber 10 — Sector Growth & Delivery Studio
**Focus national effort on sectors with growth potential.**

Use national evidence to select priorities and build accountable sector plans, connecting economic ambition to practical action and Cabinet oversight.

- Compare sector opportunities while preserving the Head of Government’s choice.
- Develop cited plans with milestones, responsibilities and approval before Cabinet commitment.

## Scope and presentation

- Apply the revised names, benefit headlines, descriptions and bullets to all ten homepage cards.
- Preserve the current numeric order, colours, vertical rules, screenshots, layout and interactions.
- Do not alter internal Chamber names, navigation, decision logic, permissions or data.
- Shared public Chamber descriptions also serve op-ed pages; check those pages for appropriate wording and fit.
- Leave the country selector and combined value estimate unchanged.

## Technical details

- Update the shared public copy in `src/lib/chambers.ts`; retain stable Chamber indices and existing fields.
- Check each claim against the relevant Chamber implementation before finalising wording, especially simulated Persona Lab findings, modelled scenario effects and Digital Government planning versus service deployment.
- Avoid adding quantitative or near-live claims without supporting evidence.
- No database changes or new routes are required.

## Verification

- Read all ten cards together to remove repetition and keep each economic role distinct.
- Check desktop and phone layouts for clean wrapping and consistent card readability.
- Confirm screenshots, order, colours, country selection and existing interactions remain unchanged.
- Check preview errors and affected shared-copy pages before reporting completion; publishing is not included.