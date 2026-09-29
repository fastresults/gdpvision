// @domain marketing
// @tables none
// @ui src/components/calculator/ValueCalculator.tsx, src/components/marketing/MarketingHome.tsx
//
// Shared proposal builder for the Decision Brief and homepage estimates.

import type { CountryFacts } from "./facts.server";
import { COUNTRY_PRESETS, DEFAULT_INPUT, type ValueInput } from "./model";

export const SEQUENCE_ADOPTION = [100, 75, 75, 50, 50, 50, 25, 25, 25, 0] as const;

export function proposeSequence(facts: CountryFacts | null): {
  order: string[];
  why: Record<string, string>;
} {
  const value = (key: string) => facts?.facts.find((fact) => fact.key === key)?.value ?? null;
  const grade = (key: string) =>
    facts?.facts.find((fact) => fact.key === key)?.grade ?? "assumption";
  const scored: Array<{ index: string; score: number; why: string }> = [
    {
      index: "01",
      score: 100,
      why: "One agreed set of numbers comes first; every other chamber reads from it.",
    },
    {
      index: "06",
      score: 60 + Math.min(30, (value("follow_through") ?? 35) * 0.6),
      why: `${value("follow_through") != null ? `${Math.round(value("follow_through") ?? 0)}% of open commitments are past due` : "Follow-through is unmeasured"}; a named owner and a standing record is the cheapest recovery of value.`,
    },
    {
      index: "10",
      score: 55 + Math.min(30, (value("sectors") ?? 30) * 0.8),
      why:
        grade("sectors") === "assumption"
          ? "No priority sectors are chosen yet; choosing few and planning them is the next decision."
          : `${Math.round(value("sectors") ?? 0)}% of output sits in priority sectors without an approved plan.`,
    },
    {
      index: "08",
      score:
        50 +
        (grade("latency") === "assumption"
          ? 20
          : Math.min(30, (value("latency") ?? 6) * 4)),
      why: "Pledges decomposed to ministry-owned deliverables and scored quarterly turn intent into completed work.",
    },
    {
      index: "02",
      score: 45 + Math.min(30, (100 - (value("standards") ?? 50)) * 0.5),
      why: `${value("standards") != null ? `${Math.round(value("standards") ?? 0)}% standards coverage` : "Standards coverage unknown"}; ministers who can see their own contribution reallocate at the margin.`,
    },
    {
      index: "09",
      score: 40 + (grade("government") === "assumption" ? 25 : 10),
      why:
        grade("government") === "assumption"
          ? "No government record or platform PRD yet; the public site is the citizen's first contact with the state."
          : "The platform can now be fed from the record rather than typed.",
    },
    {
      index: "04",
      score: 40 + Math.min(25, ((value("top_sector") ?? 40) - 25) * 0.8),
      why: `${value("top_sector") != null ? `${Math.round(value("top_sector") ?? 0)}% of output in one sector` : "Concentration unknown"}; readiness answered before investors ask.`,
    },
    {
      index: "03",
      score: 38,
      why: "Rehearsal before commitment prices the downside while it is still avoidable.",
    },
    { index: "05", score: 30, why: "A programme that is explained survives its first bad week." },
    {
      index: "07",
      score: 25,
      why: "A rehearsal instrument for how policy lands; last because it protects rather than creates value.",
    },
  ];
  scored.sort((a, b) => b.score - a.score);
  return {
    order: scored.map((item) => item.index),
    why: Object.fromEntries(scored.map((item) => [item.index, item.why])),
  };
}

export function proposedInputForCountry(
  code: string,
  facts: CountryFacts | null,
  base: ValueInput = DEFAULT_INPUT,
): ValueInput {
  const preset = COUNTRY_PRESETS.find((country) => country.code === code);
  const proposed = facts?.proposed;
  const sequence = proposeSequence(facts);

  return {
    ...base,
    stance: "central",
    gdpUsd: proposed?.gdpUsd?.value ?? preset?.gdpUsd ?? base.gdpUsd,
    publicSpendPct: proposed?.publicSpendPct?.value ?? preset?.publicSpendPct ?? base.publicSpendPct,
    topSectorSharePct:
      proposed?.topSectorSharePct?.value ?? preset?.topSectorSharePct ?? base.topSectorSharePct,
    decisionsPerQuarter: proposed?.decisionsPerQuarter?.value ?? base.decisionsPerQuarter,
    latencyMonths: proposed?.latencyMonths?.value ?? base.latencyMonths,
    unmeasuredPct: proposed?.unmeasuredPct?.value ?? base.unmeasuredPct,
    servicesOfflinePct: proposed?.servicesOfflinePct?.value ?? base.servicesOfflinePct,
    unplannedPrioritySharePct:
      proposed?.unplannedPrioritySharePct?.value ?? base.unplannedPrioritySharePct,
    chambers: Object.fromEntries(
      sequence.order.map((index, position) => [index, SEQUENCE_ADOPTION[position] ?? 0]),
    ),
  };
}