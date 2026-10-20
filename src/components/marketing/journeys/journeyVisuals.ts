import type { ChamberJourney, StageDetail } from "../chamberDecisionJourneys";
import { evidenceChips, questionSignals, STAGE_PLAYBOOK } from "./journeyRouting";

export interface DecisionFrame {
  authority: string;
  horizon: string;
  exposures: string[];
  constraints: string[];
  success: string;
  decision: string;
}

const AUTHORITY: Record<string, string> = {
  "01": "Finance · Statistics Office",
  "02": "Prime Minister · Cabinet Secretary",
  "03": "Cabinet · Minister of Finance",
  "04": "Cabinet · Investment authority",
  "05": "Prime Minister · Cabinet Office",
  "06": "Cabinet · Cabinet Secretary",
  "07": "Prime Minister · Policy lead",
  "08": "Prime Minister · Delivery unit",
  "09": "Cabinet · Digital authority",
  "10": "Cabinet · Sector ministry",
};

const EXPOSURES: Record<string, string[]> = {
  "01": ["GDP", "Public budget", "Credibility"],
  "02": ["Delivery", "Public budget", "Responsibility"],
  "03": ["GDP", "Debt", "Jobs", "Foreign exchange"],
  "04": ["Investment", "Jobs", "Revenue"],
  "05": ["Credibility", "Essential services", "Public trust"],
  "06": ["Delivery", "Public budget", "Accountability"],
  "07": ["Public response", "Trust", "Implementation"],
  "08": ["Delivery", "Mandate", "Accountability"],
  "09": ["Service", "Trust", "Productivity"],
  "10": ["GDP", "Jobs", "Investment", "Imports"],
};

const CONSTRAINTS: Record<string, string[]> = {
  "01": ["Consistent official figures", "Up-to-date sources"],
  "02": ["Ministerial mandate", "Budget authority"],
  "03": ["Available budget", "Uncertain projections"],
  "04": ["Value for the country", "Legal requirements"],
  "05": ["Verified facts", "Lawful disclosure"],
  "06": ["Data readiness", "Cabinet approval"],
  "07": ["Representative audiences", "Government privacy rules"],
  "08": ["Approved government priorities", "Delivery capacity"],
  "09": ["Privacy from the start", "Service accessibility"],
  "10": ["Fundable projects", "Delivery capacity"],
};

const OPERATIONS: Record<string, string[]> = {
  "01": ["Define", "Check figures", "Trace", "Explain", "Defend"],
  "02": ["Read", "Map", "Connect", "Assign", "Commit"],
  "03": ["Set the starting point", "Test a disruption", "Estimate effects", "Compare", "Recommend"],
  "04": ["Measure", "Audit", "Target", "Prepare the offer", "Package"],
  "05": ["Detect", "Verify", "Position", "Challenge", "Authorise"],
  "06": ["Rank", "Check readiness", "Compare", "Record", "Assign"],
  "07": ["Frame", "Group profiles", "Simulate", "Find the problem", "Improve"],
  "08": ["Read", "Align", "Define", "Assign responsibility", "Review"],
  "09": ["Find the problem", "Set requirements", "Design", "Approve", "Measure"],
  "10": ["Read", "Prioritise", "Find the problem", "Build", "Commit"],
};

export function decisionFrame(journey: ChamberJourney): DecisionFrame {
  const [usual, accelerated] = journey.profile.clock;
  return {
    authority: AUTHORITY[journey.chamber],
    horizon: `${journey.profile.kind} response · ${usual} → ${accelerated}`,
    exposures: EXPOSURES[journey.chamber],
    constraints: CONSTRAINTS[journey.chamber],
    success: journey.outcome,
    decision: journey.profile.decision,
  };
}

export function stageOperation(journey: ChamberJourney, index: number) {
  return OPERATIONS[journey.chamber][index] ?? "Resolve";
}

export function stageFinding(journey: ChamberJourney, stage: StageDetail, index: number) {
  if (index === journey.stageDetail.length - 1) return journey.profile.decision;
  return stage.output.replace(/\.$/, "");
}

export function visualAudit(journey: ChamberJourney) {
  const frame = decisionFrame(journey);
  const chips = evidenceChips(journey);
  const signals = questionSignals(journey);
  const play = STAGE_PLAYBOOK[journey.chamber];
  return {
    frame,
    chips,
    signals,
    complete:
      Boolean(frame.authority && frame.success && frame.decision) &&
      chips.length > 0 &&
      signals.keywords.length > 0 &&
      play.length === 5 &&
      journey.stageDetail.length === 5,
  };
}