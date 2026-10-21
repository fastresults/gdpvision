// Server-only: deep read of a summit website (every same-site page) + AI extraction
// + idempotent apply to the edition and the Second Brain (memory_objects).
import { fillBlank, partnerKey, pickPages, sessionKey, speakerKey, uniqueBy } from "./deep-scrape-rules";

const FC = "https://api.firecrawl.dev/v2";
const MODEL = "openai/gpt-6-astra";

export type Page = { url: string; markdown: string };
export type Extracted = {
  title: string; tagline: string; summary: string; date_text: string; starts_on: string; ends_on: string;
  venue_name: string; venue_address: string; city: string; country_iso3: string; registration_url: string;
  contact_email: string; hashtags: string[]; socials: string[]; themes: string[]; countries_covered: string[];
  sessions: { day: string; time: string; title: string; description: string; speakers: string[]; source_url: string }[];
  speakers: { name: string; role: string; organisation: string; photo_url: string; bio: string; source_url: string }[];
  partners: { name: string; tier: string; logo_url: string; url: string; source_url: string }[];
  tickets: { name: string; price: string; notes: string }[];
  faqs: { question: string; answer: string }[];
  images: { url: string; caption: string }[];
  conflicts: string[];
};

async function scrape(url: string, links = false): Promise<{ markdown: string; links: string[] }> {
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key) throw new Error("The website reader is not connected.");
  const res = await fetch(`${FC}/scrape`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ url, formats: links ? ["markdown", "links"] : ["markdown"], onlyMainContent: false, waitFor: 4000 }),
  });
  const t = await res.text();
  if (!res.ok) throw new Error(`Website reader ${res.status}: ${t.slice(0, 200)}`);
  const j = JSON.parse(t);
  return { markdown: j.data?.markdown ?? "", links: j.data?.links ?? [] };
}

export async function readWholeSite(start: string, single = false): Promise<Page[]> {
  // Follow redirects (e.g. cis27.com → caribbeaninvestmentsummit.com) so same-site links are recognised.
  let home = start;
  try { const r = await fetch(start, { redirect: "follow" }); if (r.url) home = r.url.replace(/\/+$/, ""); } catch { /* keep start */ }
  const first = await scrape(home, true);
  if (single) return [{ url: home, markdown: first.markdown }];
  const urls = pickPages(home, first.links).slice(1);
  const pages: Page[] = [{ url: home, markdown: first.markdown }];
  for (let i = 0; i < urls.length; i += 4) {
    const batch = await Promise.all(urls.slice(i, i + 4).map(async (u) => {
      try { return { url: u, markdown: (await scrape(u)).markdown }; } catch { return null; }
    }));
    for (const p of batch) if (p && p.markdown.trim()) pages.push(p);
  }
  return pages;
}

const S = { type: "string" } as const;
const A = (items: object) => ({ type: "array", items }) as const;
const O = (props: Record<string, object>) => ({ type: "object", additionalProperties: false, required: Object.keys(props), properties: props });
const SCHEMA = O({
  title: S, tagline: S, summary: S, date_text: S, starts_on: S, ends_on: S, venue_name: S, venue_address: S, city: S,
  country_iso3: S, registration_url: S, contact_email: S, hashtags: A(S), socials: A(S), themes: A(S), countries_covered: A(S),
  sessions: A(O({ day: S, time: S, title: S, description: S, speakers: A(S), source_url: S })),
  speakers: A(O({ name: S, role: S, organisation: S, photo_url: S, bio: S, source_url: S })),
  partners: A(O({ name: S, tier: S, logo_url: S, url: S, source_url: S })),
  tickets: A(O({ name: S, price: S, notes: S })),
  faqs: A(O({ question: S, answer: S })),
  images: A(O({ url: S, caption: S })),
  conflicts: A(S),
});

async function readSse(body: ReadableStream<Uint8Array>): Promise<string> {
  const r = body.getReader(); const d = new TextDecoder(); let buf = ""; let out = ""; let done = "";
  for (;;) {
    const { value, done: end } = await r.read(); if (end) break;
    buf += d.decode(value, { stream: true }); let i;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
      if (!line.startsWith("data:")) continue;
      try {
        const ev = JSON.parse(line.slice(5).trim());
        if (ev.type === "response.output_text.delta" && ev.delta) out += ev.delta;
        if (ev.type === "response.completed" && ev.response?.output_text) done = ev.response.output_text;
      } catch { /* ignore */ }
    }
  }
  return out || done;
}

export async function extractSummit(pages: Page[]): Promise<Extracted> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("Lovable AI is not configured.");
  const corpus = pages.map((p) => `=== PAGE ${p.url} ===\n${p.markdown.slice(0, 14000)}`).join("\n\n").slice(0, 120000);
  const prompt = `You read every page of one summit website. Extract ONLY facts the pages state. Use "" or [] for anything not stated — never guess, never fill in from general knowledge.
- starts_on/ends_on: ISO date YYYY-MM-DD only when the site states the full date; else "".
- country_iso3: ISO 3166 alpha-3 of the host venue country, only if stated.
- source_url: the PAGE url the item was read from.
- images/photo_url/logo_url: absolute image URLs that appear in the pages; skip icons.
- speakers: real named people only (not "TBA"). partners: named organisations shown as partners/sponsors/hosts.
- conflicts: list any contradictions between pages (e.g. two different venues or dates).

${corpus}`;
  const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "fetch" },
    body: JSON.stringify({ model: MODEL, input: prompt, stream: true, store: false, reasoning: { effort: "low" },
      text: { format: { type: "json_schema", name: "summit", strict: true, schema: SCHEMA } } }),
  });
  if (!res.ok || !res.body) throw new Error(`AI ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
  return JSON.parse(await readSse(res.body)) as Extracted;
}

const SECTOR: Record<string, string> = {
  "blue-economy": "blue_economy", cgdps: "cross", cadis: "digital", chis: "housing", cafs: "agriculture",
  ceis: "energy", cbis: "commerce", chwis: "health", cis: "finance",
};
const iso = (d: string) => (/^\d{4}-\d{2}-\d{2}$/.test(d) ? `${d}T12:00:00Z` : null);
const https = (u: string) => (/^https:\/\//.test(u) ? u : null);

/** Apply an extraction to the series' latest edition and the Second Brain. Idempotent. */
export async function applySummit(sb: any, seriesId: string, x: Extracted, pages: Page[], eventId?: string) {
  const { data: series } = await sb.from("event_series").select("id, slug, name, site_url").eq("id", seriesId).single();
  const { data: ev } = eventId
    ? await sb.from("events").select("*").eq("id", eventId).eq("series_id", seriesId).maybeSingle()
    : await sb.from("events").select("*").eq("series_id", seriesId).eq("archived", false)
        .order("starts_at", { ascending: false, nullsFirst: true }).limit(1).maybeSingle();
  if (!series || !ev) throw new Error("No edition found for this summit.");

  const patch: Record<string, unknown> = {
    tagline: fillBlank(ev.tagline, x.tagline),
    summary: fillBlank(ev.summary, x.summary),
    venue: fillBlank(ev.venue, [x.venue_name, x.venue_address].filter(Boolean).join(", ")),
    city: fillBlank(ev.city, x.city),
    country_code: fillBlank(ev.country_code, x.country_iso3),
    registration_url: fillBlank(ev.registration_url, https(x.registration_url)),
    hero_url: fillBlank(ev.hero_url, https(x.images[0]?.url ?? "")),
    imported_at: new Date().toISOString(),
  };
  if (!ev.starts_at && iso(x.starts_on)) { patch.starts_at = iso(x.starts_on); patch.ends_at = iso(x.ends_on) ?? iso(x.starts_on); patch.date_tba = false; }
  const body = [
    x.themes.length ? `**Themes:** ${x.themes.join(", ")}` : "",
    x.tickets.length ? `**Tickets:**\n${x.tickets.map((t) => `- ${t.name}${t.price ? ` — ${t.price}` : ""}${t.notes ? ` (${t.notes})` : ""}`).join("\n")}` : "",
    x.faqs.length ? `**FAQ**\n${x.faqs.map((f) => `- **${f.question}** ${f.answer}`).join("\n")}` : "",
    x.contact_email ? `**Contact:** ${x.contact_email}` : "",
  ].filter(Boolean).join("\n\n");
  if (!ev.body && body) patch.body = body;
  await sb.from("events").update(patch).eq("id", ev.id);

  // Sessions (no unique index: match on day+time+title)
  const { data: curS } = await sb.from("event_sessions").select("id, title, description, starts_at, position").eq("event_id", ev.id);
  const have = new Set((curS ?? []).map((s: any) => sessionKey("", "", s.title)));
  const sessions = uniqueBy(x.sessions.filter((s) => s.title.trim()), (s) => sessionKey(s.day, s.time, s.title));
  let pos = (curS ?? []).length; let nS = 0;
  for (const s of sessions) {
    if (have.has(sessionKey("", "", s.title))) continue;
    const label = [s.day, s.time].filter(Boolean).join(" · ");
    await sb.from("event_sessions").insert({ event_id: ev.id, position: pos++, title: s.title.slice(0, 300),
      description: [label, s.description].filter(Boolean).join(" — ").slice(0, 2000) || null, speaker_names: s.speakers.slice(0, 20) });
    nS++;
  }
  const speakers = uniqueBy(x.speakers.filter((s) => s.name.trim()), (s) => speakerKey(s.name, s.organisation));
  let nSp = 0;
  for (const [i, s] of speakers.entries()) {
    const { error } = await sb.from("event_speakers").upsert({ event_id: ev.id, position: i, name: s.name.trim().slice(0, 200),
      role: s.role || null, organisation: s.organisation || null, photo_url: https(s.photo_url) }, { onConflict: "event_id,name" });
    if (!error) nSp++;
  }
  const partners = uniqueBy(x.partners.filter((p) => p.name.trim()), (p) => partnerKey(p.name));
  let nP = 0;
  for (const [i, p] of partners.entries()) {
    const { error } = await sb.from("event_partners").upsert({ event_id: ev.id, position: i, name: p.name.trim().slice(0, 200),
      tier: p.tier || null, logo_url: https(p.logo_url), url: https(p.url) }, { onConflict: "event_id,name" });
    if (!error) nP++;
  }
  const imgs = uniqueBy(x.images.filter((m) => https(m.url)), (m) => m.url).slice(0, 24);
  let nM = 0;
  for (const [i, m] of imgs.entries()) {
    const { error } = await sb.from("event_media").upsert({ event_id: ev.id, kind: "photo", url: m.url, caption: m.caption || null,
      credit: series.name, position: i }, { onConflict: "event_id,url" });
    if (!error) nM++;
  }

  // Second Brain — public, deduped on (scope_key, sector, kind, title)
  const scope = (x.country_iso3 || ev.country_code || "REGION").toUpperCase().slice(0, 6);
  const sector = SECTOR[series.slug] ?? "cross";
  const sources = pages.map((p) => p.url);
  const rows: { kind: string; title: string; payload: unknown; weight: number }[] = [
    { kind: "event", title: `${ev.title} (${ev.edition_label ?? ""})`.trim(), weight: 4, payload: {
      series: series.slug, edition: ev.edition_label, event_slug: ev.slug, site_url: series.site_url, date_text: x.date_text,
      starts_on: x.starts_on, ends_on: x.ends_on, venue: [x.venue_name, x.venue_address].filter(Boolean).join(", "),
      summary: x.summary, themes: x.themes, countries_covered: x.countries_covered, hashtags: x.hashtags, socials: x.socials,
      conflicts: x.conflicts, sources, captured_at: new Date().toISOString() } },
    ...x.themes.slice(0, 15).map((t) => ({ kind: "event_topic", title: `${series.name}: ${t}`, weight: 2, payload: { series: series.slug, event_slug: ev.slug, topic: t, sources } })),
    ...speakers.map((s) => ({ kind: "event_speaker", title: `${s.name}${s.organisation ? ` — ${s.organisation}` : ""}`, weight: 2,
      payload: { name: s.name, role: s.role, organisation: s.organisation, bio: s.bio, events: [ev.slug], source_url: s.source_url } })),
    ...partners.map((p) => ({ kind: "event_partner", title: p.name, weight: 2, payload: { name: p.name, tier: p.tier, url: p.url, events: [ev.slug], source_url: p.source_url } })),
  ];
  let nB = 0;
  for (const r of rows) {
    const { data: ex } = await sb.from("memory_objects").select("id, payload").eq("scope_key", scope).eq("sector_code", sector).eq("kind", r.kind).eq("title", r.title).maybeSingle();
    if (ex) {
      const prevEvents = (ex.payload?.events ?? []) as string[];
      const payload = (r.payload as any).events ? { ...(r.payload as any), events: [...new Set([...prevEvents, ev.slug])] } : r.payload;
      await sb.from("memory_objects").update({ payload, visibility: "public" }).eq("id", ex.id);
    } else {
      await sb.from("memory_objects").insert({ scope_key: scope, sector_code: sector, kind: r.kind, title: r.title.slice(0, 300), payload: r.payload, weight: r.weight, visibility: "public" });
    }
    nB++;
  }
  return { event_slug: ev.slug, pages: pages.length, sessions_added: nS, speakers: nSp, partners: nP, photos: nM, brain_records: nB, conflicts: x.conflicts };
}

/** Deep-read a series. With `edition`, read that edition's own page (e.g. an archive page) and apply to it. */
export async function deepScrapeSeries(sb: any, seriesId: string, apply: boolean, edition?: { eventId: string; url: string }) {
  const { data: series } = await sb.from("event_series").select("id, site_url").eq("id", seriesId).single();
  if (!series) throw new Error("Series not found.");
  const pages = edition ? await readWholeSite(edition.url, true) : await readWholeSite(series.site_url);
  const extracted = await extractSummit(pages);
  const { data: snap } = await sb.from("event_site_snapshots").insert({ series_id: seriesId,
    extracted: { kind: "deep", pages: pages.map((p) => ({ url: p.url, chars: p.markdown.length })), data: extracted } }).select("id").single();
  await sb.from("event_series").update({ last_synced_at: new Date().toISOString() }).eq("id", seriesId);
  const counts = { pages: pages.length, sessions: extracted.sessions.length, speakers: extracted.speakers.length, partners: extracted.partners.length, photos: extracted.images.length, conflicts: extracted.conflicts };
  if (!apply) return { snapshot_id: snap?.id as string, found: counts, extracted };
  const result = await applySummit(sb, seriesId, extracted, pages, edition?.eventId);
  await sb.from("event_site_snapshots").update({ applied: true }).eq("id", snap?.id);
  return { snapshot_id: snap?.id as string, found: counts, applied: result };
}
