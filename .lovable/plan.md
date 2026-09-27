# Sector Plan visual summary

## Recommended experience

Add a full-width **Plan at a glance** band immediately below the title and actions, before the existing section editor. It becomes the executive visual abstract of the completed plan while preserving the current section navigation, narrative, and approval panel.

```text
PLAN AT A GLANCE
┌──────────────────────────────────────┬─────────────────────────┐
│ Target trajectory                    │ Plan readiness          │
│ Baseline → Year 3 → Year 5 → Year 10│ radial integrity gauge  │
├───────────────────┬──────────────────┼─────────────────────────┤
│ Delivery portfolio│ Roadmap          │ Evidence / gaps         │
│ projects + flagship│ phased timeline │ confidence composition  │
└───────────────────┴──────────────────┴─────────────────────────┘
```

### 1. Target trajectory — the dominant visual
- Plot the three outcome measures from the **Ambition** section from baseline through Years 3, 5, and 10.
- Use smooth lines with sector-colour gradients and a fill fading from solid to 30% opacity.
- Label endpoints directly; avoid a detached legend.
- If a baseline is not established, show a clearly differentiated open starting point rather than inventing a value.

### 2. Plan readiness — radial integrity gauge
- Show the share of required plan ingredients that are evidenced: drafted sections, current sections, cited sections, KPIs with baseline/source/owner, and projects with owner/funder/date/KPI.
- The centre states **Ready for review**, **Needs evidence**, or **Incomplete** rather than presenting a decorative percentage alone.
- Keep approval status adjacent, but leave the existing governed approval controls unchanged.

### 3. Delivery portfolio — compact project graphic
- Show project count, flagship, and project distribution by strategy pillar as a compact radial/bar composition.
- Separate confirmed projects from items still marked “to be confirmed.”
- Clicking a segment opens the Projects section.

### 4. Roadmap — phased achievement path
- Render the plan phases as a horizontal milestone path across its stated horizon.
- Feature the flagship, first policy move, first stocktake, and public scorecard as named milestones when present.
- Use **Planned achievement** until evidence records delivery; never label a proposal as achieved.

### 5. Evidence and gaps — confidence composition
- Show grounded, inferred/to-confirm, and gap proportions using a restrained stacked bar.
- Include citation count and Auditor findings so decision-makers can see how much of the visual summary is defensible.

## Interaction
- Hovering or focusing any measure for two seconds opens the platform’s centred **Executive perspective** panel.
- The panel explains the measure, source section, decision relevance, evidence strength, and any caution; moving to another measure replaces the content.
- Click or tap pins the perspective; Escape closes it. Every visual remains keyboard accessible and has a compact mobile arrangement.
- Clicking a chart element moves to the corresponding plan section without changing approval state.

## Data integrity
- Build the visual abstract only from the saved Diagnostic, Ambition, Pillars, Projects, Measurement, and Roadmap sections.
- Normalize targets, projects, phases, owners, dates, and evidence into a typed summary before rendering. Preserve the original section and citation reference for every item.
- Unsupported or ambiguous values render as **To be established** or **Needs confirmation**; no synthetic numbers are introduced.
- Recalculate the summary whenever a section is drafted or edited. Stale sections visibly mark their related visual as out of date.
- Register an **Explain this** rationale for every derived count, readiness value, and chart interpretation.

## Visual direction
- Preserve GDPVision’s current paper, ink, serif, mono-label, hairline, and sector-colour system.
- Use one restrained sector-colour gradient family, not a multicolour dashboard wall.
- Animate lines and milestones once on entry, with reduced-motion support; no continuous animation.
- Keep the band editorial and unboxed: one dominant trajectory with smaller supporting instruments, rather than nested cards.

## Technical scope
- Add a reusable Sector Plan summary normalizer and visual-summary component.
- Integrate it into the existing Sector Plan page without changing drafting, submission, approval, or database governance.
- Add sector-specific rationale entries and URL-addressable section jumps.
- Verify draft, incomplete, stale, submitted, and approved states on desktop and mobile, including hover/focus perspective behavior and missing-data fallbacks.
