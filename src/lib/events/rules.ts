// Pure GDP Events rules shared by UI and tests. The database function
// `register_for_event` enforces the same rules atomically.

export type RegistrationWindow = "open" | "closed";

/** Registration closes at the cut-off, or at the start time when no cut-off is set. */
export function registrationWindow(
  ev: { starts_at: string; registration_close: string | null },
  now: Date = new Date(),
): RegistrationWindow {
  const close = new Date(ev.registration_close ?? ev.starts_at).getTime();
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

export function isUpcoming(ev: { starts_at: string; ends_at: string | null }, now: Date = new Date()) {
  return new Date(ev.ends_at ?? ev.starts_at).getTime() >= now.getTime();
}

export const EVENT_COLOURS = ["sea", "coral", "mango", "palm", "night"] as const;
export type EventColour = (typeof EVENT_COLOURS)[number];

export const FORMAT_LABEL: Record<string, string> = {
  in_person: "In person",
  online: "Online",
  hybrid: "Hybrid",
};
