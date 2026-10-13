# Streamline both GDPVision decision presentations

## Recommendation
Create one coherent, agency-grade experience: **a clear national story, a focused example, and depth available when wanted.** Keep the intricate decision animations, but stop making visitors read several competing explanations at once.

The first viewing should make five things clear: **what information comes in, how it is checked and protected, which Chamber helps, who decides, and what government can deliver.**

## What the review confirmed
- The supplied Chamber screenshot repeats the question across the page and scene, uses many tiny uppercase labels, and shows future information so faintly that it looks unavailable rather than forthcoming. `InquiryDesk` explicitly renders pending fields at 35% opacity and its decision panel at 20%.
- The Chamber browser contains featured examples, a numbered Chamber grid, and another scenario list competing for attention. Chamber buttons use unsorted object keys; the screenshot shows 10 before 01.
- The six phase buttons have long labels and a minimum width of 150px each, putting pressure on the available animation width.
- The national map’s “All” selection suppresses the scenario list. Its guide explains all five stages at once rather than highlighting the stage currently unfolding.
- Chamber “Next” is disabled throughout the final phase, even when more beats remain. “Replay” restarts only the current phase despite its general label.

The live browser review did not complete both flows reliably. These findings are grounded in the supplied image and inspected source; full live verification is part of implementation.

## 1. Establish a concise editorial hierarchy
Keep the two familiar entry points, **Data & Decision Flow** and **By Chamber**. Inside the modal, use shorter, complementary openings:

**National system**
- Title: **How GDPVision connects evidence to government action.**
- Subtitle: **Bring national information together, compare policy and investment choices, and turn approved decisions into accountable delivery.**

**By Chamber**
- Title: **See a national priority become a government decision.**
- Subtitle: **Follow a real-world example through a Chamber—a connected government workspace—from checked evidence to choices, approval and action.**

Use the scenario question once as the main heading. Within scenes, use short action headings and new information rather than repeating that question or the Chamber’s full name.

Shorten the six phase labels without changing their sequence:
**The priority → Frame the question → Check the evidence → Select the Chamber → Work through options → Government value.**

## 2. Replace selection clutter with one priority browser
- Retain a small recommended starting example, not a six-card featured wall.
- Place Chambers in explicit 01–10 order, with recognisable purpose names available alongside the numbers.
- Show the selected Chamber’s five scenarios in one compact list: a short title and a concise question, with one unmistakable selected state.
- Selecting a Chamber selects its first scenario, keeping the browser and main presentation aligned; selecting a scenario starts that example.
- Keep all 50 scenarios reachable. In the national map, “All” offers a compact example picker rather than an absent list; do not render 50 large cards above the diagram.
- Keep the desktop browser independently scrollable so exploring choices does not push the animation below the visible area.

## 3. Give the animation a consistent visual grammar
Retain the paper, ink, gold and engraved visual identity; polish it rather than introducing a new theme.

- Use a stable sequence across scenes: **incoming evidence → work/checks → decision or action**.
- Keep meaningful text readable at every beat. Pending elements use clear outlines and short labels, not barely visible paragraphs. Completed evidence stays readable while the current action receives a restrained gold accent.
- Prefer purposeful document movement, connecting lines, check marks and approval gates to extra frames, ornament or repeated numbering.
- Remove unnecessary nested boxes. Use borders for actual evidence items and decision outputs, with unframed headings and explanations around them.
- Use sentence case for substantive text; reserve small uppercase type for brief metadata. Increase essential scene copy, align baselines, and standardise spacing and control sizes.
- Keep country context, sensitive-data boundaries, human approval and named responsibility explicit. Do not imply an approval has happened before its illustrated check is complete.

## 4. Make depth easier to follow, not shallower
- Keep all six phases and the five detailed working stages per Chamber.
- In each working stage, lead with one finding and the next decision. Supporting sources, checks and ownership appear in a consistent secondary position; longer material goes into expandable detail without disappearing from the experience.
- During Chamber selection, show why the chosen workspace fits the priority and what the other workspaces contribute. Avoid suggesting every scenario must follow the same route or that all ten Chambers are mandatory.
- Finish with scenario-specific government value: better-informed choices, risks addressed, investment preparation, responsible delivery and progress to track—not a generic promise of GDP growth.

## 5. Make the right-edge guide part of the story
- Preserve the guide’s far-right dock, expanded default, collapsible control and maximum 30% desktop viewport width. No floating gap or overlay on the diagram.
- Keep the five-stage national overview concise and visibly highlight the current stage.
- Add a brief current-step explanation tied to the actual animated route: **what is happening and why it matters**.
- Keep selected-node detail available in the same tray, with an obvious return to the running story and no loss of progress.
- On narrow screens, retain a readable stacked guide instead of squeezing it into a thin side column.

## 6. Polish pace and presenter controls
- Show a readable map structure immediately; shorten decorative introduction delays without accelerating text beyond comfortable reading time.
- Synchronise route movement, destination highlights and captions so the same action is communicated together.
- Use one compact playback strip with previous/next arrows, play/pause, replay and progress. Give icon controls accessible names and tooltips.
- Make Next/Previous traverse every beat, including the final phase. Replay clearly restarts the whole example; any phase replay must be separately named.
- Manual phase selection pauses on that phase so visitors can read it. Preserve click-to-pause/resume and reliable playback after changing examples.
- Respect reduced motion with complete readable scenes and working manual navigation. Avoid unnecessary scene remounts and layout-changing animations.

## Technical scope
Presentation-only changes to the shared dialog, national map, Chamber browser, journey scenes/primitives, display-copy sources and relevant shared CSS. Shared improvements also apply to `/present`.

Keep scenario identifiers, title lookup keys, route edges and profile mappings stable; add display labels where wording changes. Derive guide context from the current stage and route nodes, not parsed captions. Use existing semantic tokens and button utilities; preserve registered explanations for illustrative figures.

No database, permissions, research, calculations, homepage Chamber cards or unrelated briefing sections change. No publishing in this task.

## Verification and acceptance
- Check every Chamber and scenario for complete content, intact route mappings, five working stages and specific qualified benefits.
- Exercise shock, investment, digital-service and accountability examples from selection to the final decision/value scene; inspect all six phases and each Chamber’s detailed stages.
- Verify ordered Chamber selection, browser/main-story agreement, all final-phase beats, whole-example replay, pause/resume, tray collapse and return from selected-node detail.
- Review desktop, short laptop and phone views for legible text, visible controls, no clipping/overlap and no whole-page horizontal scrolling. Verify both reused presentations in `/present`.
- Check reduced motion, keyboard focus, accessible selected states and readable contrast; confirm the preview has no current build or runtime errors.
- First-view acceptance: the opening clearly defines Chambers, the selected priority is unambiguous, each scene has one dominant action, and the ending identifies government’s next decision and practical value.