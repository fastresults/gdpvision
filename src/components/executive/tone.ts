import type { Tone } from "@/lib/executive/types";

/**
 * Colour is reserved exclusively for state. A chamber with nothing wrong is
 * entirely monochrome, so risk is detectable in peripheral vision.
 */
export const TONE_TEXT: Record<Tone, string> = {
  neutral: "text-ink-950",
  positive: "text-[var(--signal-positive)]",
  caution: "text-[var(--signal-caution)]",
  negative: "text-[var(--signal-negative)]",
  quiet: "text-ink-300",
};

export const TONE_RULE: Record<Tone, string> = {
  neutral: "bg-line-200",
  positive: "bg-[var(--signal-positive)]",
  caution: "bg-[var(--signal-caution)]",
  negative: "bg-[var(--signal-negative)]",
  quiet: "bg-line-100",
};

export function relTime(iso: string | null): string {
  if (!iso) return "—";
  const ms = Date.now() - Date.parse(iso);
  if (Number.isNaN(ms)) return "—";
  const future = ms < 0;
  const abs = Math.abs(ms);
  const h = Math.floor(abs / 3_600_000);
  const d = Math.floor(abs / 86_400_000);
  const label = h < 1 ? "just now" : h < 24 ? `${h}h` : d < 60 ? `${d}d` : `${Math.floor(d / 30)}mo`;
  if (label === "just now") return label;
  return future ? `in ${label}` : `${label} ago`;
}

export function shortDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short" });
}
