
# Guided FDI Strategy Workbench

The workbench is powerful but silent. Users land on a wall of panels — Marimekko, Exposure Ledger, Actions Rail, Staging Timeline, Stress Test — with no narrative telling them "do this, then this, then this." The most damaging symptom is the empty Staging Timeline: it says "drop actions here" but there's nothing on screen to drag, and no explanation of what an action is or where it comes from.

The fix is a **guided workflow layer** on top of the existing panels — nothing changes about the underlying tool; we surface the tool's implicit steps as an explicit journey.

## The 4-step journey (surfaced in the UI)

```text
1. READ THE THREAT   →  2. RESHAPE THE MIX   →  3. STAGE THE ACTIONS   →  4. STRESS-TEST & COMMIT
   Briefing + chips     Marimekko + Ledger      Actions Rail → Timeline    Stress panel + Commit bar
```

Each step gets a numbered header, one sentence of plain-English guidance, and a "You are here" indicator that advances as the user completes it.

## Changes

### 1. `WorkbenchJourney` component (new)
A slim sticky sub-bar directly under the Threat Stepper showing the 4 steps above with:
- Step number, title, one-line "what to do" caption.
- Completion state derived from live data (has ≥1 reallocation delta / has ≥1 action / has ≥1 staged action / saved).
- Clicking a step scroll-spies to that panel.

### 2. Auto-suggest on first entry (empty state)
When the strategy has **no actions and no reallocation**, show a large, friendly empty-state card above the Marimekko:
- Headline: "Start with an AI-suggested resilient plan"
- Body: explains that Suggest will pre-fill reallocations *and* seed the Actions Rail so the timeline has something to stage.
- Primary CTA: "Suggest resilient allocation" (same server fn as today).
- Secondary link: "Or build it manually — start by adding an action →" (scrolls + highlights the Actions Rail "Add" button).

This directly fixes the "drop actions here / nothing to drop" trap — users understand they must first create actions in the rail, then drag them into years.

### 3. Actions Rail → Timeline linkage
Currently the Rail (right column) and Timeline (left column) look unrelated. Add:
- Small caption on the Rail: "Actions you add here become draggable tiles in the Staging Timeline below."
- Small caption on the Timeline empty year: replace "drop actions here" with a two-line hint:
  - Line 1 (when rail is empty): "No actions yet — add one in Resilience Actions →"
  - Line 1 (when rail has items): "Drag an action from Resilience Actions into Year N"
- Newly created actions auto-flash / pulse once so users see they appeared.
- Each Rail item shows a drag-handle icon + "drag to a year" microcopy on hover.

### 4. Unstaged actions tray
Add an "Unstaged" row **inside** the Staging Timeline (above Year 1–5) that lists any action whose `staging_year` is 0/null. This makes the drag source visible in the same widget as the drop target — the #1 UX confusion today. New actions default to Unstaged.

### 5. First-run coach marks (dismissible)
On the very first visit to a threat with no strategy saved, show three sequential tooltips anchored to:
1. Marimekko — "Drag handles to reshape the FDI mix."
2. Actions Rail "Add" — "Create resilience actions here."
3. Timeline — "Then drag each action into the year you'll execute it."

Stored in `localStorage` per-user (`studio.coachmarks.v1`). Also reachable via a "Show tour" link in the header.

### 6. Better section headers
Replace the current all-caps monospace mini-labels with numbered headers that match the journey:
- "② Reshape the mix — FDI envelope reallocation"
- "③ Stage the actions — years 1–N"
- "④ Stress test — what breaks, what holds"

Keep the ExplainHover popovers already in place; the numbered headers make the sequence unmistakable at a glance.

### 7. Persistent guidance banner
A one-line contextual banner just under the journey bar that updates based on state:
- No actions: "Next: add a resilience action, or click Suggest to auto-generate a plan."
- Actions unstaged: "Next: drag your N action(s) into the year you'll deliver them."
- All staged, not saved: "Next: review the stress test, then Save draft."
- Saved: "Ready to promote to Plan of Record or model as scenario."

## Files touched

- **New**: `src/components/studio/WorkbenchJourney.tsx`, `src/components/studio/GuidanceBanner.tsx`, `src/components/studio/EmptyStrategyCoach.tsx`, `src/components/studio/CoachMarks.tsx`.
- **Modified**:
  - `src/routes/_authenticated/admin/countries.$code.studio.threats.$id.tsx` — mount journey + banner + empty-state, derive step completion.
  - `src/components/studio/StagingTimeline.tsx` — add Unstaged tray, smarter empty-year copy driven by `actionsCount` prop, numbered header.
  - `src/components/studio/ResilienceActionsRail.tsx` — add drag hint, linkage caption, flash-on-add.
  - `src/components/studio/ReallocationMarimekko.tsx` — numbered header.
  - `src/components/studio/explain-copy.ts` — copy for new hints.

## Scope guardrails

- No changes to server functions, data model, or the underlying interactions (drag/drop, sliders, Suggest, Save, Promote all keep current behavior).
- Purely frontend/presentation.
- All added copy in the existing mono/serif type system and current tokens — no new colors.
