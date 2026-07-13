// Map a sector hue_token / index to a semantic CSS color variable.
// hue_token values expected: "sector-01".."sector-12" (from public.sectors registry).
export function sectorColor(hueToken: string | null | undefined, fallbackIndex = 0): string {
  const t = (hueToken ?? "").trim();
  if (t) return `var(--${t})`;
  const n = ((fallbackIndex % 12) + 1).toString().padStart(2, "0");
  return `var(--sector-${n})`;
}
