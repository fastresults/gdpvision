// Pure GDP Events rules shared by UI and tests. The database function
// `register_for_event` enforces the same rules atomically.

export type RegistrationWindow = "open" | "closed";

/** Registration closes at the cut-off, or at the start time when no cut-off is set. */
export function registrationWindow(
  ev: { starts_at: string | null; registration_close: string | null },
  now: Date = new Date(),
): RegistrationWindow {
  const at = ev.registration_close ?? ev.starts_at;
  if (!at) return "open"; // dates to be announced: open for interest
  const close = new Date(at).getTime();
  return now.getTime() > close ? "closed" : "open";
}

/** A new registrant is confirmed while places remain, otherwise waitlisted. No cap = always confirmed. */
export function nextRegistrationStatus(capacity: number | null, confirmedTaken: number): "confirmed" | "waitlist" {
  if (capacity == null) return "confirmed";
  return confirmedTaken >= capacity ? "waitlist" : "confirmed";
}

export function placesLeft(capacity: number | null, confirmedTaken: number): number | null {
  if (capacity == null) return null;
  return Math.max(0, capacity - confirmedTaken);
}

/** Same email for the same event counts as one registration (case and spaces ignored). */
export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isUpcoming(ev: { starts_at: string | null; ends_at: string | null }, now: Date = new Date()) {
  const at = ev.ends_at ?? ev.starts_at;
  if (!at) return true; // dates to be announced count as upcoming
  return new Date(at).getTime() >= now.getTime();
}

/** Chronological order; events whose dates are still to be announced sort last. */
export function sortByDate<T extends { starts_at: string | null }>(list: T[]): T[] {
  return [...list].sort((a, b) => {
    if (!a.starts_at && !b.starts_at) return 0;
    if (!a.starts_at) return 1;
    if (!b.starts_at) return -1;
    return a.starts_at.localeCompare(b.starts_at);
  });
}

/** Imports match an existing edition on series + edition, so re-importing updates instead of copying. */
export function importKey(seriesSlug: string, edition: string): string {
  return `${seriesSlug.trim().toLowerCase()}::${edition.trim().toLowerCase()}`;
}
export function findExistingEdition<T extends { series_slug: string; edition_label: string | null }>(
  rows: T[],
  seriesSlug: string,
  edition: string,
): T | undefined {
  const k = importKey(seriesSlug, edition);
  return rows.find((r) => r.edition_label != null && importKey(r.series_slug, r.edition_label) === k);
}

/** Check-in is one-time: a second scan reports the earlier time rather than overwriting it. */
export function checkInDecision(r: { status: string; checked_in_at: string | null }): "ok" | "already" | "cancelled" {
  if (r.status === "cancelled") return "cancelled";
  return r.checked_in_at ? "already" : "ok";
}

export const EVENT_COLOURS = ["sea", "coral", "mango", "palm", "night"] as const;
export type EventColour = (typeof EVENT_COLOURS)[number];

export const FORMAT_LABEL: Record<string, string> = {
  in_person: "In person",
  online: "Online",
  hybrid: "Hybrid",
};
