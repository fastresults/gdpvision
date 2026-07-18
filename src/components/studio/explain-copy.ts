import type { ExplainCopy } from "./ExplainHover";

/**
 * Central copy for Chamber 4 (FDI Transition Studio) hover explanations.
 * Voice: plain-language, McKinsey-tone, sovereign policy register.
 * Each entry answers: What is this? Why does it matter? How is it used?
 */
export const EXPLAIN: Record<string, ExplainCopy> = {
  // ── Act 1 · Studio index ────────────────────────────────────────────────
  new_threat: {
    title: "Compose a new threat scenario",
    what: "Frames a shock — tariff, disaster, treaty change, anchor exit — that could reshape your FDI base.",
    why: "Every resilience strategy starts from a specific, quantified threat. Vague concerns produce vague plans.",
    how: "The threat you compose here seeds the exposure ledger, the AI briefing, and the reallocation canvas in the next steps.",
  },
  threat_preset: {
    title: "Threat preset",
    what: "A pre-shaped shock with default severity, horizon, and typical target sectors.",
    why: "Presets encode the transmission mechanics we've seen in comparable small-state economies, so you don't start from a blank page.",
    how: "Pick the closest match, then tune severity, horizon, and target sectors to your country's reality.",
  },
  threat_status: {
    title: "Threat status",
    what: "Where this threat sits in the studio workflow — draft, briefed, strategy in progress, stress-tested, or committed.",
    why: "Prevents partial work from being mistaken for a decision-ready recommendation.",
    how: "Only stress-tested threats can be promoted to the Scenario Engine or saved as a plan of record.",
  },

  // ── Threat stepper ──────────────────────────────────────────────────────
  step_compose: {
    title: "Act 1 · Compose",
    what: "Define the shock: what it is, how hard it hits, when it lands, and which sectors are exposed.",
    why: "A well-specified threat is the input to every downstream number — a sloppy frame produces a sloppy strategy.",
    how: "Your inputs here drive the AI briefing and the exposure ledger.",
  },
  step_strategy: {
    title: "Act 2 · Strategy",
    what: "Reallocate FDI across sectors and stage the moves over time.",
    why: "Resilience is not about avoiding the shock — it's about where capital moves next.",
    how: "Your reallocation and staging feed the stress test in Act 3.",
  },
  step_stress: {
    title: "Act 3 · Stress test",
    what: "Simulate the strategy against the threat and inspect the impact on GDP, jobs, and fiscal position.",
    why: "Tests whether the reallocation actually absorbs the shock — or just moves it.",
    how: "Promote a passing strategy to the Scenario Engine, or save it as your country's plan of record.",
  },

  // ── Threat composer inputs ──────────────────────────────────────────────
  threat_type: {
    title: "Threat type",
    what: "The class of shock — tariff, climate event, CBI wind-down, tourism collapse, anchor exit, commodity, sanctions, treaty change.",
    why: "Different shock classes transmit through the economy differently. A tariff is not a hurricane.",
    how: "Sets the default transmission mechanics used by the AI briefing and the exposure model.",
  },
  severity: {
    title: "Severity",
    what: "Percentage magnitude of the shock relative to its baseline exposure.",
    why: "A 20% tariff and an 80% tariff produce very different FDI responses.",
    how: "Scales the at-risk pp-of-GDP figures in the exposure ledger and drives the stress-test impact.",
  },
  horizon: {
    title: "Horizon",
    what: "The number of years the shock and the strategy play out over.",
    why: "Resilience moves that work in 10 years may be impossible in 2.",
    how: "Sets the timeline in the staging view and the projection window in the stress test.",
  },
  onset: {
    title: "Onset",
    what: "How quickly the shock lands — immediate, within 1–2 years, phased, or latent.",
    why: "Immediate onset forces reactive moves; phased onset allows sequencing.",
    how: "Shifts when at-risk exposure hits the ledger and changes the staging recommendations.",
  },
  target_sectors: {
    title: "Target sectors",
    what: "The sectors directly hit by the shock.",
    why: "Concentration risk depends on both the sector's GDP share and how the shock interacts with it.",
    how: "Selected sectors become the first-order exposure in the ledger; adjacent sectors show as second-order spillovers.",
  },

  // ── Threat briefing ─────────────────────────────────────────────────────
  briefing: {
    title: "AI threat briefing",
    what: "A three-bullet framing generated from your country's actual sector data.",
    why: "Turns raw numbers into a decision-ready narrative in the language ministers use.",
    how: "Grounds the reallocation debate — every bullet cites the country data it was drawn from.",
  },
  briefing_mechanism: {
    title: "Mechanism",
    what: "How the shock transmits through the economy — the causal chain from event to FDI impact.",
    why: "Interventions that don't interrupt the mechanism don't build resilience.",
    how: "Use it to sanity-check whether your reallocation actually addresses the transmission path.",
  },
  briefing_first_order: {
    title: "First-order FDI exposure",
    what: "Quantified direct FDI at risk, expressed where possible in percentage points of GDP.",
    why: "Names the size of the problem in a unit ministers and creditors both understand.",
    how: "The number you must at least neutralise with reallocated or new FDI.",
  },
  briefing_second_order: {
    title: "Second-order spillovers",
    what: "Adjacent sectors and multiplier effects likely to compound the direct hit.",
    why: "Ignoring spillovers is the single most common reason a resilience plan under-delivers.",
    how: "Extend the strategy to cover these sectors, or explicitly accept the residual risk.",
  },
  regenerate_briefing: {
    title: "Regenerate briefing",
    what: "Re-runs the AI framing against the latest threat inputs and country data.",
    why: "Use after you've adjusted severity, horizon, or target sectors so the narrative stays in sync.",
    how: "Old citations are replaced; the previous version is not kept.",
  },
  citation_chip: {
    title: "Source citation",
    what: "A pointer to the specific country-data record the briefing bullet drew from.",
    why: "Nothing here is a hallucination — every number has a provenance.",
    how: "Click to open the source; verify before quoting the briefing externally.",
  },

  // ── Exposure ledger ─────────────────────────────────────────────────────
  exposure_ledger: {
    title: "Exposure ledger",
    what: "Sector-by-sector accounting of how much GDP is at risk under this threat.",
    why: "Makes the abstract shock concrete, sector by sector, in a form finance ministries recognise.",
    how: "Feed for the reallocation canvas — the columns you must offset or accept.",
  },
  exposure_gdp_share: {
    title: "GDP share",
    what: "The sector's contribution to national GDP, from your onboarding data.",
    why: "Concentration is where fragility lives — a 40% sector is a different problem from a 4% sector.",
    how: "Weights each row's importance in the total exposure calculation.",
  },
  exposure_at_risk: {
    title: "At-risk pp",
    what: "Percentage points of GDP directly exposed to the shock, before mitigation.",
    why: "Names the size of the gap the resilience strategy must close.",
    how: "Sum across sectors gives the total exposure the reallocation must offset.",
  },
  exposure_confidence: {
    title: "Confidence grade",
    what: "A–D quality grade on the underlying sector data (from onboarding).",
    why: "Low-grade inputs deserve low-conviction conclusions.",
    how: "Prioritise strengthening D/C-grade sectors in your data before committing a plan of record built on them.",
  },

  // ── Strategy workbench ──────────────────────────────────────────────────
  strategy_title: {
    title: "Strategy name",
    what: "A human-readable label for this resilience strategy.",
    why: "Ministers and technocrats will refer to strategies by name in cabinet and creditor briefings.",
    how: "Click to rename. Name changes save on blur.",
  },
  suggest_allocation: {
    title: "Suggest resilient allocation",
    what: "AI-generated starting reallocation across sectors, sized to close the exposure gap.",
    why: "Anchors the debate on a credible baseline rather than a blank canvas.",
    how: "Treat as a first draft — adjust the Marimekko, staging, and actions before committing.",
  },

  // ── Reallocation Marimekko ──────────────────────────────────────────────
  marimekko: {
    title: "Reallocation Marimekko",
    what: "Sector reallocation sized by both GDP share (width) and change in FDI (height).",
    why: "Shows in one picture where capital is leaving, where it's landing, and whether the trade is proportionate.",
    how: "Rebalance blocks until the total offset covers the exposure ledger.",
  },

  // ── Resilience actions rail ─────────────────────────────────────────────
  actions_rail: {
    title: "Resilience actions",
    what: "Concrete policy and investment moves that operationalise the reallocation.",
    why: "A reallocation without actions is a spreadsheet; actions are what governments actually do.",
    how: "Group by category (incentive, deregulation, investment, capability). AI-suggested actions are marked.",
  },
  action_add: {
    title: "Add action",
    what: "Insert a new resilience action into the rail.",
    why: "Every reallocation shift needs at least one concrete instrument to be credible.",
    how: "Give it a category color, a short label, and a horizon on the staging timeline.",
  },

  // ── Staging timeline ────────────────────────────────────────────────────
  staging: {
    title: "Staging timeline",
    what: "When each resilience action lands across the strategy horizon.",
    why: "Sequencing is often the difference between a plan that works and one that hits fiscal walls.",
    how: "Move actions between horizons to test different sequencing hypotheses.",
  },

  // ── Stress test ─────────────────────────────────────────────────────────
  stress_panel: {
    title: "Stress test",
    what: "Simulates the strategy against the threat and reports impact on GDP, employment, and fiscal balance.",
    why: "The only test that matters — does the reallocation actually absorb the shock?",
    how: "A passing test unlocks promotion to the Scenario Engine or the plan of record.",
  },
  resilience_score: {
    title: "Resilience score",
    what: "Composite 0–100 score of how well the strategy neutralises the threat.",
    why: "A single number ministers can defend in cabinet.",
    how: "Above 70 is decision-grade; 50–70 is directional; below 50 needs rework.",
  },

  // ── Commit bar ──────────────────────────────────────────────────────────
  commit_promote: {
    title: "Promote to Scenario Engine",
    what: "Sends this strategy into Chamber 03 as a runnable projection scenario.",
    why: "Lets you compare the resilient strategy against baseline and alternative scenarios head-to-head.",
    how: "Available only after a successful stress test.",
  },
  commit_record: {
    title: "Save as plan of record",
    what: "Marks this strategy as the country's committed FDI resilience plan for this threat.",
    why: "Freezes the reallocation, actions, and staging so downstream chambers reference a single source of truth.",
    how: "Reversible — you can supersede it later with a new plan.",
  },
  commit_discard: {
    title: "Discard strategy",
    what: "Removes this draft strategy without affecting the underlying threat.",
    why: "Keeps the workspace clean; draft strategies you no longer believe in shouldn't clutter the record.",
    how: "The threat itself and its briefing stay — only this strategy is removed.",
  },

  // ── Additional composer + workbench ─────────────────────────────────────
  pick_threat: {
    title: "Pick a threat",
    what: "Choose the class of shock this scenario models.",
    why: "The preset encodes how the shock transmits — a tariff, a hurricane and a treaty exit all behave differently.",
    how: "Pick the closest match; you can rename it and refine target sectors, severity and horizon below.",
  },
  frame_threat: {
    title: "Frame the threat",
    what: "Commits the composed threat and generates the AI briefing.",
    why: "Turns your inputs into a decision-ready framing grounded in the country's live sector data.",
    how: "Opens the Strategy Workbench for Act 2. You can regenerate the briefing later without losing your work.",
  },
  waterfall: {
    title: "Exposure → mitigation waterfall",
    what: "Sector-by-sector view of exposure at risk (red) against exposure closed by your actions (green).",
    why: "Shows exactly where mitigation is landing — and which sectors are still uncovered.",
    how: "If a red bar has little green, add resilience actions targeting that sector.",
  },
  stress_metrics: {
    title: "Stress-test metrics",
    what: "Four headline indicators for the current strategy: exposure closed, residual risk, diversification (HHI Δ), and time to resilience.",
    why: "Ministers need to defend the plan on a small set of numbers — these are the ones creditors and cabinets ask about.",
    how: "Aim for residual risk near zero, negative HHI Δ, and a time-to-resilience horizon that matches political runway.",
  },
  commit_save: {
    title: "Save draft",
    what: "Persists the current strategy state without promoting it.",
    why: "Lets you iterate over multiple sessions without losing work or committing prematurely.",
    how: "Save often. Promotion actions require a saved, stress-tested strategy.",
  },
  commit_plan: {
    title: "Promote to plan of record",
    what: "Freezes this strategy as the country's committed FDI resilience response to the threat.",
    why: "Establishes a single source of truth other chambers and ministries can reference.",
    how: "Reversible — supersede later with a new plan. Requires a saved, stress-tested strategy.",
  },
  commit_scenario: {
    title: "Model as scenario",
    what: "Sends this strategy into Chamber 03 (Scenario Engine) as a runnable projection.",
    why: "Lets you compare the resilient strategy head-to-head against baseline and alternative scenarios.",
    how: "Available after saving. The scenario appears in Chamber 03 with the strategy's reallocation and actions preloaded.",
  },
};
