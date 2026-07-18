## Chamber 03 — Guided Scenario Builder (Minister-grade)

### The problem today
The current `/scenarios/new` page dumps every control on one screen: title, ministry, horizon slider, playbook chips, assumptions textarea, sticky action bar, a stat strip, fan chart, waterfall, attribution, tornado, and narrative — plus a hidden Levers drawer. A minister lands on it with no idea what to do first, why the numbers already show +2.00% before they've touched anything, or what "levers off default" means. It reads as an analyst's console, not a decision rehearsal.

### The redesign — a 4-step guided rehearsal
Reframe the page as a **wizard rail** on the left that walks the user through four decision moves, with the live simulation locked to the right. Each step reveals only what matters for that move, explains it in one sentence, and previews the consequence before advancing.

```text
┌───────────────────────────────┬───────────────────────────────────────┐
│  GUIDED RAIL (left, 380px)    │  LIVE CANVAS (right)                  │
│                               │                                       │
│  ● 1 · Frame the question     │  Baseline strip:                      │
│  ○ 2 · Pick a starting play   │   Y1 · Y5 · Exposure · vs baseline    │
│  ○ 3 · Tune the levers        │                                       │
│  ○ 4 · Read & save            │  Consequence viz (swaps per step):    │
│                               │   Step 1 → baseline fan (context)     │
│  Step content:                │   Step 2 → playbook compare overlay   │
│   • one prompt                │   Step 3 → lever-driven fan + delta   │
│   • one input                 │   Step 4 → sector waterfall + save    │
│   • "what changes if I…" hint │                                       │
│                               │  Why-this-moved rail (always visible) │
│  [ Back ]        [ Next → ]   │                                       │
└───────────────────────────────┴───────────────────────────────────────┘
```

### Step 1 · Frame the question
Single card, single prompt: *"What decision are you rehearsing?"* Title + one-line strategic question + ministry scope. Everything else deferred. Canvas shows the country's committed baseline fan with a caption "This is your do-nothing path" so the user immediately grasps what the engine is comparing against. Advance is enabled the moment a title is present.

### Step 2 · Pick a starting play
Playbooks become **large cards** (not chips) with a one-line thesis and a live mini-fan showing that playbook's Y1/Y5 delta vs baseline. Selecting a card animates the main fan to that play and the stat strip shows deltas in green/red. "Baseline hold" is the default so ministers understand doing nothing is a valid, framed choice. A "Start from scratch" card is the escape hatch.

### Step 3 · Tune the levers (the "cause → effect" moment)
This is where the "adjust one thing, see the other thing happen" feel lives. Two changes:

- **Levers move inline into the rail**, grouped by ministry/domain, only showing the top 6 levers the chosen playbook actually touches. "Show all levers" expands the rest. No more hidden drawer for the primary flow.
- **Each lever slider is paired with an inline consequence chip** that updates as you drag: e.g. `Tourism VAT −2pp → Y1 GDP +0.14pp · Exposure +1.2`. The chip is computed from the live attribution row for that lever, so the causal link is spelled out at the control, not buried in a chart below.

The canvas keeps the fan chart but overlays a **ghost line for the pre-change path** so every drag visibly bends the future away from the previous scenario. A "Why did this move?" panel on the right auto-highlights the top three contributing levers with plain-English one-liners (drawn from existing attribution + narrative gen).

### Step 4 · Read & save
Final step swaps the canvas to the **sector waterfall + tornado** so the user sees where the growth actually lands and what would break the story. The rail becomes a **one-page summary**: title, question, play, top 3 lever moves, headline number, risk (tornado max swing), assumption note. Buttons: `Save draft`, `Save & pin`, `Fork from here`. Assumptions note lives here, not up front.

### Cross-step affordances
- **Progress ribbon** at the top of the rail shows step 1/4 with checkmarks; a minister can jump back at any time without losing state.
- **Persistent "vs baseline" delta chip** in the sticky action bar so the headline change is always one glance away, not derived by mental math.
- **Coach-mark tooltips** (dismissible, per-user) on the fan bands ("P10/P50/P90 = pessimistic/central/optimistic"), on Exposure, and on Attribution — written for a Permanent Secretary, not an economist.
- **Empty & pending states** rewritten in plain English ("Engine is thinking… ~1s", "No levers wired for this country yet — [seed defaults]").
- **Keyboard**: `←/→` navigate steps; `⌘S` save; `⌘⇧S` save & pin.

### Technical notes (for build)
- New file `src/components/scenarios/GuidedRail.tsx` owns steps 1–4, receives lever defs, current values, and mutation handlers as props. All existing state (`levers`, `locks`, `title`, `activePlaybook`, `assumptionsNote`) stays lifted in `Builder`; the rail is a controlled view.
- New `src/components/scenarios/LeverRow.tsx` renders one slider + a "consequence chip" driven by the current `attribution` row for that lever slug (fallback: `—` when the engine hasn't attributed it yet).
- New `src/components/scenarios/PlaybookCard.tsx` replaces `PlaybookChips` for step 2; keep `PlaybookChips` for the scenario list view.
- New `src/components/scenarios/GhostFanOverlay.tsx` extends `GdpFanChart` to accept a `ghostPath` prop (the pre-change P50) and draw it as a dashed line.
- New `src/components/scenarios/StepProgress.tsx` — 4-dot rail with labels.
- New `src/components/scenarios/CoachTip.tsx` — dismissible tooltip persisted in `localStorage` per user+key.
- Rework `countries.$code.scenarios.new.tsx` into the two-column layout above; keep the existing `runScenarioEngine` debounce (250ms) and `preview` mutation logic unchanged so engine behaviour is preserved.
- Retire the `LeversDrawer` from the primary path but keep it available behind a "Full lever board" link on step 3 for power users.
- No schema changes, no server-function changes, no engine changes. Purely a UI/UX refactor of one route plus five small new components.

### Out of scope (for this pass)
- The scenarios list rail, artifact viewer, and compare view stay as-is.
- No new AI calls; the narrative panel stays on step 4 only.
