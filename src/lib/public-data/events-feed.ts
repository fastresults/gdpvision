// Pure shaping rules for the GDP Events partner feed. Registrations / attendee data are never part of it.
export const PUBLIC_EVENT_BRAIN_EXCLUDE = ["event", "event_topic", "event_speaker", "event_partner"];

export type FeedEdition = {
  slug: string; status: string; archived: boolean; starts_at: string | null;
  [k: string]: unknown;
};

/** Only published, non-archived editions ever leave GDPVision. */
export function publicEditions<T extends FeedEdition>(rows: T[], upcomingOnly = false, now = new Date()): T[] {
  return rows.filter((e) => e.status === "published" && !e.archived && (!upcomingOnly || !e.starts_at || new Date(e.starts_at) >= now));
}

/** Strip internal columns before an edition leaves GDPVision. */
export function shapeEdition(e: Record<string, any>) {
  const { status: _s, archived: _a, created_by: _c, is_placeholder: _p, event_registrations: _r, id: _id, series_id: _sid, ...rest } = e;
  const byPos = (a: any, b: any) => (a.position ?? 0) - (b.position ?? 0);
  return {
    ...rest,
    series: e.event_series ?? null,
    event_series: undefined,
    event_sessions: [...(e.event_sessions ?? [])].sort(byPos),
    event_speakers: [...(e.event_speakers ?? [])].sort(byPos),
    event_partners: [...(e.event_partners ?? [])].sort(byPos),
    event_media: [...(e.event_media ?? [])].sort(byPos),
    url: `https://gdpvision.com/events/${e.slug}`,
  };
}

export type RegisterResult = { outcome: string; status?: string };
/** HTTP status for a registration outcome. */
export function registerStatus(r: RegisterResult): number {
  switch (r.outcome) {
    case "ok": return 201;
    case "duplicate": return 200;
    case "not_found": return 404;
    case "closed": return 409;
    default: return 422;
  }
}
