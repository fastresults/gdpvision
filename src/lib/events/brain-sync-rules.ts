// Pure rules for mirroring GDP Events into the Second Brain (memory_objects).
// Events Admin is the source of truth: only published, non-archived editions are public in the brain;
// records for drafts, archived or deleted editions are hidden (visibility "private"), never deleted.
import { norm } from "./deep-scrape-rules";

export const EVENT_BRAIN_KINDS = ["event", "event_topic", "event_speaker", "event_partner"] as const;

/** Summit series → Second Brain sector. */
export const SERIES_SECTOR: Record<string, string> = {
  "blue-economy": "blue_economy", cgdps: "cross", cadis: "digital", chis: "housing", cafs: "agriculture",
  ceis: "energy", cbis: "commerce", chwis: "health", cis: "finance",
};

const ISO2: Record<string, string> = {
  AG: "ATG", AI: "AIA", AW: "ABW", BB: "BRB", BM: "BMU", BS: "BHS", BZ: "BLZ", CU: "CUB", CW: "CUW", DM: "DMA",
  DO: "DOM", GD: "GRD", GY: "GUY", HT: "HTI", JM: "JAM", KN: "KNA", KY: "CYM", LC: "LCA", MS: "MSR", PR: "PRI",
  SR: "SUR", SX: "SXM", TC: "TCA", TT: "TTO", VC: "VCT", VG: "VGB", VI: "VIR",
};

/** Normalise a country code to the ISO3 scope the brain uses; unknown → "REGION". */
export function brainScope(code: string | null | undefined): string {
  const c = (code ?? "").trim().toUpperCase();
  if (/^[A-Z]{3}$/.test(c)) return c;
  return ISO2[c] ?? "REGION";
}

export const eventTitle = (title: string, edition: string | null) => `${title} (${edition ?? ""})`.replace(/\s*\(\)$/, "").trim();
export const speakerTitle = (name: string, org: string | null) => `${name.trim()}${org?.trim() ? ` — ${org.trim()}` : ""}`;

export type BrainRow = {
  id?: string;
  scope_key: string;
  sector_code: string;
  kind: string;
  title: string;
  payload: Record<string, any>;
  visibility: "public" | "private";
  weight: number;
};

export type LiveEvent = {
  slug: string; title: string; edition_label: string | null; tagline: string | null; summary: string | null;
  country_code: string | null; city: string | null; venue: string | null;
  starts_at: string | null; ends_at: string | null; date_tba: boolean;
  registration_url: string | null; series_slug: string | null; series_name: string | null; site_url: string | null;
  sessions: { title: string }[];
  speakers: { name: string; role: string | null; organisation: string | null }[];
  partners: { name: string; tier: string | null; url: string | null }[];
};

const key = (r: Pick<BrainRow, "scope_key" | "sector_code" | "kind" | "title">) => `${r.scope_key}|${r.sector_code}|${r.kind}|${r.title}`;

function dateText(e: LiveEvent): string {
  if (!e.starts_at) return "Dates to be announced";
  const s = e.starts_at.slice(0, 10);
  const f = (e.ends_at ?? e.starts_at).slice(0, 10);
  return s === f ? s : `${s} to ${f}`;
}

/**
 * Work out what the Second Brain should look like for the given published editions.
 * `live` must contain only published, non-archived editions. Returns rows to insert and rows to update.
 */
export function reconcile(existing: BrainRow[], live: LiveEvent[], now: string) {
  const state = new Map<string, BrainRow>();
  const before = new Map<string, string>();
  for (const r of existing) {
    state.set(key(r), { ...r, payload: { ...(r.payload ?? {}) } });
    if (r.id) before.set(r.id, JSON.stringify([r.payload, r.visibility, r.title]));
  }
  const liveSlugs = new Set(live.map((e) => e.slug));
  const member = new Set<string>();
  for (const e of live) {
    for (const s of e.speakers) member.add(`${e.slug}|event_speaker|${norm(s.name)}`);
    for (const p of e.partners) member.add(`${e.slug}|event_partner|${norm(p.name)}`);
  }

  // 1. Hide or trim what no longer matches a published edition.
  for (const r of state.values()) {
    if (r.kind === "event" || r.kind === "event_topic") {
      r.visibility = liveSlugs.has(String(r.payload.event_slug ?? "")) ? "public" : "private";
    } else if (r.kind === "event_speaker" || r.kind === "event_partner") {
      const name = norm(String(r.payload.name ?? r.title.split(" — ")[0]));
      const events = ((r.payload.events ?? []) as string[]).filter((s) => member.has(`${s}|${r.kind}|${name}`));
      r.payload.events = events;
      r.visibility = events.length ? "public" : "private";
    }
  }

  // 2. Write every published edition (and its people and partners) from Events Admin.
  const upsert = (row: BrainRow, slug: string) => {
    const k = key(row);
    const cur = state.get(k);
    if (cur) {
      const events = row.payload.events ? [...new Set([...((cur.payload.events ?? []) as string[]), slug])] : undefined;
      cur.payload = { ...cur.payload, ...row.payload, ...(events ? { events } : {}) };
      cur.visibility = "public";
    } else state.set(k, row);
  };
  for (const e of live) {
    const sector = SERIES_SECTOR[e.series_slug ?? ""] ?? "cross";
    const prior = [...state.values()].find((r) => r.kind === "event" && r.payload.event_slug === e.slug);
    const scope = prior?.scope_key ?? brainScope(e.country_code);
    const base = { scope_key: scope, sector_code: prior?.sector_code ?? sector, visibility: "public" as const };
    const ev: BrainRow = {
      ...base, kind: "event", title: prior?.title ?? eventTitle(e.title, e.edition_label), weight: 4,
      payload: {
        series: e.series_slug, series_name: e.series_name, edition: e.edition_label, event_slug: e.slug, name: e.title,
        site_url: e.site_url, registration_url: e.registration_url, page_url: `https://gdpvision.com/events/${e.slug}`,
        tagline: e.tagline, summary: e.summary, date_text: dateText(e), date_tba: e.date_tba,
        starts_on: e.starts_at?.slice(0, 10) ?? null, ends_on: (e.ends_at ?? e.starts_at)?.slice(0, 10) ?? null,
        venue: e.venue, city: e.city, country: scope,
        agenda: e.sessions.map((s) => s.title), speakers: e.speakers.map((s) => s.name), partners: e.partners.map((p) => p.name),
        synced_from: "events_admin", synced_at: now,
      },
    };
    upsert(ev, e.slug);
    for (const s of e.speakers) {
      if (!s.name.trim()) continue;
      upsert({ ...base, sector_code: base.sector_code, kind: "event_speaker", title: speakerTitle(s.name, s.organisation).slice(0, 300), weight: 2,
        payload: { name: s.name.trim(), role: s.role, organisation: s.organisation, events: [e.slug], synced_at: now } }, e.slug);
    }
    for (const p of e.partners) {
      if (!p.name.trim()) continue;
      upsert({ ...base, kind: "event_partner", title: p.name.trim().slice(0, 300), weight: 2,
        payload: { name: p.name.trim(), tier: p.tier, url: p.url, events: [e.slug], synced_at: now } }, e.slug);
    }
  }

  const inserts: BrainRow[] = [];
  const updates: BrainRow[] = [];
  for (const r of state.values()) {
    if (!r.id) { inserts.push(r); continue; }
    if (before.get(r.id) !== JSON.stringify([r.payload, r.visibility, r.title])) updates.push(r);
  }
  const hidden = updates.filter((r) => r.visibility === "private" && existing.find((x) => x.id === r.id)?.visibility === "public").length;
  return { inserts, updates, summary: { editions: live.length, added: inserts.length, updated: updates.length - hidden, hidden, total_public: [...state.values()].filter((r) => r.visibility === "public").length } };
}
