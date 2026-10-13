# Polish both homepage decision presentations

## Recommendation
Treat both presentations as one clear government story—not a technical tour of software:

**Understand your country → compare choices → approve action → deliver results → learn what works.**

Lead with the economic decision a minister recognises. Explain what GDPVision does with the evidence, what the leader can now decide, who remains responsible and why it matters for the economy.

Keep the depth and intricate motion, but make every caption understandable on first reading. Confident language should come from practical value—not academic vocabulary or promises of automatic GDP growth.

## 1. Give the modal a clear opening
Proposed shared eyebrow: **GDPVision · Evidence into action**

### National flow
**Title:** How government turns national evidence into economic progress.

**Subtitle:** See how GDPVision brings information together, protects sensitive records and helps government choose, approve and deliver action—with a clear record of who is responsible.

### By Chamber
**Title:** See how GDPVision helps government tackle a real national priority.

**Subtitle:** Choose a situation facing government. Follow it into a Chamber—a connected digital workspace—and see the evidence, options and actions it brings together for Cabinet and ministries.

Keep the familiar homepage entry names **Data & Decision Flow** and **By Chamber**, but simplify their supporting captions to **From national evidence to government action** and **See a national priority worked through**.

## 2. Rewrite the complete national flow
Cover the five map headings, node names, descriptions, connections, scenario questions, moving captions, outcomes, detail panels, reading sidebar, tabs and accessible labels.

Suggested five headings:
1. Gather the information
2. Connect and protect it
3. Work through the choices
4. Approve and assign action
5. Track results and improve

Explain the Second Brain as **the connected national evidence library** on first mention. Define Chambers as workspaces and the Sovereign Vault as protected government data storage, retaining official names where useful.

Replace routing jargon with meaningful action. For example:

> “Corpus → Citations & grades: each input is sourced and graded.”

becomes:

> “Check where each figure comes from and how reliable it is.”

The animated route remains unchanged; the caption explains the work rather than merely naming the boxes.

## 3. Rewrite the complete Chamber journey
Keep the six-phase sequence, with clearer phase names:
1. The national priority
2. Ask the right question
3. Bring the evidence together
4. Choose the right workspace
5. Work through the decision
6. Value for government and the economy

For all ten Chambers and all 50 scenarios, polish the questions, supporting explanations, five working stages, source labels, checks, approval labels, decision summaries and benefits.

### Make each working stage answer four questions
- **What needs to be decided?**
- **What does the evidence show?**
- **What must be checked, and who approves?**
- **What action or decision comes next?**

Replace terms such as “executive dividend register,” “governed evidence,” “qualified GDP pathway” and “growth levers” with direct language: **Value for government**, **checked evidence**, **How this supports economic progress**, and **actions that can support growth**.

### Make the five benefits practical and scenario-specific
- A clearer picture of the problem
- Better-informed choices
- Risks identified before commitment
- Clear responsibility for delivery
- Progress government can track

Describe concrete economic value where supported: better use of public money, stronger investment preparation, fewer avoidable delays, coordinated ministries and clearer accountability. Avoid repeating the same generic growth promise across every journey.

## 4. Polish how the animation communicates
- Match each caption to the action visible at that moment.
- Use a short action heading plus a concise explanation; remove competing labels and repeated copy.
- Make essential text readable and allow wrapping instead of hiding its meaning behind ellipses.
- Review reading time after rewriting; adjust text holds only where needed so ministers can follow the argument without rushing.
- Preserve the diagram routes, detailed motion, scenario selection, click-to-pause/resume, replay, previous/next controls, independent desktop sidebar scrolling and reduced-motion behaviour.
- No new visual effects or structural redesign in this pass.

## 5. Preserve credibility and government authority
- Keep sources, reliability checks, sensitive-data boundaries, human approval and named responsibility explicit.
- Identify scenarios and time comparisons as illustrative—not measured results or promises.
- Explain economic terms where needed rather than stripping out their meaning.
- Replace claims such as “GDP up” or “GDP rises” with the conditions the action can improve; never imply the animation proves a growth forecast.
- Align Chamber names with the approved homepage wording, using compact but recognisable labels where space is limited.

## Technical scope
- Shared modal: `DataDecisionFlowDialog.tsx`.
- National map and scenario copy: `DataDecisionFlow.tsx`, `dataDecisionScenarios.ts`, `dataDecisionScenariosMore.ts`.
- Chamber script: `ChamberDecisionJourneys.tsx`, `chamberDecisionJourneys.ts`, `chamberJourneyExtras.ts`.
- Scene captions and derived wording: `journeys/*`, including `journeyRouting.ts` and `journeyVisuals.ts`.
- Plain-language explanations for illustrative figures: `src/lib/explain/journeys-entries.ts`.
- Preserve scenario identifiers, route edges, profile lookups and text-dependent matching when display titles change; review every dependent lookup to avoid breaking journeys.
- These animations are also used in `/present`; their shared copy will improve there too. Do not rewrite unrelated presentation sections or homepage cards.
- No changes to calculations, data connections, permissions, research or approval logic.

## Verification
- Review every scenario in both modes for clear questions, meaningful actions and qualified benefits.
- Confirm all 50 scenarios remain available, with five per Chamber, and all six Chamber phases have complete content.
- Run representative shock, investment, service-delivery and accountability journeys end to end; inspect every Chamber’s working and benefits phases.
- Check desktop and phone layouts for clipping, crowded labels and readable scene captions.
- Verify pause/resume, replay, step navigation, scenario switching and reduced motion.
- Check the reused animations in `/present` for fit and confirm the preview has no errors.