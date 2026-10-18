// Chamber 05 — P1 guarantee. Pure: no I/O.
// Every country must hold one P1 GDP and one P1 political story after each scan.
// When none occurs naturally, the most important candidate is raised, searching
// P2, then P3, then P4 (never P5, noise, duplicates or dismissed).
import { priorityLevel } from "@/lib/public-data/media";

export type GuaranteeTopic = "gdp" | "politics";
export const SEARCH_LEVELS = [2, 3, 4] as const;

export interface GuaranteeSignal {
  id: string;
  recommendation: string | null;
  severity: number | null;
  reach: number | null;
  is_political: boolean | null;
  is_economic: boolean | null;
  priority_score: number | null;
  priority_override?: number | null;
  state?: string | null;
  review_verdict?: string | null;
  created_at: string;
}

export const naturalLevel = (s: GuaranteeSignal) => priorityLevel(s.recommendation, s.severity, s.reach);
const matches = (s: GuaranteeSignal, t: GuaranteeTopic) => (t === "gdp" ? !!s.is_economic : !!s.is_political);
const eligible = (s: GuaranteeSignal) =>
  s.review_verdict !== "noise" && s.state !== "duplicate" && s.state !== "dismissed";

export type GuaranteeOutcome =
  | { status: "natural"; id: string }
  | { status: "raised"; id: string; from: number }
  | { status: "gap" };

export function pickGuaranteedP1(signals: GuaranteeSignal[], topic: GuaranteeTopic): GuaranteeOutcome {
  const pool = signals.filter((s) => eligible(s) && matches(s, topic));
  const natural = pool.find((s) => naturalLevel(s) === 1);
  if (natural) return { status: "natural", id: natural.id };
  for (const lvl of SEARCH_LEVELS) {
    const c = pool
      .filter((s) => naturalLevel(s) === lvl)
      .sort(
        (a, b) =>
          (Number(b.priority_score) || 0) - (Number(a.priority_score) || 0) ||
          b.created_at.localeCompare(a.created_at),
      );
    if (c[0]) return { status: "raised", id: c[0].id, from: lvl };
  }
  return { status: "gap" };
}
