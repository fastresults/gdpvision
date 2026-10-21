// Server-only: mirror everything in GDP Events (Events Admin) into the Second Brain in one pass.
// Idempotent — re-runs update existing records and never create duplicates.
import { EVENT_BRAIN_KINDS, reconcile, type BrainRow, type LiveEvent } from "./brain-sync-rules";

export async function syncEventsToBrain(sb: any) {
  const { data: evs, error } = await sb
    .from("events")
    .select("slug, title, edition_label, tagline, summary, status, archived, country_code, city, venue, starts_at, ends_at, date_tba, registration_url, event_series(slug, name, site_url), event_sessions(title, position), event_speakers(name, role, organisation, position), event_partners(name, tier, url, position)");
  if (error) throw new Error(error.message);
  const byPos = (a: { position?: number }, b: { position?: number }) => (a.position ?? 0) - (b.position ?? 0);
  const live: LiveEvent[] = (evs ?? [])
    .filter((e: any) => e.status === "published" && !e.archived)
    .map((e: any) => ({
      slug: e.slug, title: e.title, edition_label: e.edition_label, tagline: e.tagline, summary: e.summary,
      country_code: e.country_code, city: e.city, venue: e.venue, starts_at: e.starts_at, ends_at: e.ends_at, date_tba: !!e.date_tba,
      registration_url: e.registration_url, series_slug: e.event_series?.slug ?? null, series_name: e.event_series?.name ?? null,
      site_url: e.event_series?.site_url ?? null,
      sessions: [...(e.event_sessions ?? [])].sort(byPos),
      speakers: [...(e.event_speakers ?? [])].sort(byPos),
      partners: [...(e.event_partners ?? [])].sort(byPos),
    }));

  const existing: BrainRow[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error: e2 } = await sb.from("memory_objects")
      .select("id, scope_key, sector_code, kind, title, payload, visibility, weight")
      .in("kind", EVENT_BRAIN_KINDS as unknown as string[]).order("id").range(from, from + 999);
    if (e2) throw new Error(e2.message);
    existing.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }

  const plan = reconcile(existing, live, new Date().toISOString());
  for (let i = 0; i < plan.inserts.length; i += 200) {
    const chunk = plan.inserts.slice(i, i + 200).map(({ id: _id, ...r }) => r);
    const { error: e3 } = await sb.from("memory_objects").insert(chunk);
    if (e3) throw new Error(e3.message);
  }
  for (const r of plan.updates) {
    const { error: e4 } = await sb.from("memory_objects").update({ title: r.title, payload: r.payload, visibility: r.visibility, updated_at: new Date().toISOString() }).eq("id", r.id);
    if (e4) throw new Error(e4.message);
  }
  return plan.summary;
}
