# Make the Sovereign Vault’s government value clearer

## Recommendation
Present the Vault as more than protected storage: **government-controlled evidence that helps leaders act sooner, compete more effectively for investment and sustain progress.**

Keep the opening animation, as requested. Refine the language and add six coordinated pen-and-hatch illustrations to the substantive sections below it. Retain the page’s restrained editorial character rather than redesigning it as a collection of cards.

## 1. Lead with national value, then explain the protection
Keep **The Sovereign Vault** prominent in the opening. Proposed supporting headline:

**Put your country’s data to work. Keep government in control.**

Proposed introduction:

> Bring sensitive national records and public evidence together on government premises. Give Cabinet and ministries a stronger basis for policy, investment and delivery—so your country can act sooner, strengthen its regional position and build economic progress that lasts. Private records stay protected; officials approve what may be shared.

Use regional competitiveness as an undertone throughout, not a claim of guaranteed superiority. Describe faster, better-informed action as a way to support growth—not a promised growth rate.

## 2. Give every section a practical government outcome
Rewrite headings, supporting paragraphs, rule labels and workflow descriptions around these messages:

| Section | Proposed heading | Value to convey |
|---|---|---|
| What arrives | **A secure foundation for better national decisions.** | Explain the in-country system in plain language, then why previously isolated records become useful to government. |
| Three rules | **Use more evidence. Share only what government approves.** | Clearly distinguish incoming public evidence, private records kept inside and approved combined findings released. |
| Economic value | **Act sooner. Invest more wisely. Build progress that lasts.** | Show practical questions: where spending is working, what is delaying investment and which sectors need coordinated action. Connect stronger evidence to more defensible decisions and durable delivery. |
| Security | **Protect national trust—and the freedom to act.** | Keep government custody, local analysis, approval responsibilities and inspectable safeguards explicit. |
| Managed from GDPVision | **One clear process—from question to approved finding.** | Explain the register, request, review and release sequence as the work of officials, not technical machinery. |
| Briefing | **Start with the decision your government needs to make.** | Invite a concrete ministry or Cabinet priority; preserve the existing briefing form and submission behaviour. |

Keep the hardware footnote factual and unobtrusive. Avoid unsupported time savings, automatic evidence-grade upgrades or new security assurances. Deployment-specific claims should be qualified rather than strengthened without evidence.

## 3. Create a cohesive set of six detailed illustrations
Use monochrome graphite and black pen on white, fine cross-hatching, technical detail and generous negative space. No embedded text, stock imagery, colour accents or decorative growth arrows.

| Section | Illustration concept | Placement |
|---|---|---|
| What arrives | A compact government data room: secure computing appliance, organised archive and backup equipment. | Left-side companion beneath the heading, outside the prose column. |
| Three rules | A cutaway secure archive with public documents arriving and a separate checked report passing a controlled release gate. | Wide but contained engraved divider between introduction and the three rules. |
| Economic value | Evidence ledgers and a surveyor’s instruments overlooking a working harbour and infrastructure foundations. | Right-side companion; substantial enough to inspect without competing with the copy. |
| Security | A vault-door cutaway with separate keys and a bound audit register. | Left-side companion beside the safeguard list. |
| Managed from GDPVision | A detailed official workbench showing a dataset register, analysis file, two approval seals and a released report. | Right-side companion beside the introduction; keep the four workflow steps together below. |
| Briefing | An open national planning folio with a regional map, evidence papers and a drafting instrument. | Small left-side companion below the invitation; never inside or behind the form. |

These drawings explain the section’s idea; they are not hardware specifications, actual screens or proof of a security certification.

## 4. Compose the page professionally
- Preserve the opening animation and its existing interactions; do not add another competing image there.
- Use one illustration per section, alternating side placements with a contained divider for the three rules.
- Keep consistent section spacing, aligned headings and comfortable reading widths. Use existing paper, ink, gold and separator treatments.
- Prefer readable `spot` and `aside` sizes over tiny decorative marks; use the established `rule` size for the divider.
- Stack text and artwork cleanly on phones, preserving the reading order and keeping the briefing form easy to reach.
- Keep the artwork out of the text column; no full-bleed slabs, nested cards, new animation effects or text over drawings.

## Technical scope
- Refine copy and layouts in `src/routes/vault.tsx`; update its existing page title and social descriptions to match the value-led message.
- Generate six new assets and store their asset pointers in `src/assets/illustrations/`; render them through the existing `Illustration` component and its approved variants.
- Preserve `SovereignDecisionCircuit`, existing links and `BriefingForm` behaviour. No changes to data handling, access rules, AI models or security implementation.

## Verification
- Review every section for plain minister-friendly language, distinct government value and qualified economic claims.
- Check all six drawings for consistent engraved style, relevant subject matter and readable detail at their displayed size.
- Inspect desktop, tablet and phone layouts for alignment, clipping, overflow and excessive blank space.
- Confirm the opening animation and its pause/reduced-motion behaviour remain intact; verify links and the existing form remain usable.
- Confirm the preview has no errors. Do not publish in this task.