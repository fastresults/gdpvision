// @domain explain
// @tables none
// @ui src/routes/_authenticated/admin/countries.$code.scenarios.new.tsx
//
// Rationale entries for Chamber 03 (Scenario Engine). These explain what the
// projection figures mean and how the engine arrives at them — they never
// recompute anything, so the modal cannot disagree with the strip.

import { registerRationales, type Rationale } from "@/lib/explain/registry";

const entries: Array<Rationale<never>> = [
  {
    key: "scenario.p50",
    title: "P50 GDP growth",
    short:
      "The central projected growth rate for that year, with your levers applied to the baseline path.",
    formula:
      "P50 = baseline growth for the year + the summed effect of every lever off its default, damped by the lever's sector weight and its ramp for that year.",
    basis:
      "The baseline is the country's own recorded growth path in the ledger. Lever coefficients are stated in the lever definition and visible in the levers drawer — nothing in the projection is hidden from the operator.",
    caveat:
      "Move a lever back to its default and the figure returns to baseline. The projection is a decision-framing path, not a forecast of what will occur.",
  },
  {
    key: "scenario.band",
    title: "The P10 / P90 band",
    short:
      "The 80 per cent interval around the central estimate — where the outcome is likely to land.",
    formula:
      "P10 and P90 are the pessimistic and optimistic tails produced by varying each lever's coefficient across its stated uncertainty range.",
    basis:
      "A single number invites false confidence. The band is what makes the projection honest: the wider it is, the less the evidence supports acting on the midpoint alone.",
    caveat:
      "Levers with thin evidence widen the band faster than levers with strong evidence. A wide band is a signal to commission research, not to abandon the play.",
  },
  {
    key: "scenario.net_vs_baseline",
    title: "Net versus baseline · cumulative",
    short:
      "Total percentage points of growth gained or given up across the whole horizon, against doing nothing.",
    formula:
      "Sum of (scenario P50 − baseline P50) for every year in the horizon, expressed in percentage points.",
    basis:
      "Year-by-year deltas flatter short-dated plays and punish slow-ramping ones. The cumulative figure is what a Cabinet is actually choosing between.",
    caveat:
      "A deficit here can still be the right choice when the play buys resilience rather than growth. Read it beside the compensation ledger.",
  },
  {
    key: "scenario.break_even",
    title: "Break-even year",
    short:
      "The first year in which cumulative gains overtake the cumulative cost of the play.",
    formula:
      "The earliest year where the running sum of positive deltas exceeds the running sum of negative deltas.",
    basis:
      "Most credible plays cost growth before they add it. Naming the year the trade turns is the honest way to present that.",
    caveat: "Shown only once the scenario is in surplus over the horizon.",
  },
  {
    key: "scenario.levers_off_default",
    title: "Levers off default",
    short: "How many levers you have moved away from the recorded baseline setting.",
    formula: "A count of levers whose current value differs from the baseline value.",
    basis:
      "Scenario quality falls as lever count rises — each additional lever compounds uncertainty into the band and dilutes accountability for the outcome.",
    caveat:
      "Three to five well-evidenced levers usually beat a dozen speculative ones.",
  },
];

registerRationales(entries);

export default entries;
