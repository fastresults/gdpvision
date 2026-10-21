// @domain public-data
// @tables partner_api_keys,countries,country_kpis,memory_objects,country_sources
// @ui src/routes/_authenticated/admin/partner-keys.tsx
//
// Shared public data layer for companion sites (GDP Advisor). Used by
// /api/public/v2/* and the MCP server. Only public, approved material — it
// delegates per-country reads to the v1 resource handlers so the same filters apply.

import { API_SCOPES, type ApiScope } from "@/lib/egov/api-keys.functions";
import { readPublicResource } from "@/lib/egov/api.server";
import { db } from "@/lib/syndication/db";

export const PARTNER_API_VERSION = "v2";

export interface PartnerIdentity {
  keyId: string;
  partner: string;
  countries: string[]; // ["*"] = all
  scopes: ApiScope[];
  allowedOrigins: string[];
  /** partner-only scope "indices_test": may request the latest private TEST release (?edition=test) */
  testIndices?: boolean;
  /** partner-only scopes for a GDP Events site */
  eventsContext?: boolean;
  eventsRegister?: boolean;
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function canReadCountry(id: PartnerIdentity, code: string) {
  return id.countries.includes("*") || id.countries.includes(code.toUpperCase());
}

export async function authenticatePartnerKey(raw: string): Promise<PartnerIdentity | null> {
  if (!/^gdpp_[A-Za-z0-9_-]{40,50}$/.test(raw)) return null;
  const sb = await admin();
  const { data } = await db(sb).rpc("resolve_partner_api_key", { _key_hash: await sha256Hex(raw) });
  const row = (Array.isArray(data) ? data[0] : data) as
    | { id: string; partner: string; countries: string[]; scopes: string[]; allowed_origins: string[] }
    | undefined;
  if (!row) return null;
  return {
    keyId: row.id,
    partner: row.partner,
    countries: (row.countries ?? []).map((c) => c.toUpperCase()),
    scopes: (row.scopes ?? []).filter((s): s is ApiScope => (API_SCOPES as readonly string[]).includes(s)),
    allowedOrigins: row.allowed_origins ?? [],
    testIndices: (row.scopes ?? []).includes("indices_test"),
    eventsContext: (row.scopes ?? []).includes("events_context"),
    eventsRegister: (row.scopes ?? []).includes("events_register"),
  };
}

export async function authenticatePartner(request: Request) {
  const m = /^Bearer\s+(\S+)$/.exec((request.headers.get("authorization") ?? "").trim());
  return m ? authenticatePartnerKey(m[1]) : null;
}

const CORS = {
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Max-Age": "86400",
  Vary: "Origin",
};

export function partnerCors(request: Request, id?: PartnerIdentity | null): Record<string, string> {
  const origin = request.headers.get("origin");
  if (!origin) return { ...CORS };
  const allowed = id?.allowedOrigins ?? [];
  return allowed.length === 0 || allowed.includes(origin)
    ? { ...CORS, "Access-Control-Allow-Origin": origin }
    : { ...CORS };
}

export function partnerJson(request: Request, body: unknown, status = 200, id?: PartnerIdentity | null) {
  // test releases change with every test run and must never sit in a cache
  const test = /[?&]edition=test(&|$)/.test(new URL(request.url).search);
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": status === 200 && !test ? "private, max-age=60" : "no-store",
      "X-GDPVision-API": PARTNER_API_VERSION,
      ...partnerCors(request, id),
    },
  });
}

export function partnerProblem(request: Request, status: number, title: string, detail?: string, id?: PartnerIdentity | null) {
  return partnerJson(request, { type: "about:blank", status, title, detail }, status, id);
}

/** Wraps a handler with key auth and consistent errors. */
export async function withPartner(
  request: Request,
  fn: (id: PartnerIdentity) => Promise<unknown>,
): Promise<Response> {
  const id = await authenticatePartner(request);
  if (!id) return partnerProblem(request, 401, "Unauthorized", "Send a partner key as Authorization: Bearer gdpp_…");
  try {
    const body = await fn(id);
    return partnerJson(request, { version: PARTNER_API_VERSION, generated_at: new Date().toISOString(), ...(body as object) }, 200, id);
  } catch (e) {
    const err = e as Error & { status?: number };
    if (err.status) return partnerProblem(request, err.status, err.message, undefined, id);
    // unexpected errors are logged with a reference the partner can quote back
    const ref = crypto.randomUUID().slice(0, 8);
    console.error(`partner api error ${ref}`, new URL(request.url).pathname, err?.message?.slice(0, 300));
    return partnerProblem(request, 500, "Server error", `Reference ${ref}`, id);
  }
}

export function httpError(status: number, message: string) {
  return Object.assign(new Error(message), { status });
}

// ------------------------------------------------------------- reads

export async function listPublicCountries(id: PartnerIdentity) {
  const sb = await admin();
  const { data } = await sb
    .from("countries")
    .select("code,name,iso3,currency,is_caricom,is_oecs,is_cbi_state,gdp_current_usd,gdp_year,updated_at")
    .order("name");
  const rows = (data ?? []).filter((c) => canReadCountry(id, c.code));
  return rows.map((c) => ({
    code: c.code,
    name: c.name,
    iso3: c.iso3,
    currency: c.currency,
    groups: { caricom: c.is_caricom, oecs: c.is_oecs, cbi: c.is_cbi_state },
    gdp_current_usd: c.gdp_current_usd,
    gdp_year: c.gdp_year,
    updated_at: c.updated_at,
  }));
}

export async function readCountryResource(
  id: PartnerIdentity,
  code: string,
  resource: string,
  since?: string | null,
  edition?: string | null,
) {
  const c = code.toUpperCase();
  if (!canReadCountry(id, c)) throw httpError(403, `This key cannot read ${c}.`);
  if (resource === "indices" && edition) {
    // a chosen edition (id, "latest", or "test" with the indices_test scope)
    requireIndices(id);
    const m = await import("@/lib/public-data/indices.server");
    const { data, extra } = await m.getCountryIndices(c, edition, Boolean(id.testIndices));
    return {
      country: c,
      resource,
      count: data.length,
      next_since: new Date().toISOString(),
      ...extra,
      data,
    };
  }
  if (!(API_SCOPES as readonly string[]).includes(resource))
    throw httpError(404, `Unknown resource. Resources: ${API_SCOPES.join(", ")}.`);
  if (!id.scopes.includes(resource as ApiScope)) throw httpError(403, `This key does not include "${resource}".`);
  const sinceIso = since && Number.isFinite(Date.parse(since)) ? new Date(since).toISOString() : null;
  const { data, extra } = await readPublicResource(c, resource as ApiScope, sinceIso);
  return { country: c, resource, count: data.length, next_since: new Date().toISOString(), ...extra, data };
}

function allowedCodes(id: PartnerIdentity, requested?: string[]) {
  const req = (requested ?? []).map((s) => s.trim().toUpperCase()).filter(Boolean);
  if (id.countries.includes("*")) return req.length ? req : null; // null = all
  return req.length ? req.filter((c) => id.countries.includes(c)) : id.countries;
}

export async function searchPublicBrain(
  id: PartnerIdentity,
  opts: { q: string; countries?: string[]; sector?: string | null; limit?: number },
) {
  if (!id.scopes.includes("brain") && !id.scopes.includes("sources"))
    throw httpError(403, 'This key does not include "brain" or "sources".');
  const q = opts.q.trim().slice(0, 120).replace(/[%,()]/g, " ");
  if (q.length < 2) throw httpError(400, "Query must be at least 2 characters.");
  const limit = Math.min(Math.max(opts.limit ?? 25, 1), 100);
  const codes = allowedCodes(id, opts.countries);
  const sb = db(await admin());
  const out: { facts: unknown[]; sources: unknown[] } = { facts: [], sources: [] };
  if (id.scopes.includes("brain")) {
    let m = sb
      .from("memory_objects")
      .select("kind,title,payload,sector_code,scope_key,weight,updated_at")
      .eq("visibility", "public")
      .eq("verified", true)
      .in("kind", ["fact", "risk", "position", "mandate_compact"])
      .ilike("title", `%${q}%`)
      .order("weight", { ascending: false })
      .limit(limit);
    if (codes) m = m.in("scope_key", codes);
    if (opts.sector) m = m.eq("sector_code", opts.sector);
    out.facts = ((await m).data ?? []).map((r: Record<string, unknown>) => ({ ...r, country: r.scope_key }));
  }
  if (id.scopes.includes("sources")) {
    let s = sb
      .from("country_sources")
      .select("country_code,org,title,url,kind,summary,quality_score,updated_at")
      .eq("visibility", "public")
      .eq("active", true)
      .or(`title.ilike.%${q}%,org.ilike.%${q}%`)
      .order("quality_score", { ascending: false })
      .limit(limit);
    if (codes) s = s.in("country_code", codes);
    out.sources = (await s).data ?? [];
  }
  return { query: q, count: out.facts.length + out.sources.length, ...out };
}

export async function compareKpi(id: PartnerIdentity, opts: { metric: string; countries?: string[] }) {
  if (!id.scopes.includes("kpis")) throw httpError(403, 'This key does not include "kpis".');
  const metric = opts.metric.trim().slice(0, 80);
  if (!metric) throw httpError(400, "metric is required (a kpi_code, or part of a KPI label).");
  const codes = allowedCodes(id, opts.countries);
  let k = db(await admin())
    .from("country_kpis")
    .select("country_code,kpi_code,label,unit,latest_value,latest_period,direction,source_url,updated_at")
    .eq("visibility", "public")
    .not("latest_value", "is", null)
    .or(`kpi_code.eq.${metric.replace(/[^A-Za-z0-9_.-]/g, "")},label.ilike.%${metric.replace(/[%,()]/g, " ")}%`)
    .order("latest_value", { ascending: false })
    .limit(300);
  if (codes) k = k.in("country_code", codes);
  const rows = ((await k).data ?? []) as Array<Record<string, unknown>>;
  return { metric, count: rows.length, data: rows };
}

// ------------------------------------------------------------- Caribbean Indices

function requireIndices(id: PartnerIdentity) {
  if (!id.scopes.includes("indices")) throw httpError(403, 'This key does not include "indices".');
}

/** Method, pillars, indicators, sources, licences and published editions. */
export async function readIndexCatalogue(id: PartnerIdentity, opts: { test?: boolean } = {}) {
  requireIndices(id);
  if (opts.test && !id.testIndices) throw httpError(403, 'This key does not include "indices_test".');
  const m = await import("@/lib/public-data/indices.server");
  return m.getIndexCatalogue({ test: Boolean(opts.test) });
}

/** League table for one index from a published edition (?edition=<id>|latest, ?countries=ATG,KNA). */
export async function readIndexEdition(id: PartnerIdentity, index: string, edition?: string | null, countries?: string[]) {
  requireIndices(id);
  const m = await import("@/lib/public-data/indices.server");
  if (!m.isIndexCode(index)) throw httpError(404, `Unknown index. Indexes: ${m.INDEX_CODES.join(", ")}.`);
  const codes = allowedCodes(id, countries);
  return m.getIndexEdition(index, edition, codes, Boolean(id.testIndices));
}


// ------------------------------------------------------------- GDP Events (regional; registrations never exposed)
const EDITION_SELECT =
  "id, slug, title, edition_label, tagline, summary, body, format, theme, status, archived, country_code, city, venue, starts_at, ends_at, date_tba, registration_close, capacity, hosts, hero_url, registration_url, recording_url, series_id, event_series(slug, name, short_name, site_url, sector, colour, logo_url), event_sessions(position, starts_at, title, description, speaker_names), event_speakers(position, name, role, organisation, photo_url), event_partners(position, name, tier, logo_url, url), event_media(position, kind, url, caption, credit), event_links(kind, ref, label)";

function needEvents(id: PartnerIdentity) {
  if (!id.scopes.includes("events")) throw httpError(403, 'This key does not include "events".');
}

/** Published GDP Events editions with series, agenda, speakers, partners and photos. */
export async function readPublicEvents(id: PartnerIdentity, opts: { upcomingOnly?: boolean; series?: string | null } = {}) {
  needEvents(id);
  const f = await import("./events-feed");
  const sb = await admin();
  const { data, error } = await (sb as any).from("events").select(EDITION_SELECT).eq("status", "published").eq("archived", false).order("starts_at");
  if (error) throw httpError(500, error.message);
  let rows = f.publicEditions((data ?? []) as any[], opts.upcomingOnly);
  if (opts.series) rows = rows.filter((e: any) => e.event_series?.slug === opts.series);
  const out = rows.map(f.shapeEdition);
  return { count: out.length, data: out };
}

/** Summit series with their published editions (slug, label, dates). */
export async function readPublicEventSeries(id: PartnerIdentity) {
  needEvents(id);
  const sb = await admin();
  const { data, error } = await (sb as any)
    .from("event_series")
    .select("slug, name, short_name, site_url, sector, colour, logo_url, summary, position, events(slug, title, edition_label, status, archived, starts_at, ends_at, date_tba, city, country_code)")
    .order("position");
  if (error) throw httpError(500, error.message);
  const out = (data ?? []).map((s: any) => ({
    ...s,
    events: (s.events ?? [])
      .filter((e: any) => e.status === "published" && !e.archived)
      .map(({ status: _s, archived: _a, ...e }: any) => ({ ...e, url: `https://gdpvision.com/events/${e.slug}` }))
      .sort((a: any, b: any) => String(a.starts_at ?? "9").localeCompare(String(b.starts_at ?? "9"))),
  })).filter((s: any) => s.events.length);
  return { count: out.length, data: out };
}

async function editionBySlug(slug: string) {
  if (!/^[a-z0-9-]{2,120}$/.test(slug)) throw httpError(404, "Event not found.");
  const sb = await admin();
  const { data } = await (sb as any).from("events").select(EDITION_SELECT).eq("slug", slug).eq("status", "published").eq("archived", false).maybeSingle();
  if (!data) throw httpError(404, "Event not found.");
  return data as any;
}

export async function readPublicEvent(id: PartnerIdentity, slug: string) {
  needEvents(id);
  const f = await import("./events-feed");
  return { data: f.shapeEdition(await editionBySlug(slug)) };
}

/** Host-country sector figures and public Second Brain facts for one summit. */
export async function readEventContext(id: PartnerIdentity, slug: string) {
  needEvents(id);
  if (!id.eventsContext) throw httpError(403, 'This key does not include "events_context".');
  const ev = await editionBySlug(slug);
  const { brainScope, SERIES_SECTOR } = await import("@/lib/events/brain-sync-rules");
  const country = brainScope(ev.country_code);
  const sector = SERIES_SECTOR[ev.event_series?.slug ?? ""] ?? "cross";
  const empty = { event: slug, country, sector, kpis: [], facts: [], summit_knowledge: [] };
  if (country === "REGION" || !canReadCountry(id, country)) return { data: empty };
  const [kpis, brain] = await Promise.all([readPublicResource(country, "kpis"), readPublicResource(country, "brain")]);
  const facts = (brain.data as any[]);
  const sb = await admin();
  const { data: summit } = await (sb as any).from("memory_objects").select("kind, title, payload, updated_at")
    .eq("visibility", "public").eq("sector_code", sector).in("kind", ["event_topic", "event_partner", "event_speaker"]).limit(300);
  const mine = (summit ?? []).filter((r: any) => r.payload?.event_slug === slug || (r.payload?.events ?? []).includes(slug));
  return {
    data: {
      ...empty,
      kpis: kpis.data,
      facts: sector === "cross" ? facts : [...facts.filter((x) => x.sector_code === sector), ...facts.filter((x) => x.sector_code !== sector)],
      summit_knowledge: mine.map((r: any) => ({ kind: r.kind, title: r.title, updated_at: r.updated_at })),
    },
  };
}

/** Recent public news signals for a summit's host country (30-day window). */
export async function readEventMedia(id: PartnerIdentity, slug: string) {
  needEvents(id);
  if (!id.scopes.includes("media")) throw httpError(403, 'This key does not include "media".');
  const ev = await editionBySlug(slug);
  const { brainScope } = await import("@/lib/events/brain-sync-rules");
  const country = brainScope(ev.country_code);
  if (country === "REGION" || !canReadCountry(id, country)) return { country, count: 0, data: [] };
  const r = await readPublicResource(country, "media");
  return { country, count: r.data.length, data: r.data, ...r.extra };
}

/** Register an attendee for a published edition on behalf of a partner site. */
export async function registerViaPartner(id: PartnerIdentity, slug: string, body: unknown) {
  if (!id.eventsRegister) throw httpError(403, 'This key does not include "events_register".');
  const { z } = await import("zod");
  const parsed = z.object({
    name: z.string().trim().min(2).max(200),
    email: z.string().trim().email().max(320),
    organisation: z.string().trim().max(200).optional().default(""),
    role: z.string().trim().max(200).optional().default(""),
    country: z.string().trim().max(120).optional().default(""),
    needs: z.string().trim().max(1000).optional().default(""),
  }).safeParse(body);
  if (!parsed.success) throw httpError(422, "Send name and a valid email (organisation, role, country, needs optional).");
  const sb = await admin();
  const source = `partner:${id.keyId}`;
  const minuteAgo = new Date(Date.now() - 60_000).toISOString();
  const { count } = await (sb as any).from("event_registrations").select("id", { count: "exact", head: true }).eq("source", source).gte("created_at", minuteAgo);
  if ((count ?? 0) >= 30) throw httpError(429, "Too many registrations from this key in the last minute. Try again shortly.");
  const d = parsed.data;
  const { data: res, error } = await sb.rpc("register_for_event", {
    _slug: slug, _name: d.name, _email: d.email, _organisation: d.organisation, _role: d.role, _country: d.country, _needs: d.needs,
  });
  if (error) throw httpError(500, "Registration could not be saved.");
  const r = res as { outcome: string; status?: string };
  if (r.outcome === "ok") {
    const { data: ev } = await (sb as any).from("events").select("id").eq("slug", slug).single();
    await (sb as any).from("event_registrations").update({ source }).eq("event_id", ev.id).eq("email_norm", d.email.trim().toLowerCase());
  }
  return r;
}
