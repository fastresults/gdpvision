# Chamber names and purpose on hover

## Recommended approach
Keep the compact **All / 01–10** controls. Show a polished tooltip above each control on mouse hover or keyboard focus: **Chamber number and name**, followed by **one plain-language sentence explaining its purpose**. No extra examples or long paragraphs.

The existing row filters and restarts the selected scenario. Hovering should only explain the Chamber—not change selection, pause playback or restart the animation.

## Proposed tooltip copy
| Control | Name | Purpose |
|---|---|---|
| All | All ten Chambers | See how the ten connected government workspaces bring evidence, decisions and delivery together. |
| 01 | National Evidence Ledger | Bring national figures and their sources together so government decisions start with reliable evidence. |
| 02 | Ministry Growth & Delivery | Connect each ministry’s responsibilities to economic priorities and track delivery. |
| 03 | Policy Scenario Engine | Compare potential costs, benefits and risks before committing to a policy. |
| 04 | Investment & Resilience | Assess investment choices and prepare for shocks that could threaten economic progress. |
| 05 | Confidence & Communications | Spot important media signals and prepare clear, evidence-backed government responses. |
| 06 | Cabinet Decisions & Delivery | Turn Cabinet decisions into commitments with clear owners and progress tracking. |
| 07 | Policy & Leadership Lab | Explore how different groups and leadership perspectives may respond to policy choices. |
| 08 | Mandate & Accountability | Connect government promises to delivery milestones and accountable progress. |
| 09 | Digital Government Planning | Plan public websites and services using national evidence and government approval. |
| 10 | Sector Growth & Delivery | Turn sector opportunities into practical plans with priorities, responsibilities and measures of progress. |

## Presentation and interaction
- Use a compact, high-contrast tooltip, approximately 280–320px wide, with a clear heading and readable body text.
- Open after a short hover delay; position above the control by default and reposition only when necessary to avoid screen-edge clipping.
- Display outside the scrolling row so the explanation cannot be cut off or shift the layout.
- Keyboard focus also reveals it; Escape dismisses it. Retain descriptive control labels for screen readers.
- On touch screens, tapping still selects the Chamber. Show the same brief description beneath the controls for the selected Chamber rather than requiring hover or adding a second tap.

## Technical scope
- Update the shared `DataDecisionFlow` filter row using the existing tooltip components, so the explanation appears wherever this national-flow view is used.
- Keep names aligned with `CHAMBER_NAMES`; store the static purpose sentences alongside the presentation data.
- Preserve filter order, selected styling, scenario keys, routing and playback behavior. No database or data-access changes.

## Verification
Check all eleven descriptions, above-control placement and edge repositioning, keyboard focus/Escape, unchanged click-to-filter behavior, and touch selection with readable descriptions. Verify the tooltips remain visible inside both the homepage dialog and the `/present` flow view.