// @domain personas
// @tables —
// @ui src/components/personas/field/StageWizard.tsx; src/components/personas/field/StageFrame.tsx

// Chamber 07 · The sub-step spine.
//
// The rail (field-stages.ts) says which of the six stages you are in. This file
// says where you are INSIDE a stage: one decision per screen, in order, each
// with the sentence that explains why it exists, the test that says it is done,
// and the exact words on the button that leaves it.
//
// Nothing in the field surface may render a sub-step label that is not declared
// here — the breadcrumb, the chip rail, the stage rail counters and the footer
// all read this one map, so they can never disagree.

import type { FieldProgress, FieldStageKey } from "./field-stages";

export interface FieldSubStep {
  /** Stable key, used in ?sub= and in persisted resume points. */
  key: string;
  /** The verb the user performs. Never a noun of the system. */
  label: string;
  /** Why this screen exists, in one plain sentence. */
  why: string;
  /** What a good answer looks like when this screen is finished well. */
  goodLooksLike: string;
  /** The words on the one primary button. Names the outcome, never "Next". */
  primaryLabel: string;
  /** One line under the button: what pressing it actually does. */
  consequence: string;
  /** True when this screen no longer needs the user. Pure over progress. */
  isDone: (p: FieldProgress | undefined) => boolean;
}

/** Read one count off a stage without tripping over undefined. */
function n(p: FieldProgress | undefined, stage: FieldStageKey, key: string): number {
  return p?.stages?.[stage]?.counts?.[key] ?? 0;
}

export const FIELD_SUBSTEPS: Record<FieldStageKey, FieldSubStep[]> = {
  brief: [
    {
      key: "commit",
      label: "Write and commit the brief",
      why: "Everything downstream — the plan, the people, the questions — is derived from this one statement of the question.",
      goodLooksLike:
        "A single question the programme exists to answer, plus whatever context you already hold attached beside it.",
      primaryLabel: "Commit the brief",
      consequence: "This fixes the question of record and unlocks the programme plan.",
      isDone: (p) => !!p?.briefCommitted,
    },
  ],

  plan: [
    {
      key: "draft",
      label: "Let the chamber draft the programme",
      why: "The dated shape of the work is inferred from the brief, so you edit a proposal instead of inventing a schedule.",
      goodLooksLike:
        "A drafted programme with a window, phases, a method mix and named deliverables — close enough to argue with.",
      primaryLabel: "Review the draft",
      consequence: "Nothing is committed yet — the draft stays editable.",
      isDone: (p) => n(p, "plan", "drafted") > 0,
    },
    {
      key: "approve",
      label: "Approve the programme",
      why: "Participants, instruments and fieldwork are all scheduled against the approved plan, so it has to be settled first.",
      goodLooksLike:
        "One active plan whose dates you would be content to show the client.",
      primaryLabel: "Approve the plan",
      consequence: "This makes the plan active and unlocks participants, instruments and fieldwork.",
      isDone: (p) => !!p?.planActive,
    },
  ],

  participants: [
    {
      key: "find",
      label: "Find the people to hear from",
      why: "The programme is only as good as who answers it. The chamber researches real, named candidates against the brief before you touch a list.",
      goodLooksLike:
        "A slate of named people with organisations and roles that between them cover every group the brief cares about.",
      primaryLabel: "Take these people forward",
      consequence: "Accepted candidates land in the contact book, ready to form a panel.",
      isDone: (p) => n(p, "participants", "contacts") > 0,
    },
    {
      key: "panel",
      label: "Choose who is on the panel",
      why: "The contact book is everyone you know; the panel is who this programme will actually approach.",
      goodLooksLike:
        "One panel for this programme holding the people you intend to field to — no more, no fewer.",
      primaryLabel: "Form the panel",
      consequence: "This creates the panel this programme fields to.",
      isDone: (p) => n(p, "participants", "members") > 0,
    },
    {
      key: "consent",
      label: "Check you can reach them",
      why: "An invitation that has nowhere to go is a silent failure — better found now than in the field.",
      goodLooksLike:
        "Every panel member reachable, none opted out, and anyone who declined removed rather than ignored.",
      primaryLabel: "Confirm the panel is reachable",
      consequence: "This settles participants and moves you to the instruments.",
      isDone: (p) =>
        n(p, "participants", "members") > 0 &&
        n(p, "participants", "contactable") === n(p, "participants", "members"),
    },
  ],

  instruments: [
    {
      key: "draft",
      label: "Draft what the plan requires",
      why: "The approved method mix decides what must exist — a questionnaire for every survey line, a guide for every discussion.",
      goodLooksLike:
        "Every instrument the plan obliges is drafted from the brief, not from a blank page.",
      primaryLabel: "Read the draft",
      consequence: "Nothing is sent — the draft is yours to edit next.",
      isDone: (p) => n(p, "instruments", "required") > 0 && n(p, "instruments", "missing") === 0,
    },
    {
      key: "edit",
      label: "Edit the wording and the order",
      why: "A near-right draft is adjusted, never regenerated — your judgement about wording is the value here.",
      goodLooksLike:
        "Questions a participant would understand on first reading, in the order a conversation would take them.",
      primaryLabel: "Save the instrument",
      consequence: "This saves your edits and moves you to the coverage check.",
      isDone: (p) => n(p, "instruments", "questions") > 0,
    },
    {
      key: "coverage",
      label: "Check coverage before the field",
      why: "An objective with no question behind it produces a finding you cannot defend.",
      goodLooksLike:
        "Every objective served by at least one question, and the closing frontline block still in place.",
      primaryLabel: "Accept the coverage",
      consequence: "This settles the instruments and opens the field.",
      isDone: (p) => n(p, "instruments", "missing") === 0 && n(p, "instruments", "frontline") > 0,
    },
  ],

  fieldwork: [
    {
      key: "readout",
      label: "Read the field plan",
      why: "The approved plan already says what must be fielded, to whom and at what size — you work the ladder, you do not invent it.",
      goodLooksLike:
        "You can say out loud how many waves there are and what the first one is.",
      primaryLabel: "Start the first wave",
      consequence: "This takes you to the waves, one at a time.",
      isDone: (p) => n(p, "fieldwork", "waves") > 0,
    },
    {
      key: "waves",
      label: "Work the waves, one at a time",
      why: "Each wave is one piece of obliged work with its own single next move — invite, monitor, close.",
      goodLooksLike:
        "Every wave the plan obliges has actually closed, not merely started.",
      primaryLabel: "Check what came back",
      consequence: "This moves you to the returns check.",
      isDone: (p) =>
        n(p, "fieldwork", "waves") > 0 &&
        n(p, "fieldwork", "wavesComplete") === n(p, "fieldwork", "waves"),
    },
    {
      key: "returns",
      label: "Check what came back",
      why: "Synthesis is only as honest as the returns beneath it — thin returns should be known before they are read.",
      goodLooksLike:
        "Returns are in from across the panel, not concentrated in one group.",
      primaryLabel: "Close the field",
      consequence: "This ends collection and moves you to the evidence.",
      isDone: (p) => n(p, "fieldwork", "responses") > 0,
    },
  ],

  evidence: [
    {
      key: "landed",
      label: "See what landed",
      why: "Before reading a finding, know how much evidence it rests on.",
      goodLooksLike:
        "You know the number of returns and whether it is enough to speak with confidence.",
      primaryLabel: "Synthesise the finding",
      consequence: "The chamber reads every return and transcript and writes the finding.",
      isDone: (p) => n(p, "fieldwork", "responses") > 0,
    },
    {
      key: "synthesise",
      label: "Read the finding",
      why: "The finding is what the Cabinet will actually cite — toplines, tensions, quotes and an explicit confidence statement.",
      goodLooksLike:
        "A headline you would defend, with evidence under every topline and limitations stated rather than hidden.",
      primaryLabel: "Accept the finding",
      consequence: "This moves you to filing the programme.",
      isDone: (p) => n(p, "evidence", "synthesised") > 0,
    },
    {
      key: "file",
      label: "File it to the second brain",
      why: "A programme that is not filed cannot be found again — closing writes the memo into this country's corpus.",
      goodLooksLike:
        "The programme is closed and the memo is filed. Reopening later re-files over the same memo.",
      primaryLabel: "Close the programme",
      consequence: "This files the closing memo to this country's second brain.",
      isDone: (p) => n(p, "evidence", "closed") > 0,
    },
  ],
};

export function subStepsFor(stage: FieldStageKey): FieldSubStep[] {
  return FIELD_SUBSTEPS[stage] ?? [];
}

/** How many of a stage's sub-steps are done, and how many there are. */
export function subStepProgress(
  stage: FieldStageKey,
  p: FieldProgress | undefined,
): { done: number; total: number } {
  const steps = subStepsFor(stage);
  return { done: steps.filter((s) => s.isDone(p)).length, total: steps.length };
}

/** The whole programme in one number, so progress is felt rather than guessed. */
export function programmeProgress(p: FieldProgress | undefined): { done: number; total: number } {
  return (Object.keys(FIELD_SUBSTEPS) as FieldStageKey[]).reduce(
    (acc, stage) => {
      const s = subStepProgress(stage, p);
      return { done: acc.done + s.done, total: acc.total + s.total };
    },
    { done: 0, total: 0 },
  );
}

/** Where to land someone entering a stage: the first thing still needing them. */
export function firstOpenSubStep(
  stage: FieldStageKey,
  p: FieldProgress | undefined,
): string | null {
  const steps = subStepsFor(stage);
  return (steps.find((s) => !s.isDone(p)) ?? steps[steps.length - 1])?.key ?? null;
}
