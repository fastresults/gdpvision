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
  };
}

export async function authenticatePartner(request: Request) {
  const m = /^Bearer\s+(\S+)$/.exec((request.headers.get("authorization") ?? "").trim());
  return m ? authenticatePartnerKey(m[1]) : null;
}

const CORS = {
  "Access-Control-Allow-Methods": "GET, OPTIONS",
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
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": status === 200 ? "private, max-age=60" : "no-store",
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
    return partnerProblem(request, err.status ?? 500, err.status ? err.message : "Server error", undefined, id);
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
