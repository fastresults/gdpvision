// @domain personas
// @tables —
// @ui src/components/personas/FieldStepper.tsx; src/components/personas/field/StageFrame.tsx

// Chamber 07 · The field rail's single source of truth.
//
// Stage order, what each stage decides, and the test that says it is done.
// The stepper, the stage frame and getFieldProgress all read from here so the
// three can never disagree about where the user is or what is left.

export const FIELD_STAGES = [
  "brief",
  "plan",
  "participants",
  "instruments",
  "fieldwork",
  "evidence",
] as const;

export type FieldStageKey = (typeof FIELD_STAGES)[number];

/** Stages that live on /personas/field/$step (brief lives at the chamber door). */
export const FIELD_WORK_STAGES = FIELD_STAGES.slice(1) as ReadonlyArray<
  Exclude<FieldStageKey, "brief">
>;

export interface FieldStageSpec {
  key: FieldStageKey;
  n: number;
  label: string;
  /** Small-caps kicker above the label. */
  sub: string;
  /** One line: what this stage decides. */
  decides: string;
  /** One line: the test that marks it done. */
  doneWhen: string;
  /** Label for the button that advances out of this stage. */
  advance: string;
  /**
   * The imperative label of the one action that clears this stage's blocker.
   * The stage itself registers the handler via useResolveAction; this is the
   * wording the sticky bar falls back to.
   */
  resolve: string;
}

export const FIELD_STAGE_SPECS: Record<FieldStageKey, FieldStageSpec> = {
  brief: {
    key: "brief",
    n: 0,
    label: "Brief",
    sub: "Intake",
    decides: "The question the programme exists to answer, and what counts as an answer.",
    doneWhen: "A source brief is committed, with any supporting context filed beside it.",
    advance: "Plan the programme",
    resolve: "Commit the brief",
  },
  plan: {
    key: "plan",
    n: 1,
    label: "Programme",
    sub: "AI plan",
    decides: "The dated shape of the work — phases, milestones, deliverables and method mix.",
    doneWhen: "A plan is approved and active, so everything downstream has dates to hang on.",
    advance: "Recruit the participants",
    resolve: "Approve the plan",
  },
  participants: {
    key: "participants",
    n: 2,
    label: "Participants",
    sub: "CRM",
    decides: "Who the programme will actually hear from, and on what consent.",
    doneWhen: "A panel for this programme holds at least one contact who has not declined.",
    advance: "Write the instrument",
    resolve: "Research candidates",
  },
  instruments: {
    key: "instruments",
    n: 3,
    label: "Instruments",
    sub: "Fieldcraft",
    decides: "What will be asked, in what order, and how the answers will be recorded.",
    doneWhen:
      "Every instrument the approved method mix requires is drafted against this programme.",
    advance: "Go to the field",
    resolve: "Draft the instruments",
  },
  fieldwork: {
    key: "fieldwork",
    n: 4,
    label: "Fieldwork",
    sub: "Collection",
    decides: "How the evidence is gathered — sessions held and returns collected.",
    doneWhen: "Returns are in: a response has landed, or a session has been held.",
    advance: "Synthesise the evidence",
    resolve: "Open the collection",
  },
  evidence: {
    key: "evidence",
    n: 5,
    label: "Evidence",
    sub: "Synthesis",
    decides: "What the programme now knows, with what confidence, and what follows from it.",
    doneWhen: "The field finding is synthesised and the programme is closed to the second brain.",
    advance: "Back to the chamber",
    resolve: "Synthesise the finding",
  },
};


export const FIELD_STAGE_LIST: FieldStageSpec[] = FIELD_STAGES.map((k) => FIELD_STAGE_SPECS[k]);

export function nextFieldStage(key: FieldStageKey): FieldStageKey | null {
  const i = FIELD_STAGES.indexOf(key);
  return i >= 0 && i < FIELD_STAGES.length - 1 ? (FIELD_STAGES[i + 1] as FieldStageKey) : null;
}

export function prevFieldStage(key: FieldStageKey): FieldStageKey | null {
  const i = FIELD_STAGES.indexOf(key);
  return i > 0 ? (FIELD_STAGES[i - 1] as FieldStageKey) : null;
}

/** What getFieldProgress reports for one stage. */
export interface FieldStageProgress {
  complete: boolean;
  /** Plain-language statement of the one thing still missing. */
  blocker: string | null;
  counts: Record<string, number>;
}

/** The synthesised field finding, in the shape Stage 05 renders. */
export interface FieldFinding {
  headline?: string;
  toplines?: Array<{ finding: string; evidence?: string; strength?: string }>;
  segments?: Array<{ segment: string; observation: string }>;
  quotes?: Array<{ quote: string; participant?: string; context?: string }>;
  tensions?: string[];
  implications?: string[];
  confidence?: { level?: string; why?: string; limitations?: string[] };
}

export interface FieldProgress {
  studyId: string | null;
  /** The synthesised field finding, when Stage 05 has produced one. */
  fieldFinding: FieldFinding | null;
  planActive: boolean;
  briefCommitted: boolean;
  stages: Record<FieldStageKey, FieldStageProgress>;
}
