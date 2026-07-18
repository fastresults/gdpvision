// Client-side playbook presets. Each preset takes the lever defs (from a live
// engine init call) and returns a fresh { slug: value } map derived from the
// bounds. Purely deterministic — no server round-trip.

import type { EngineInput } from "@/lib/engine/v1_macro";

type LeverDef = EngineInput["leverDefs"][number];

export type Playbook = {
  id: string;
  label: string;
  blurb: string;
  /** true for AI-suggested plays so the UI can badge them */
  ai?: boolean;
  /** optional thesis + citations for AI plays */
  thesis?: string;
  citations?: Array<{ label: string; kind: string; ref?: string }>;
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

/** Build a playbook from AI-generated lever moves (direction + magnitude 0..1). */
export function buildAiPlaybook(
  id: string,
  label: string,
  blurb: string,
  moves: Array<{ slug: string; direction: "up" | "down"; magnitude: number }>,
  thesis?: string,
  citations?: Playbook["citations"],
): Playbook {
  return {
    id,
    label,
    blurb,
    ai: true,
    thesis,
    citations,
    build: (defs) => {
      const out = defaults(defs);
      const bySlug = new Map(defs.map((d) => [d.slug, d]));
      for (const mv of moves) {
        const d = bySlug.get(mv.slug);
        if (!d) continue;
        const base = d.bounds.default ?? (d.bounds.min + d.bounds.max) / 2;
        const range = d.bounds.max - d.bounds.min;
        const mag = Math.max(0, Math.min(1, mv.magnitude));
        const fraction = (mv.direction === "up" ? 1 : -1) * mag;
        const target = base + fraction * range * 0.5;
        out[d.slug] = Math.max(d.bounds.min, Math.min(d.bounds.max, target));
      }
      return out;
    },
  };
}

/**
 * Compose multiple playbooks by summing their deltas from default and clamping
 * to bounds. Returns both the merged lever map and per-lever attribution
 * (which plays contributed how much).
 */
export function composePlaybooks(
  defs: LeverDef[],
  playbooks: Playbook[],
): {
  levers: Record<string, number>;
  attribution: Record<string, Array<{ id: string; label: string; delta: number }>>;
} {
  const base = defaults(defs);
  const summed: Record<string, number> = { ...base };
  const attribution: Record<string, Array<{ id: string; label: string; delta: number }>> = {};

  for (const p of playbooks) {
    const built = p.build(defs);
    for (const d of defs) {
      const delta = (built[d.slug] ?? base[d.slug]) - base[d.slug];
      if (Math.abs(delta) < 0.0001) continue;
      summed[d.slug] = (summed[d.slug] ?? base[d.slug]) + delta;
      (attribution[d.slug] ??= []).push({ id: p.id, label: p.label, delta });
    }
  }

  // Clamp
  for (const d of defs) {
    if (summed[d.slug] === undefined) continue;
    summed[d.slug] = Math.max(d.bounds.min, Math.min(d.bounds.max, summed[d.slug]));
  }

  return { levers: summed, attribution };
}
