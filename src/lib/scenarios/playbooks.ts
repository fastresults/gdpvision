// Client-side playbook presets. Each preset takes the lever defs (from a live
// engine init call) and returns a fresh { slug: value } map derived from the
// bounds. Purely deterministic — no server round-trip.

import type { EngineInput } from "@/lib/engine/v1_macro";

type LeverDef = EngineInput["leverDefs"][number];

export type Playbook = {
  id: string;
  label: string;
  blurb: string;
  build: (defs: LeverDef[]) => Record<string, number>;
};

function defaults(defs: LeverDef[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const d of defs) out[d.slug] = d.bounds.default ?? d.bounds.min;
  return out;
}

function nudge(
  defs: LeverDef[],
  match: (d: LeverDef) => boolean,
  fraction: number, // -1..+1 of the bounds range from default
): Record<string, number> {
  const out = defaults(defs);
  for (const d of defs) {
    if (!match(d)) continue;
    const base = d.bounds.default ?? (d.bounds.min + d.bounds.max) / 2;
    const range = d.bounds.max - d.bounds.min;
    const target = base + fraction * range * 0.5;
    out[d.slug] = Math.max(d.bounds.min, Math.min(d.bounds.max, target));
  }
  return out;
}

export const PLAYBOOKS: Playbook[] = [
  {
    id: "baseline",
    label: "Baseline hold",
    blurb: "All levers at default. Reference case for comparison.",
    build: (defs) => defaults(defs),
  },
  {
    id: "cbi-winddown",
    label: "CBI wind-down",
    blurb: "Reduce CBI-linked levers; shift toward diversification.",
    build: (defs) =>
      nudge(
        defs,
        (d) =>
          d.slug.toLowerCase().includes("cbi") ||
          d.response_fn_ref === "v1_macro.exposure_delta",
        -0.6,
      ),
  },
  {
    id: "tourism-surge",
    label: "Tourism surge",
    blurb: "Aggressive tourism investment and marketing push.",
    build: (defs) =>
      nudge(
        defs,
        (d) => d.sector_code === "tourism" || d.slug.toLowerCase().includes("tour"),
        0.7,
      ),
  },
  {
    id: "agri-blue",
    label: "Agri & Blue Economy push",
    blurb: "Lift food security and fisheries capacity.",
    build: (defs) =>
      nudge(
        defs,
        (d) =>
          d.sector_code === "agriculture" ||
          d.sector_code === "blue-economy" ||
          d.slug.toLowerCase().includes("agri") ||
          d.slug.toLowerCase().includes("fish"),
        0.6,
      ),
  },
  {
    id: "fiscal-consolidation",
    label: "Fiscal consolidation",
    blurb: "Trim public spending; conservative posture across levers.",
    build: (defs) => nudge(defs, () => true, -0.25),
  },
];
