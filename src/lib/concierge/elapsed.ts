// Shared time-in-flight helpers for The Concierge. Every requester-facing
// surface (dashboard, list, reader) and the agency queue read from here so
// "days & hours" reads the same way everywhere.

export type ElapsedTone = "fresh" | "steady" | "overdue" | "done";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

function parse(input: string | Date | null | undefined): number | null {
  if (!input) return null;
  const t = input instanceof Date ? input.getTime() : Date.parse(input);
  return Number.isFinite(t) ? t : null;
}

/** "2d 4h", "6h 12m", "just now" */
export function elapsedLabel(
  from: string | Date | null | undefined,
  to: string | Date | null | undefined = new Date(),
): string {
  const a = parse(from);
  const b = parse(to);
  if (a === null || b === null) return "";
  const ms = Math.max(0, b - a);
  if (ms < 60 * 1000) return "just now";
  const days = Math.floor(ms / DAY);
  const hours = Math.floor((ms % DAY) / HOUR);
  const mins = Math.floor((ms % HOUR) / (60 * 1000));
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

/** "delivered in 1d 8h" */
export function turnaroundLabel(
  submitted: string | Date | null | undefined,
  delivered: string | Date | null | undefined,
): string | null {
  const a = parse(submitted);
  const b = parse(delivered);
  if (a === null || b === null) return null;
  return `delivered in ${elapsedLabel(submitted!, delivered!)}`;
}

/** Attention tone for an in-flight or completed request. */
export function elapsedTone(
  status: string,
  submittedAt: string | Date | null | undefined,
): ElapsedTone {
  if (["delivered", "accepted", "closed"].includes(status)) return "done";
  const a = parse(submittedAt);
  if (a === null) return "fresh";
  const ms = Date.now() - a;
  if (ms > 3 * DAY) return "overdue";
  if (ms > 1 * DAY) return "steady";
  return "fresh";
}

export function elapsedMillis(
  from: string | Date | null | undefined,
  to: string | Date | null | undefined = new Date(),
): number | null {
  const a = parse(from);
  const b = parse(to);
  if (a === null || b === null) return null;
  return Math.max(0, b - a);
}

/** Rolling average of delivered turnarounds, formatted as "1–2 days" or "hours". */
export function averageTurnaroundLabel(
  samples: Array<{ submitted_at: string | null; delivered_at: string | null }>,
): string | null {
  const durations = samples
    .map((s) => elapsedMillis(s.submitted_at, s.delivered_at))
    .filter((n): n is number => n !== null && n > 0);
  if (durations.length === 0) return null;
  const avgMs = durations.reduce((a, b) => a + b, 0) / durations.length;
  const days = avgMs / DAY;
  if (days < 1) {
    const hours = Math.max(1, Math.round(avgMs / HOUR));
    return `usually ${hours}h`;
  }
  const lo = Math.max(1, Math.floor(days));
  const hi = Math.max(lo, Math.ceil(days));
  return lo === hi ? `usually ${lo} day${lo === 1 ? "" : "s"}` : `usually ${lo}–${hi} days`;
}

/** Sensible per-type default when we have no history. */
export const DEFAULT_TURNAROUND: Record<string, string> = {
  ledger: "usually 1–2 days",
  scenario: "usually 2–3 days",
  fdi: "usually 2–4 days",
  narrative: "usually within 1 day",
  cabinet: "usually 1–2 days",
  persona: "usually 3–5 days",
  portfolio: "usually 2–3 days",
  other: "usually 1–3 days",
};
