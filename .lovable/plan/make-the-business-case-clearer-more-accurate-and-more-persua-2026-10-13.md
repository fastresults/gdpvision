# Make the business case clearer, more accurate and more persuasive

## Recommendation
Lead with **economic value**, as selected: better policy choices, stronger investment preparation and more accountable delivery. Then explain how GDPVision supports that work, what evidence underpins the case and how government can test it before committing.

The strongest argument is not “AI is dangerous, so buy GDPVision.” It is:

**Bring the evidence together → compare the choices → approve action → track delivery → retain what government learns.**

Keep the authoritative decision-paper character, but make it understandable on first reading. Persuasion should come from concrete value and credible proof—not fear, jargon or absolute promises.

## What the audit found
- The opening asks whether government should procure GDPVision before making its economic value clear.
- The explanation of GDPVision and its ten Chambers appears after six numbered sections, including repeated arguments about personal AI use.
- Some claims exceed their supporting wording: “CBI is ending,” “70% of tertiary-educated citizens have emigrated,” and an eighteen-month data lag are presented too broadly or without a traceable, matching source.
- Dominica’s **226%** figure refers to hurricane **damage and losses relative to GDP**, not GDP output “lost in a single night.”
- The AI comparison uses blanket “No” answers and incorrectly says personal chats disappear when closed. Enterprise tools and personal chat accounts must not be treated as the same thing.
- Ownership, escrow, isolation, reproducibility and immutable logs are presented as unconditional assurances. The page needs to distinguish implemented capabilities, proposed deployment arrangements and terms government must agree and verify.
- The existing distinction between potential value and measured outcomes is valuable and should remain prominent.

## 1. Reframe the opening and summary
Proposed eyebrow: **The business case for GDPVision**

Proposed headline: **Better national decisions. Stronger economic progress.**

Proposed introduction:

> GDPVision connects national evidence, policy choices and government delivery in one system. It helps Cabinet and ministries direct resources, prepare investment and keep action accountable—with sources they can check and decisions that remain in government hands.

Make the summary answer five questions quickly:
1. What problem does government face?
2. What does GDPVision help it do differently?
3. Where could economic value come from?
4. What must still be tested or agreed?
5. What is the sensible next step?

Use a short, visible qualification: **Potential value is not a proven result. Test the case against your country’s evidence and one real decision.**

## 2. Give the argument a clearer reading order
Bring the current “What GDPVision is” and “What this is worth” material forward, before the extended AI and procurement discussion. Reuse existing sections and artwork rather than adding a new page design.

The revised story should follow:
1. **The economic decision:** why stronger evidence and delivery matter.
2. **The pressures:** properly scoped, sourced national and regional examples.
3. **The working system:** a shared national evidence library and ten connected government workspaces.
4. **The practical value:** better resource allocation, investment preparation, risk assessment, coordination and institutional memory.
5. **The standard government needs:** sources, access controls, repeatable calculations where supported, approval and continuity.
6. **The alternatives and trade-offs:** personal AI assistance, internal development and procuring GDPVision.
7. **The decision to proceed:** responsibilities, risks, a bounded pilot and clear acceptance tests.

Keep useful depth, but remove repeated passages across the summary, personal-AI discussion, comparison, approvals and conclusion. Renumber sections after reordering; do not add unrelated functionality.

## 3. Rewrite every visible layer of copy
Cover the title, summary, section headings, introductions, figure labels and notes, comparison rows, all ten Chamber descriptions, benefits, options, approvals, risks, pilot stages, seven questions, sources and closing invitation.

Use one practical point per paragraph: **problem → action → government value**. Replace phrases such as “tier-one,” “instrumentation,” “sovereignty gate,” “replacement book” and “recurring expenditure that leaves a residue” with everyday language.

Define **Chambers** immediately as connected digital workspaces for government responsibilities. Explain the **Second Brain** as the connected national evidence library, linking it to decisions rather than assuming visitors understand the name.

Illustrative benefit headings:
- **Put public resources where they can deliver more.**
- **Prepare investment proposals with fewer unanswered questions.**
- **Compare risks before government commits.**
- **Keep ministries working toward the same priorities.**
- **Preserve the evidence and decisions beyond a change of personnel.**

Describe these as pathways to value, not savings, investment secured or growth already achieved. Remove unsupported “hours rather than days” claims and avoid promising that all projections or AI answers are identical.

## 4. Repair accuracy and make evidence easier to inspect
- Keep only quantitative examples that can be matched to a specific source, country or group, year and definition. Remove or replace an unverified figure rather than retaining a confident badge beside it.
- Correct the hurricane label to **damage and losses equivalent to 226% of Dominica’s 2016 GDP**, with the 2017 assessment linked.
- Do not describe a CBI closure as settled law. Use carefully sourced wording about external pressure and revenue exposure; include a deadline only if its status and authoritative source can be verified.
- Verify the exact basis for the 50% revenue, 90% debt, 25% interest, 70% emigration and eighteen-month lag claims. Otherwise replace them with non-numeric, qualified descriptions. Do not use historical upper-band figures as current regional averages.
- Describe OECD Steering Group representation accurately; membership, seats and voting rights are not interchangeable. Retain it only if it materially strengthens the economic argument.
- Add clickable primary-source links and country/year qualifiers at the point of use and in the sources list. Briefly explain confidence grades beside the first figures, not only at the bottom.
- Apply the same corrections wherever the claims recur, so the summary, figure notes and closing argument agree.

## 5. Make comparison and procurement claims credible
Narrow the comparison to **personal AI use without a government workflow**. Acknowledge its legitimate drafting and research value. Explain that enterprise AI tools can provide controls but still require integration with government evidence, methods and delivery processes.

Give every option an honest benefit and limitation. Procuring GDPVision also carries costs, adoption demands and supplier/deployment risks; building internally can retain capability but requires sustained staffing and maintenance.

Frame the five approval areas as **responsibilities to satisfy**, not a universal legal rule that exactly five officials must approve. Local procurement and data-protection requirements determine the actual process.

Present export, escrow, hosting, ownership, security testing and continuity as terms to specify and verify for the deployment—not proof of already-executed national contracts. Preserve documented safeguards without inventing new ones.

## 6. End with a concrete, proportionate next step
Invite one real Cabinet or ministry decision to a briefing. Recommend a time-limited pilot with agreed evidence, users, responsibilities and acceptance tests before national deployment.

Make the seven questions readable and fair: inspect the source, repeat a supported calculation, check permissions and available audit history, trace a decision to its owner, confirm custody, inspect exit terms and identify accountability. Do not imply read-access logging or other capabilities are available until verified.

Keep the existing briefing and Decision Brief links. Refine the estimate invitation to explain assumptions, costs and uncertainty without changing its calculations. Retain approved company provenance; do not invent delivery results or response-time promises.

## Technical scope
- Copy source: `src/lib/business-case.ts`.
- Presentation, section order, source links and page metadata: `src/routes/business-case.tsx`.
- Verify claims against the relevant existing implementations and documentation before preserving them as present capabilities.
- Preserve current illustrations, the opening ring, semantic styling, mobile comparison view and navigation.
- No calculator changes, new imagery, backend changes, permissions changes or publishing.

## Verification
- Read the entire page in its new order as a first-time government visitor: every section should advance the argument.
- Check all quantitative claims, repeated references and links against their actual evidence; unsupported claims must be removed or qualified.
- Confirm modeled estimates, implemented features and proposed contractual terms remain clearly distinct.
- Check desktop and phone text wrapping, comparison readability, heading order and links.
- Confirm the Decision Brief and briefing entry points still work and the preview has no errors.