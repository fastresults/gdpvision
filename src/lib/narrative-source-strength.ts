// Chamber 05 — source strength (0–100) and tier S1–S5 from a feed's 30-day
// track record. Pure: no I/O. Raw counts come from narrative_source_raw_stats().

export interface SourceRaw {
  scope: string;
  active: boolean;
  consecutive_failures: number;
  reach_tier: number | null;
  admin_weight: number;
  outlet_credibility?: number | null;
  items: number;
  relevant: number;
  hits: number;
  primaries: number;
  followed: number;
  broken: number;
  dismissed: number;
  confirmed: number;
}

export const SOURCE_WEIGHTS = {
  reach: 25,
  hit: 25,
  influence: 20,
  first: 10,
  accuracy: 10,
  relevance: 10,
} as const;

/** Score used until a source has 30 articles of history. */
export const SOURCE_PRIOR = 40;
const FULL_SAMPLE = 30;

export const SOURCE_TIER_LABEL: Record<number, string> = {
  1: "S1 · Agenda-setter",
  2: "S2 · Major",
  3: "S3 · Standard",
  4: "S4 · Minor",
  5: "S5 · Low value",
};

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const r1 = (v: number) => Math.round(v * 10) / 10;
const rate = (n: number, d: number) => (d > 0 ? n / d : 0);

export function defaultReachTier(scope: string, outletCredibility?: number | null): number {
  if (outletCredibility) return clamp(outletCredibility, 1, 5);
  return scope === "international" ? 4 : 3;
}

export function tierFor(strength: number): 1 | 2 | 3 | 4 | 5 {
  if (strength >= 75) return 1;
  if (strength >= 55) return 2;
  if (strength >= 35) return 3;
  if (strength >= 20) return 4;
  return 5;
}

export function computeSourceStrength(s: SourceRaw) {
  const w = SOURCE_WEIGHTS;
  const reachTier = s.reach_tier ?? defaultReachTier(s.scope, s.outlet_credibility);
  const relevance_rate = rate(s.relevant, s.items);
  const hit_rate = rate(s.hits, s.relevant);
  const influence_rate = rate(s.followed, s.primaries);
  const first_rate = rate(s.primaries, s.relevant);
  const accuracy = s.relevant > 0 ? clamp(1 - (s.broken + s.dismissed * 2) / s.relevant, 0, 1) : 1;
  const raw =
    ((clamp(reachTier, 1, 5) - 1) / 4) * w.reach +
    hit_rate * w.hit +
    influence_rate * w.influence +
    first_rate * w.first +
    accuracy * w.accuracy +
    relevance_rate * w.relevance;
  const confidence = clamp(s.items / FULL_SAMPLE, 0, 1);
  let strength = SOURCE_PRIOR * (1 - confidence) + raw * confidence;
  strength *= clamp(s.admin_weight || 1, 0.5, 1.5);
  if (!s.active) strength *= 0.5;
  strength = r1(clamp(strength, 0, 100));
  const health = !s.active ? "off" : s.consecutive_failures >= 3 ? "failing" : "working";
  return {
    reach_tier: reachTier,
    relevance_rate: r1(relevance_rate * 100) / 100,
    hit_rate: r1(hit_rate * 100) / 100,
    influence_rate: r1(influence_rate * 100) / 100,
    first_rate: r1(first_rate * 100) / 100,
    accuracy: r1(accuracy * 100) / 100,
    per_day: r1(s.items / 30),
    strength,
    tier: tierFor(strength),
    health,
  };
}

/** Convert strength (0–100) to the 1–5 credibility used by the article score. */
export function credibilityFromStrength(strength: number): number {
  return clamp(1 + strength / 25, 1, 5);
}
