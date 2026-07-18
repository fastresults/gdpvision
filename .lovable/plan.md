## Goal
Make every meaningful element in Chamber 4 (FDI Transition Studio) self-explanatory. Hovering any labeled surface for ~3.5s opens a plain-language popover that answers: **What is this? Why does it matter? How does it factor into the FDI resilience analysis?**

## UX behavior
- **Trigger:** hover for 3500ms (configurable), or keyboard focus for the same delay. Instant close on mouseleave/blur/Escape.
- **Touch/mobile:** long-press (600ms) opens the same modal; tap-outside closes.
- **Never blocks work:** popover is non-modal, positioned via Radix `Popover` (already in the shadcn set), max-width ~360px, McKinsey-tone copy — three short sections: *What*, *Why it matters*, *How it's used*.
- **Discoverability affordance:** a tiny `?` glyph appears in the corner on hover so users know the element is explainable (not a surprise-only interaction).
- **Respects motion prefs:** no delay for users with `prefers-reduced-motion` who focus via keyboard — opens on focus immediately.

## Implementation

### 1. Reusable primitive: `<ExplainHover>`
New file `src/components/studio/ExplainHover.tsx`. Wraps any child, adds the hover timer, renders a Radix Popover. Props:
```
{ id: string; title: string; what: string; why: string; how: string; delayMs?: number; side?: "top"|"right"|"bottom"|"left" }
```
- Uses a single shared timer ref to avoid opening while user is just passing through.
- Cancels if pointer leaves before delay elapses.
- Adds `aria-describedby` linking child to popover for a11y.

### 2. Central copy registry
New file `src/components/studio/explain-copy.ts` — one source of truth so ministers get consistent language and we can iterate wording without hunting through JSX. Keyed entries for every element listed below.

### 3. Elements to wrap (Chamber 4 surfaces)

**Route `countries.$code.studio.index.tsx` (Threat list / Act 1 landing):**
- "New threat" CTA
- Each preset chip (Tariff, Climate, CBI wind-down, etc.)
- Threat card status badges

**`ThreatStepper.tsx`:** each of the 3 steps (Compose, Strategy, Stress).

**`ThreatComposer.tsx`:** threat type, severity slider, horizon, onset, target sectors picker.

**`ThreatBriefCard.tsx`:** the "Threat briefing" section header, each of the 3 bullets (Mechanism / First-order / Second-order), Regenerate button, citation chips.

**`ExposureLedger.tsx`:** column headers (Sector, GDP share, At-risk pp, Confidence), and the ledger total row.

**Strategy workbench route `countries.$code.studio.threats.$id.tsx`:**
- Header meta chips (threat type, severity bar, horizon, onset)
- "Suggest resilient allocation" button
- Strategy title (rename)

**`ReallocationMarimekko.tsx`:** chart title and axis labels; per-sector block hover already shows values, so add one meta ExplainHover on the chart title only.

**`ResilienceActionsRail.tsx`:** rail header, each action-category color legend, "Add action" button.

**`StagingTimeline.tsx`:** timeline header, each horizon column header (0–2y, 2–5y, 5–10y).

**`StressTestPanel.tsx`:** each KPI tile label, "resilience score" number, sensitivity bars.

**`CommitBar.tsx`:** "Promote to Scenario Engine", "Save as plan of record", "Discard" buttons.

### 4. A11y & polish
- Popover content uses existing McKinsey tokens (`bg-paper-0`, `border-line-200`, serif title, mono eyebrow).
- Sections rendered as: eyebrow "What" / body, eyebrow "Why it matters" / body, eyebrow "How it's used" / body.
- Popover closes on route change (unmount safe).
- No popover on inputs while the user is typing.

### 5. Out of scope
- No changes to server functions or data model.
- No new tooltips on Chambers 1–3, 5, 6 (this ticket is Chamber 4 only; the primitive is reusable if you later want to extend).
- No settings toggle to disable — copy is short enough to be helpful, not noisy.

## Files changed
- **New:** `src/components/studio/ExplainHover.tsx`, `src/components/studio/explain-copy.ts`
- **Edited (wrap targets only, no logic change):** the 8 studio components + 2 studio route files listed above.
