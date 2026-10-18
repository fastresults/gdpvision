// Chamber 05 — weighted importance score (0–100) for press signals.
// Pure: no I/O. Used by the harvester at insert time and by the UI to order
// signals within a P-level. P-levels themselves stay rule-based so the
// server-side counts (narrative_priority_level) and the UI always agree.

export interface PriorityInputs {
  severity: number; // 1–5
  reach: number; // 1–5
  is_political: boolean;
  is_economic: boolean;
  credibility: number; // 1–5 source credibility
  spread: number; // number of outlets carrying the story (≥1)
  mentions_government: boolean;
  age_hours: number;
}

export const PRIORITY_WEIGHTS = {
  urgency: 25,
  reach: 15,
  politics: 10,
  economy: 10,
  credibility: 15,
  spread: 10,
  government: 8,
  freshness: 7,
} as const;

export type PriorityFactors = Record<keyof typeof PRIORITY_WEIGHTS, number>;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const round1 = (v: number) => Math.round(v * 10) / 10;

export function computePriorityScore(i: PriorityInputs): {
  score: number;
  factors: PriorityFactors;
} {
  const w = PRIORITY_WEIGHTS;
  const factors: PriorityFactors = {
    urgency: round1(((clamp(i.severity, 1, 5) - 1) / 4) * w.urgency),
    reach: round1(((clamp(i.reach, 1, 5) - 1) / 4) * w.reach),
    politics: i.is_political ? w.politics : 0,
    economy: i.is_economic ? w.economy : 0,
    credibility: round1(((clamp(i.credibility, 1, 5) - 1) / 4) * w.credibility),
    spread: round1((clamp(i.spread - 1, 0, 4) / 4) * w.spread),
    government: i.mentions_government ? w.government : 0,
    freshness: round1(clamp(1 - i.age_hours / 72, 0, 1) * w.freshness),
  };
  const score = round1(Object.values(factors).reduce((a, b) => a + b, 0));
  return { score, factors };
}

/** Credibility of a source: official bodies 5, listed outlet value, else by feed scope. */
export function credibilityFor(opts: {
  domain: string | null;
  outletCredibility?: number | null;
  feedScope?: string | null;
}): number {
  if (opts.outletCredibility) return clamp(opts.outletCredibility, 1, 5);
  const d = (opts.domain ?? "").toLowerCase();
  if (/(^|\.)gov(\.|$)|\.gov\.[a-z]{2}$|centralbank|imf\.org|worldbank\.org/.test(d)) return 5;
  if (opts.feedScope === "international") return 4;
  return 3;
}
