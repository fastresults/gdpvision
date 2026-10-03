// @domain personas
// @tables ministry_portfolios,portfolio_skills,portfolio_persona_sets,portfolio_personas,portfolio_persona_syntheses
// @ui src/routes/_authenticated/admin/countries.$code.personas.portfolios.index.tsx
//
// Chamber 07 · Ministers track — row shapes and shared constants for the
// Ideal Minister profiles (drizzle/migrations/0028). Client-safe.
//
// Queries go through `db()` (src/lib/syndication/db.ts) until Lovable
// regenerates types.ts after applying 0028; results are cast to these shapes.

import type { ContextLine } from "@/lib/egov/db";

export type { ContextLine };

export const REGIONAL = "REGIONAL";

export type PortfolioKind = "head_of_government" | "opposition" | "ministry";
export type SetKind = "regional" | "overlay";
export type SetStatus = "draft" | "submitted" | "approved" | "returned" | "superseded";
export type RunState = "idle" | "running" | "failed" | "done";

export const PHASES = [
  "scope",
  "matrix",
  "generate",
  "qa",
  "aggregate",
  "synthesise",
  "overlay",
  "done",
] as const;
export type Phase = (typeof PHASES)[number];

export const PHASE_LABEL: Record<Phase, string> = {
  scope: "Ground",
  matrix: "Design the cast",
  generate: "Cast the personas",
  qa: "Quality check",
  aggregate: "Count",
  synthesise: "Synthesise",
  overlay: "Country overlay",
  done: "Done",
};

export const PHASE_HINT: Record<Phase, string> = {
  scope: "Reads the corpus and researches the office's career patterns, with citations.",
  matrix: "Spreads the cast across career route, tenure, scale, context, crisis and disposition.",
  generate: "Writes the personas five at a time, each against its matrix cell.",
  qa: "Removes near-duplicates and anything too close to a real office holder.",
  aggregate: "Counts skills, personality bands and decision styles. No model.",
  synthesise: "Writes the Ideal Minister Profile from the counts and the cast.",
  overlay: "Re-weights the approved regional profile for this country.",
  done: "Ready for review.",
};

/** The run order for each kind of set. */
export function phasesFor(kind: SetKind): Phase[] {
  return kind === "overlay"
    ? ["scope", "overlay", "done"]
    : ["scope", "matrix", "generate", "qa", "aggregate", "synthesise", "done"];
}

export const GENERATE_BATCH = 5;

export const SKILL_FAMILIES = [
  "domain",
  "policy",
  "fiscal",
  "stakeholder",
  "communication",
  "leadership",
  "digital",
] as const;
export type SkillFamily = (typeof SKILL_FAMILIES)[number];

export const SKILL_FAMILY_LABEL: Record<SkillFamily, string> = {
  domain: "Domain expertise",
  policy: "Policy and legislative craft",
  fiscal: "Fiscal and procurement",
  stakeholder: "Stakeholders and diplomacy",
  communication: "Communication",
  leadership: "Executive leadership",
  digital: "Digital and data",
};

export const OCEAN_KEYS = [
  "openness",
  "conscientiousness",
  "extraversion",
  "agreeableness",
  "neuroticism",
] as const;
export type OceanKey = (typeof OCEAN_KEYS)[number];

export const OCEAN_LABEL: Record<OceanKey, string> = {
  openness: "Openness",
  conscientiousness: "Conscientiousness",
  extraversion: "Extraversion",
  agreeableness: "Agreeableness",
  neuroticism: "Neuroticism",
};

export const STYLE_KEYS = [
  "horizon",
  "risk_posture",
  "evidence_weight",
  "consultation_breadth",
  "speed",
] as const;
export type StyleKey = (typeof STYLE_KEYS)[number];

/** Each decision-style dimension is a 1–5 scale; these are its two ends. */
export const STYLE_LABEL: Record<StyleKey, { label: string; low: string; high: string }> = {
  horizon: { label: "Horizon", low: "This term", high: "A generation" },
  risk_posture: { label: "Risk posture", low: "Cautious", high: "Bold" },
  evidence_weight: { label: "Evidence weight", low: "Instinct", high: "Evidence first" },
  consultation_breadth: { label: "Consultation", low: "Tight circle", high: "Wide" },
  speed: { label: "Speed", low: "Deliberate", high: "Fast" },
};

/** Sampling axes every portfolio uses; a portfolio may add its own. */
export const COMMON_AXES: MatrixAxis[] = [
  {
    key: "career_route",
    label: "Route to office",
    values: [
      "career politician",
      "technocrat from the civil service",
      "private-sector operator",
      "academic or professional",
      "trade unionist or activist",
      "diaspora returnee",
      "regional or multilateral official",
    ],
  },
  {
    key: "tenure_stage",
    label: "Tenure",
    values: [
      "first term",
      "second term",
      "veteran across governments",
      "caretaker or short tenure",
    ],
  },
  {
    key: "state_scale",
    label: "State scale",
    values: [
      "micro-state under 100,000 people",
      "small state 100,000–500,000",
      "larger state over 500,000",
    ],
  },
  {
    key: "governing_context",
    label: "Governing context",
    values: [
      "comfortable majority",
      "narrow majority",
      "coalition",
      "post-crisis reconstruction",
      "pre-election year",
    ],
  },
  {
    key: "formation_era",
    label: "Formed in",
    values: [
      "before 2008",
      "the 2008–2015 austerity years",
      "the 2016–2019 recovery",
      "after COVID-19",
    ],
  },
  {
    key: "crisis_exposure",
    label: "Defining crisis",
    values: [
      "major hurricane",
      "debt restructuring or IMF programme",
      "pandemic",
      "collapse in a key industry",
      "corruption or CBI scrutiny",
      "none severe",
    ],
  },
  {
    key: "disposition",
    label: "Decision disposition",
    values: [
      "consensus-seeker",
      "decisive executive",
      "evidence-led analyst",
      "coalition broker",
      "reformer",
      "steward of continuity",
    ],
  },
];

// ------------------------------------------------------------------ rows

export interface DecisionClass {
  key: string;
  label: string;
  description: string;
}

export interface MatrixAxis {
  key: string;
  label: string;
  values: string[];
}

export interface PortfolioRow {
  code: string;
  kind: PortfolioKind;
  label: string;
  description: string;
  default_sector_codes: string[];
  decision_classes: DecisionClass[];
  matrix_axes: MatrixAxis[];
  name_pattern: string | null;
  first_wave: boolean;
  sort_order: number;
}

export interface SkillRow {
  code: string;
  family: SkillFamily;
  label: string;
  definition: string;
  sort_order: number;
}

export interface MatrixCell {
  slot: number;
  cell: Record<string, string>;
}

export interface DesignMatrix {
  axes: MatrixAxis[];
  cells: MatrixCell[];
}

export interface PhaseLogEntry {
  phase: Phase;
  state: "done" | "failed" | "skipped";
  ts: string;
  duration_ms?: number;
  model?: string;
  summary?: string;
  error?: string;
}

export interface ProposedSkill {
  label: string;
  family: SkillFamily;
  definition: string;
  slots: number[];
}

export interface SetRow {
  id: string;
  portfolio_code: string;
  scope_key: string;
  kind: SetKind;
  base_set_id: string | null;
  version: number;
  title: string;
  target_size: number;
  status: SetStatus;
  phase: Phase;
  run_state: RunState;
  lock_until: string | null;
  run_error: string | null;
  phase_log: PhaseLogEntry[];
  design_matrix: DesignMatrix | Record<string, never>;
  context: ContextLine[];
  context_hash: string | null;
  proposed_skills: ProposedSkill[];
  model: string | null;
  created_by: string | null;
  submitted_by: string | null;
  submitted_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
  approval_mode: "two_person" | "sole_admin" | null;
  returned_by: string | null;
  returned_at: string | null;
  returned_note: string | null;
  created_at: string;
  updated_at: string;
}

export interface Citation {
  key: string;
  label: string;
  ref: string;
  why: string;
}

export interface PersonaSkill {
  code: string;
  proficiency: number;
  rationale: string;
}

export interface PersonaAttributes {
  age_band: string;
  formation: string;
  prior_roles: string[];
  constituency: string;
  political_capital: string;
  network: string;
  values: string[];
  signature_moves: string[];
}

export type Ocean = Record<OceanKey, number>;
export type DecisionStyle = Record<StyleKey, number> & { style: string };

export interface PersonaQa {
  ok?: boolean;
  similarity?: number;
  nearest_slot?: number | null;
  real_person_flag?: boolean;
  notes?: string[];
  retries?: number;
}

export interface PersonaRow {
  id: string;
  set_id: string;
  scope_key: string;
  slot_index: number;
  matrix_cell: Record<string, string>;
  name: string;
  archetype: string;
  career_route: string;
  summary: string;
  attributes: PersonaAttributes;
  ocean: Ocean;
  decision_style: DecisionStyle;
  skills: PersonaSkill[];
  citations: Citation[];
  qa: PersonaQa;
  normalized_key: string;
  model: string | null;
  created_at: string;
  updated_at: string;
}

// ------------------------------------------------------------------ synthesis

export interface SkillAggregate {
  code: string;
  family: SkillFamily;
  label: string;
  /** Personas holding the skill. */
  count: number;
  /** count / personas. */
  frequency: number;
  /** Mean proficiency among holders, 1–5. */
  mean_proficiency: number;
  /** frequency × mean_proficiency / 5 — the ranking score, 0–1. */
  weight: number;
}

export interface Band {
  mean: number;
  sd: number;
  min: number;
  p25: number;
  median: number;
  p75: number;
  max: number;
}

export interface Aggregates {
  personas: number;
  skills: SkillAggregate[];
  families: Array<{ family: SkillFamily; weight: number; skills: number }>;
  ocean: Record<OceanKey, Band>;
  style: Record<StyleKey, Band>;
  /** Count of personas by value, for each matrix axis and for career route. */
  mix: Record<string, Array<{ value: string; count: number }>>;
  values: Array<{ value: string; count: number }>;
  computed_at: string;
}

export type SkillTier = "must_have" | "should_have" | "differentiator";

export interface ProfileDecision {
  key: string;
  label: string;
  weighs: string[];
  horizon: string;
  risk_posture: string;
  consults: string[];
  says_no_when: string;
  narrative: string;
}

export interface ProfileSkill {
  code: string;
  tier: SkillTier;
  why: string;
}

export interface PortfolioWeighting {
  portfolio_code: string;
  stance: string;
  weight: number;
  arbitration_rule: string;
}

export interface IdealProfile {
  title: string;
  summary: string;
  personality: {
    ocean_target: Record<OceanKey, { low: number; high: number }>;
    traits: string[];
  };
  values: string[];
  decision_model: ProfileDecision[];
  skill_stack: ProfileSkill[];
  anti_patterns: string[];
  stress_behaviours: string[];
  /** Overlay only: what differs from the regional profile, and why. */
  country_deltas?: Array<{ aspect: string; change: string; why: string }>;
  /** Prime Minister only. */
  portfolio_weighting?: PortfolioWeighting[];
}

export interface SynthesisRow {
  id: string;
  set_id: string;
  scope_key: string;
  portfolio_code: string;
  aggregates: Aggregates | Record<string, never>;
  profile: IdealProfile | Record<string, never>;
  narrative_md: string;
  citations: Citation[];
  input_synthesis_ids: string[];
  model: string | null;
  edited_by: string | null;
  edited_at: string | null;
  created_at: string;
  updated_at: string;
}

export const SKILL_TIER_LABEL: Record<SkillTier, string> = {
  must_have: "Must have",
  should_have: "Should have",
  differentiator: "Differentiator",
};

export const STATUS_LABEL: Record<SetStatus, string> = {
  draft: "Draft",
  submitted: "Awaiting approval",
  approved: "Approved",
  returned: "Returned",
  superseded: "Superseded",
};

export function hasProfile(p: SynthesisRow["profile"] | null | undefined): p is IdealProfile {
  return !!p && typeof p === "object" && "decision_model" in p;
}

export function hasAggregates(a: SynthesisRow["aggregates"] | null | undefined): a is Aggregates {
  return !!a && typeof a === "object" && "skills" in a;
}

export function isMatrix(m: SetRow["design_matrix"] | null | undefined): m is DesignMatrix {
  return !!m && typeof m === "object" && "cells" in m && Array.isArray((m as DesignMatrix).cells);
}

/** How the office is named on the page, in titles and in persona chat. */
export function officeNames(p: Pick<PortfolioRow, "code" | "kind" | "label">): {
  ideal: string;
  occupation: string;
  archetype: string;
  ask: string;
} {
  if (p.kind === "head_of_government")
    return {
      ideal: "The Ideal Prime Minister",
      occupation: "Prime Minister",
      archetype: "ideal_pm",
      ask: "Ask the Ideal PM",
    };
  if (p.kind === "opposition")
    return {
      ideal: "The Ideal Leader of the Opposition",
      occupation: "Leader of the Opposition",
      archetype: "ideal_loo",
      ask: "Ask the Ideal Opposition Leader",
    };
  return {
    ideal: `The Ideal Minister of ${p.label}`,
    occupation: `Minister of ${p.label}`,
    archetype: `ideal_minister:${p.code}`,
    ask: "Ask the Ideal Minister",
  };
}

/** A profile is due for refresh after a year, or when an office it covers changes. */
export const REFRESH_AFTER_DAYS = 365;

export function scopeLabel(scope: string, countryName?: string): string {
  return scope === REGIONAL ? "Caribbean (regional)" : (countryName ?? scope);
}
