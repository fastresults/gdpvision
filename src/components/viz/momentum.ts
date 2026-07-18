// Pure helpers for sector trend visualization.
// No side effects, no data fetching — safe for both server and client.

export type MomentumLevel = "accelerating" | "steady" | "decelerating";
export type Bucket = { i: number; norm: number }; // norm in [0..1]

// Deterministic PRNG (Mulberry32) — stable across renders for the same seed.
function seededPrng(seed: number) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let x = t;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

/** Resample a real timeseries to N buckets, normalized 0..1. */
export function realToBuckets(points: { value: number }[], n = 24): Bucket[] {
  if (!points.length) return [];
  const vals: number[] = [];
  // Simple last-value-carry resample from evenly spaced source indices.
  for (let i = 0; i < n; i++) {
    const idx = Math.min(points.length - 1, Math.round((i / (n - 1)) * (points.length - 1)));
    vals.push(points[idx].value);
  }
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const range = max - min || 1;
  return vals.map((v, i) => ({ i, norm: (v - min) / range }));
}

/**
 * Synthesize a stable 24-bucket shape when no timeseries exists yet.
 * Uses (country, sector) as seed so bars don't flicker between renders and
 * are consistent for all viewers. Never surfaces as numeric values — only
 * bar heights and the derived momentum pill.
 */
export function syntheticBuckets(seedKey: string, opts: {
  latest: number | null;
  target: number | null;
  direction?: string; // "higher_is_better" | "lower_is_better"
  sharePct: number;
  n?: number;
}): Bucket[] {
  const n = opts.n ?? 24;
  const rng = seededPrng(hashString(seedKey) || 1);

  // Bias: if we have latest & target, bend the last third toward target.
  const higher = (opts.direction ?? "higher_is_better") !== "lower_is_better";
  let trendBias = 0;
  if (opts.latest != null && opts.target != null && opts.target !== 0) {
    const gap = (opts.target - opts.latest) / Math.abs(opts.target);
    trendBias = Math.max(-0.35, Math.min(0.35, gap * (higher ? 1 : -1)));
  } else {
    // Fall back to share_pct as a proxy for maturity; bigger sectors trend slightly up.
    trendBias = Math.max(-0.15, Math.min(0.15, (opts.sharePct - 10) / 100));
  }

  const base: number[] = [];
  let prev = 0.4 + rng() * 0.2;
  for (let i = 0; i < n; i++) {
    const drift = (rng() - 0.5) * 0.12; // small noise
    const pull = trendBias * (i / (n - 1)); // progressive pull
    prev = Math.max(0.05, Math.min(0.98, prev * 0.85 + (0.5 + pull) * 0.15 + drift));
    base.push(prev);
  }
  const min = Math.min(...base);
  const max = Math.max(...base);
  const range = max - min || 1;
  return base.map((v, i) => ({ i, norm: (v - min) / range }));
}

/** Compute momentum from the last 12 buckets: slope of last 6 vs previous 6. */
export function computeMomentum(buckets: Bucket[]): { level: MomentumLevel; delta: number } {
  if (buckets.length < 4) return { level: "steady", delta: 0 };
  const tail = buckets.slice(-12);
  const half = Math.floor(tail.length / 2);
  const avg = (xs: Bucket[]) => xs.reduce((a, b) => a + b.norm, 0) / (xs.length || 1);
  const a = avg(tail.slice(0, half));
  const b = avg(tail.slice(half));
  const delta = b - a;
  if (delta > 0.05) return { level: "accelerating", delta };
  if (delta < -0.05) return { level: "decelerating", delta };
  return { level: "steady", delta };
}

/**
 * Risk 0..3 — how many dots to light red/amber.
 * Combines momentum direction (given KPI direction), gap-to-target, and freshness.
 */
export function computeRisk(opts: {
  momentum: MomentumLevel;
  direction?: string; // higher_is_better | lower_is_better
  latest: number | null;
  target: number | null;
  freshness?: string | null; // fresh | stale | unknown
}): number {
  let risk = 0;
  const higher = (opts.direction ?? "higher_is_better") !== "lower_is_better";
  const badMomentum = higher ? opts.momentum === "decelerating" : opts.momentum === "accelerating";
  if (badMomentum) risk += 1;

  if (opts.latest != null && opts.target != null && opts.target !== 0) {
    const gap = (opts.target - opts.latest) / Math.abs(opts.target);
    const missing = higher ? gap > 0.1 : gap < -0.1;
    if (missing) risk += 1;
  }

  if (opts.freshness && opts.freshness !== "fresh") risk += 1;
  return Math.max(0, Math.min(3, risk));
}

/** Confidence 0..100 from confidence_grade + freshness + target presence. */
export function computeConfidence(opts: {
  grade?: string | null;
  freshness?: string | null;
  hasTarget: boolean;
  hasSeries: boolean;
}): number {
  const base = ({ A: 90, B: 78, C: 66, D: 52 } as Record<string, number>)[
    (opts.grade ?? "C").toUpperCase()
  ] ?? 60;
  let score = base;
  if (opts.freshness === "fresh") score += 4;
  if (opts.freshness === "stale") score -= 4;
  if (opts.hasTarget) score += 2;
  if (opts.hasSeries) score += 4;
  return Math.max(20, Math.min(99, Math.round(score)));
}

export function momentumLabel(m: MomentumLevel): string {
  return m === "accelerating" ? "Accelerating" : m === "decelerating" ? "Decelerating" : "Steady";
}
