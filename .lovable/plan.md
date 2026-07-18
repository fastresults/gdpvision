## Honest critique of the current screen

Speaking as a senior UI/UX lead: this is **not** acceptable for a ministerial-tier product. It reads like an internal admin tool, not an instrument used by a Prime Minister's economic council. Concrete failures visible in the screenshot:

### Layout & overflow
1. **Right column overflows the viewport.** The `xl:grid-cols-[320px_360px_1fr]` grid gives the projection canvas the leftover space, but the two serif stat numbers ("+2.00%" / "+2.00%") collide into each other and the fan chart is clipped on the right edge. At 1386px there simply isn't room for three fixed rails + a canvas.
2. **Header controls (`COMPARE · 0/4`, `+ NEW SCENARIO`) are cropped** on the right — the page has no max-width discipline and no responsive collapse.
3. **The scenarios rail is 320px of near-empty space** ("0 scenarios · No scenarios yet"). It dominates the composition while contributing nothing.
4. **Sector Waterfall / Attribution cards are cramped** into a narrow strip with truncated placeholder copy ("No sector movement", "No lever is…").

### Hierarchy & typography
5. **No clear primary action.** "Save as draft" is buried bottom-right and reads the same weight as "Reset". A ministerial tool needs an obvious *Run / Save / Pin* flow.
6. **Serif stat numbers at that size fight the fan chart.** They're the loudest thing on screen but they're placeholders (+2.00%), which trains the eye to distrust them.
7. **Portfolio scope value is truncated** mid-word ("Ministry of Agriculture, Land, Fisheries &").
8. **Everything is uppercase mono micro-caps.** Used everywhere it becomes noise, not hierarchy. Ministers can't scan it.

### Interaction
9. **Playbook tooltip is a heavy black block that obscures adjacent chips** — no arrow, no offset, blocks the click target next to it.
10. **Playbook chips stack one-per-row**, wasting vertical space and hiding the fact they're mutually exclusive.
11. **No live-run feedback.** Debounced engine runs happen silently — no shimmer, no "recomputing…" state, no timestamp on the projection.
12. **"No levers configured for ATG yet"** is shown as flat body copy instead of a first-class empty state with a CTA back to onboarding.
13. **Lever labels render raw slugs** (`tourism_arrivals_growth`) instead of human names — confirmed in code (`{def.slug}` at line 357).

### Product credibility
14. **No breadcrumb or portfolio context ribbon.** "ATG · CHAMBER 03" as 10px caption is invisible to a non-technical principal.
15. **No pinned engine snapshot line** ("Live · Engine v1_macro" appears as micro-text at the bottom of the right rail with no ties to the projection).
16. **Compare rail counter (0/4) has no affordance** — user can't tell what it does.

---

## Plan — Scenario Engine v2 (elegant, ministerial-grade)

### 1. Re-architect the layout
- Collapse to **two rails + canvas** at ≤1440px:
  - Rail A (280px, collapsible): Scenarios list + framing (title, scope, horizon, playbooks, assumptions).
  - Rail B (canvas, fluid): projection stack — stats strip → fan chart → waterfall/attribution/tornado grid → narrative.
  - Levers move into a **right slide-over drawer** (420px) triggered by "Adjust levers · N active" pill. Freeing the canvas is the single biggest visual win.
- Add `max-w-[1440px] mx-auto` container with `min-w-0` on canvas children to stop overflow.
- Sticky top action bar (breadcrumb ← Portfolio · Ministry chip · Live badge · Compare · Save & Pin · Run) that survives scroll.

### 2. Rebuild the stats strip
- Horizontal 4-up KPI strip with **fixed-width tabular-nums**, hairline dividers, small delta-vs-baseline sparkline under each value.
- Serif numerals sized to the fan chart's headroom (48–56px), never overlapping.
- Add "Δ vs baseline" chip (green/amber) and P10/P90 range in small type below P50.
- 4th stat: **Confidence / draft quality** (source coverage %) — signals rigor.

### 3. Empty & loading states worthy of the tier
- Replace `"No levers configured for ATG yet"` with a proper empty card: icon, one-line explanation, secondary CTA "Configure levers in onboarding →".
- Add `Shimmer` on the fan chart + stat numerals while `preview.isPending`; timestamp "Recomputed 0.4s ago · Engine v1_macro".
- Skeleton the sector waterfall and attribution when levers all sit at baseline (before any change).

### 4. Fix labels, tooltips, playbooks
- Add human `label` to `LeverDef` (fallback to titleized slug) and render label + slug-as-caption; group by sector with a colored rule bar.
- Playbook chips: 2-column wrap grid, active state = filled ink, hover reveals blurb inline **below** the grid (not as an overlay), never obscuring adjacent chips.
- Portfolio scope: replace `<select>` with a searchable combobox that shows the full ministry name and a chip for the sector color.

### 5. Primary action clarity
- Top-right sticky bar owns: **Run** (secondary), **Save draft** (secondary), **Save & Pin for Compare** (primary, filled).
- Kill duplicate reset/save cluster at the bottom of the levers drawer.
- "Compare · 0/4" becomes a real slot indicator: 4 empty squares that fill as scenarios are pinned; click opens `/scenarios/compare`.

### 6. Narrative & citations (ministerial voice)
- Move the AI executive narrative (already implemented as `NarrativePanel`) directly under the fan chart with a "So-what" callout block, pull-quote treatment, and citation chips linking to `country_sources`.
- Add a "Print / Export to brief" affordance (PDF/markdown) — this is what a Minister actually walks into a Cabinet meeting with.

### 7. Typography & tokens
- Reduce uppercase-mono captions to *only* section eyebrows and metric units. Body copy in Inter/Karla, numbers in tabular-nums, titles in the existing serif.
- Introduce two new tokens: `--surface-canvas` (paper-0 + subtle vignette) and `--rule-strong` for the stat divider. All existing ink/sector tokens preserved.

### 8. Files to touch (frontend only — no engine or data changes)

```text
src/routes/_authenticated/admin/countries.$code.scenarios.new.tsx   ← re-layout + sticky bar
src/routes/_authenticated/admin/countries.$code.scenarios.tsx        ← rail collapse + shared shell
src/components/scenarios/StatStrip.tsx                    (new)      ← 4-up KPI with sparkline
src/components/scenarios/LeversDrawer.tsx                 (new)      ← extract from Column B
src/components/scenarios/PlaybookChips.tsx                           ← inline blurb, 2-col grid
src/components/scenarios/GdpFanChart.tsx                             ← min-w-0 + responsive width
src/components/scenarios/EmptyLevers.tsx                  (new)
src/components/scenarios/ScenarioTopBar.tsx               (new)      ← breadcrumb + primary actions
src/components/scenarios/CompareSlots.tsx                 (new)      ← 0/4 → visual slots
src/styles.css                                                       ← 2 new tokens
```

No changes to `scenarios.functions.ts`, engine math, or DB schema.

### 9. Verification
- Playwright pass at 1280×800, 1440×900, 1920×1080: assert no horizontal scroll, stat numerals don't overlap, playbook tooltip doesn't cover siblings, fan chart bounding box fits within canvas.
- Manual: seed one scenario with fork, adjust two levers, confirm shimmer → recomputed timestamp → pin flows into Compare slot.

### Out of scope for this pass
- Compare page redesign (separate follow-up).
- New engine math, new lever taxonomy, or narrative model changes.
- Chamber 01/02 restyle — this plan is scoped to the Scenario Engine builder + list shell.
