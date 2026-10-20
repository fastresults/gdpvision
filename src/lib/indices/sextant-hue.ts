// Colour for a Sextant score (0–100) on the index cards' radar.
// Below 50: deep red → orange-red. 50–61: steady yellow. 62+: light green → deep green.

export const SEXTANT_YELLOW = "oklch(0.82 0.16 92)";

const clamp = (n: number) => Math.max(0, Math.min(100, n));
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const r3 = (n: number) => Math.round(n * 1000) / 1000;

export type SextantTone = "red" | "yellow" | "green";

export function sextantTone(score: number): SextantTone {
  const s = clamp(score);
  if (s < 50) return "red";
  if (s < 62) return "yellow";
  return "green";
}

/** OKLCH colour string. */
export function sextantHue(score: number): string {
  const s = clamp(score);
  if (s < 50) {
    const t = s / 49.999; // 0 deep red → 1 orange-red
    return `oklch(${r3(mix(0.38, 0.62, t))} ${r3(mix(0.15, 0.19, t))} ${r3(mix(25, 40, t))})`;
  }
  if (s < 62) return SEXTANT_YELLOW;
  const t = (s - 62) / 38; // 0 light green → 1 deep green
  return `oklch(${r3(mix(0.72, 0.4, t))} ${r3(mix(0.17, 0.12, t))} ${r3(mix(140, 150, t))})`;
}
