// Plain-English replacements for macro-econ jargon used in Chamber 03.
// Ministers should never see words like "elasticity", "tornado",
// "compensation ledger", "attribution stack". Use this map when rendering
// labels in the default (non-analyst) surface.

export const MINISTER_LEXICON: Record<string, string> = {
  elasticity: "how sensitive",
  tornado: "biggest movers",
  "compensation ledger": "offsets",
  "attribution stack": "what drove the change",
  "sensitivity analysis": "how much it swings",
  "levered scenario": "policy move",
  "counterfactual": "do-nothing case",
  horizon: "time frame",
  "P50": "most likely",
  "P10": "worst plausible",
  "P90": "best plausible",
};

export function plainify(text: string): string {
  let out = text;
  for (const [k, v] of Object.entries(MINISTER_LEXICON)) {
    out = out.replace(new RegExp(`\\b${k}\\b`, "gi"), v);
  }
  return out;
}
