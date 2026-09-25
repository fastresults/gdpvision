// @domain egov
// @tables egov_api_keys,egov_prds,countries,country_kpis,ministries,ministry_profiles,ministry_sectors,sectors,sector_dossiers,mandate_compacts,compact_pillars,compact_pledges,compact_deliverables,compact_status_updates,compact_scorecards,investment_projects,investment_packages,memory_objects,country_sources
// @ui src/routes/api/public/v1/countries.$code.$resource.ts
//
// The read-only interface a country's e-government platform consumes.
//
// Contract (also described in the PRD's architecture section):
//   Authorization: Bearer gdpv_<code>_…   (a key from the Connection panel)
//   GET /api/public/v1/handshake                       who am I, what may I read, where is it
//   GET /api/public/v1/countries/:code/<resource>      brand | kpis | commitments | ministries |
//                                                      sectors | datasets | procurement | projects |
//                                                      brain | sources
//   ?since=<ISO 8601>   only rows changed since then (where the resource has a timestamp)
//   Every response: { country, resource, generated_at, count, data, next_since }
//
// Only public, approved material leaves here: rows carry visibility = 'public'
// where the table has it; projects must be approved; drafts, compliance
// records, persona data, narrative signals and PRD internals never appear.
// The service-role client is used, so every check is repeated in code.

import { flagUrl, ISO3_TO_ISO2 } from "@/lib/caricom-registry";
import { buildOc4idsPackage, type Oc4idsSourceProject } from "@/lib/investments/oc4ids";
import { db } from "@/lib/syndication/db";

import { API_SCOPES, type ApiScope } from "./api-keys.functions";
import { IMAGERY_SPEC, MARKS_USAGE, buildBrandTokens, type BrandTokens } from "./brand";
import { brandOf } from "./db";

export const API_VERSION = "v1";

export interface ApiIdentity {
  keyId: string;
  country: string;
  prdId: string | null;
  label: string;
  scopes: ApiScope[];
  allowedOrigins: string[];
}

type Admin = (typeof import("@/integrations/supabase/client.server"))["supabaseAdmin"];

async function admin(): Promise<Admin> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ------------------------------------------------------------------ responses

const CORS_BASE = {
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, If-None-Match",
  "Access-Control-Max-Age": "86400",
  Vary: "Origin",
};

export function corsHeaders(
  request: Request,
  identity?: ApiIdentity | null,
): Record<string, string> {
  const origin = request.headers.get("origin");
  if (!origin) return { ...CORS_BASE };
  const allowed = identity?.allowedOrigins ?? [];
  const ok = allowed.length === 0 || allowed.includes(origin);
  return ok ? { ...CORS_BASE, "Access-Control-Allow-Origin": origin } : { ...CORS_BASE };
}

export function json(body: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": status === 200 ? "private, max-age=60" : "no-store",
      "X-GDPVision-API": API_VERSION,
      ...extra,
    },
  });
}

export function problem(
  request: Request,
  status: number,
  title: string,
  detail?: string,
  identity?: ApiIdentity | null,
): Response {
  return json(
    { type: "about:blank", status, title, detail },
    status,
    corsHeaders(request, identity),
  );
}

// ------------------------------------------------------------------ auth

export async function authenticate(request: Request): Promise<ApiIdentity | null> {
  const header = request.headers.get("authorization") ?? "";
  const m = /^Bearer\s+(gdpv_[a-z]{2,3}_[A-Za-z0-9_-]{40,50})$/.exec(header.trim());
  if (!m) return null;
  const sb = await admin();
  const { data } = await db(sb).rpc("resolve_egov_api_key", { _key_hash: await sha256Hex(m[1]) });
  const row = (Array.isArray(data) ? data[0] : data) as
    | {
        id: string;
        country_code: string;
        prd_id: string | null;
        label: string;
        scopes: string[];
        allowed_origins: string[];
      }
    | undefined;
  if (!row) return null;
  return {
    keyId: row.id,
    country: row.country_code.toUpperCase(),
    prdId: row.prd_id,
    label: row.label,
    scopes: (row.scopes ?? []).filter((s): s is ApiScope =>
      (API_SCOPES as readonly string[]).includes(s),
    ),
    allowedOrigins: row.allowed_origins ?? [],
  };
}

// ------------------------------------------------------------------ helpers

function since(request: Request): string | null {
  const s = new URL(request.url).searchParams.get("since");
  if (!s) return null;
  const t = Date.parse(s);
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}

function envelope(
  identity: ApiIdentity,
  resource: string,
  data: unknown[],
  extra: Record<string, unknown> = {},
) {
  return {
    country: identity.country,
    resource,
    version: API_VERSION,
    generated_at: new Date().toISOString(),
    count: data.length,
    next_since: new Date().toISOString(),
    ...extra,
    data,
  };
}

async function countryName(sb: Admin, code: string): Promise<string> {
  const { data } = await sb.from("countries").select("name").eq("code", code).maybeSingle();
  return ((data as { name?: string } | null)?.name ?? code).trim();
}

async function approvedPrd(sb: Admin, code: string) {
  const { data } = await db(sb)
    .from("egov_prds")
    .select("id,version,status,title,approved_at,updated_at,brand,scope")
    .eq("country_code", code)
    .eq("status", "approved")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data as {
    id: string;
    version: number;
    status: string;
    title: string;
    approved_at: string | null;
    updated_at: string;
    brand: unknown;
    scope: { platform_name?: string };
  } | null;
}

// ------------------------------------------------------------------ brand

export interface BrandPayload {
  tokens: BrandTokens;
  flag: {
    iso2: string | null;
    /** Vector flag, the platform's logo mark. */
    svg: string | null;
    png: Record<string, string | null>;
    /** How the flag is used: logo, favicon and touch icon sizes. */
    usage: { logo: string; favicon: string[]; touch_icon: string; rule: string };
  };
  imagery: {
    style: string;
    rules: string[];
    required_sets: Array<{ key: string; purpose: string; count: string }>;
  };
  typography: BrandTokens["typography"];
}

export function brandPayload(code: string, stored: unknown): BrandPayload {
  const tokens = brandOf(stored) ?? buildBrandTokens(code);
  const iso2 = ISO3_TO_ISO2[code.toUpperCase()] ?? null;
  return {
    tokens,
    flag: {
      iso2,
      svg: iso2 ? `https://flagcdn.com/${iso2}.svg` : null,
      png: {
        w160: flagUrl(code, "w160"),
        w320: flagUrl(code, "w320"),
        w640: flagUrl(code, "w640"),
        w1280: flagUrl(code, "w1280"),
      },
      usage: { ...MARKS_USAGE, favicon: [...MARKS_USAGE.favicon] },
    },
    imagery: {
      style: IMAGERY_SPEC.style,
      rules: [...IMAGERY_SPEC.rules],
      required_sets: IMAGERY_SPEC.required_sets.map((x) => ({ ...x })),
    },
    typography: tokens.typography,
  };
}

// ------------------------------------------------------------------ resources

type Handler = (
  sb: Admin,
  identity: ApiIdentity,
  request: Request,
) => Promise<unknown[] | { data: unknown[]; extra?: Record<string, unknown> }>;

const LIMIT = 500;

const RESOURCES: Record<ApiScope, Handler> = {
  brand: async (sb, id) => {
    const prd = await approvedPrd(sb, id.country);
    return {
      data: [brandPayload(id.country, prd?.brand)],
      extra: { prd_version: prd?.version ?? null },
    };
  },

  kpis: async (sb, id, req) => {
    let q = db(sb)
      .from("country_kpis")
      .select(
        "kpi_code,label,unit,category,latest_value,latest_period,direction,target,confidence,source_url,last_verified_at,updated_at",
      )
      .eq("country_code", id.country)
      .eq("visibility", "public")
      .not("latest_value", "is", null)
      .order("category")
      .limit(LIMIT);
    const s = since(req);
    if (s) q = q.gt("updated_at", s);
    const { data } = await q;
    return data ?? [];
  },

  commitments: async (sb, id, req) => {
    const c = db(sb);
    const s = since(req);
    const { data: compacts } = await c
      .from("mandate_compacts")
      .select("id,title,status,election_cycle,term_start,term_end,summary,updated_at")
      .eq("country_code", id.country)
      .eq("visibility", "public")
      .limit(5);
    const out: unknown[] = [];
    for (const cp of (compacts ?? []) as Array<Record<string, unknown>>) {
      const [
        { data: pillars },
        { data: pledges },
        { data: deliverables },
        { data: updates },
        { data: score },
      ] = await Promise.all([
        c
          .from("compact_pillars")
          .select("id,title,narrative,sort_order")
          .eq("compact_id", cp.id)
          .eq("visibility", "public")
          .order("sort_order"),
        c
          .from("compact_pledges")
          .select(
            "id,pillar_id,title,pledge_type,baseline_value,target_value,unit,verbatim_quote,page_ref,sort_order,updated_at",
          )
          .eq("compact_id", cp.id)
          .eq("visibility", "public")
          .order("sort_order"),
        c
          .from("compact_deliverables")
          .select(
            "id,pledge_id,title,lead_ministry_id,supporting_ministry_ids,risk_level,quarterly_milestones,signed_off_at,updated_at",
          )
          .eq("compact_id", cp.id)
          .eq("visibility", "public"),
        (() => {
          let u = c
            .from("compact_status_updates")
            .select("id,deliverable_id,period,status,narrative,evidence_url,ministry_id,created_at")
            .eq("compact_id", cp.id)
            .eq("visibility", "public")
            .order("created_at", { ascending: false })
            .limit(LIMIT);
          if (s) u = u.gt("created_at", s);
          return u;
        })(),
        c
          .from("compact_scorecards")
          .select(
            "period,on_track_pct,at_risk_pct,off_track_pct,delivered_pct,broken_pct,weighted_progress,computed_at",
          )
          .eq("compact_id", cp.id)
          .eq("visibility", "public")
          .order("computed_at", { ascending: false })
          .limit(1),
      ]);
      out.push({
        compact: cp,
        pillars: pillars ?? [],
        pledges: pledges ?? [],
        deliverables: deliverables ?? [],
        status_updates: updates ?? [],
        scorecard: (score ?? [])[0] ?? null,
      });
    }
    return out;
  },

  ministries: async (sb, id) => {
    const c = db(sb);
    const [{ data: ministries }, { data: profiles }, { data: sectors }] = await Promise.all([
      c
        .from("ministries")
        .select("id,name,slug,sort_order")
        .eq("country_code", id.country)
        .order("sort_order"),
      c
        .from("ministry_profiles")
        .select("ministry_slug,minister,mandate,programmes,updated_at")
        .eq("country_code", id.country)
        .eq("visibility", "public"),
      c.from("sectors").select("code,label"),
    ]);
    const ms = (ministries ?? []) as Array<{
      id: string;
      name: string;
      slug: string;
      sort_order: number;
    }>;
    const { data: weights } = ms.length
      ? await c
          .from("ministry_sectors")
          .select("ministry_id,sector_code,weight")
          .in(
            "ministry_id",
            ms.map((m) => m.id),
          )
      : { data: [] };
    const label = new Map(
      ((sectors ?? []) as Array<{ code: string; label: string }>).map((x) => [x.code, x.label]),
    );
    const bySlug = new Map(
      ((profiles ?? []) as Array<Record<string, unknown>>).map((p) => [String(p.ministry_slug), p]),
    );
    return ms.map((m) => {
      const p = bySlug.get(m.slug);
      return {
        id: m.id,
        slug: m.slug,
        name: m.name,
        minister: p?.minister ?? null,
        mandate: p?.mandate ?? null,
        programmes: p?.programmes ?? [],
        sectors: (
          (weights ?? []) as Array<{ ministry_id: string; sector_code: string; weight: number }>
        )
          .filter((w) => w.ministry_id === m.id && w.weight > 0)
          .map((w) => ({
            code: w.sector_code,
            label: label.get(w.sector_code) ?? w.sector_code,
            weight: w.weight,
          })),
        updated_at: p?.updated_at ?? null,
      };
    });
  },

  sectors: async (sb, id, req) => {
    let q = db(sb)
      .from("sector_dossiers")
      .select("sector_code,kind,confidence,payload,citations,updated_at")
      .eq("country_code", id.country)
      .eq("visibility", "public")
      .limit(LIMIT);
    const s = since(req);
    if (s) q = q.gt("updated_at", s);
    const { data } = await q;
    return data ?? [];
  },

  datasets: async (sb, id) => {
    // The open-data register: every reporting requirement the standards audit
    // knows, with the country's current coverage status — what the platform's
    // open-data portal lists, with a plan where one is approved.
    const { computeCountryAudit } = await import("@/lib/standards/audit-data.server");
    const audit = await computeCountryAudit(sb as never, id.country);
    return {
      data: audit.rows.map((r) => ({
        id: r.id,
        standard: r.standardCode,
        requirement: r.label,
        clause: r.clause,
        frequency: r.frequency,
        status: r.status,
        indicators: r.expectedKpis,
        evidence: r.evidence,
        plan:
          r.plan && r.plan.status === "approved"
            ? { owner: r.plan.ownerAgency, due: r.plan.dueDate, overdue: r.plan.overdue }
            : null,
      })),
      extra: { summary: audit.summary },
    };
  },

  procurement: async (sb, id) => {
    const { data: rows } = await db(sb)
      .from("investment_projects")
      .select("id,title,summary,sector,stage,capex_usd,es_category,climate_alignment,updated_at")
      .eq("country_code", id.country)
      .eq("approval_status", "approved")
      .order("updated_at", { ascending: false })
      .limit(LIMIT);
    const { data: prefix } = await sb
      .from("app_settings")
      .select("value")
      .eq("key", `oc4ids_prefix.${id.country.toLowerCase()}`)
      .maybeSingle();
    const pkg = buildOc4idsPackage((rows ?? []) as Oc4idsSourceProject[], {
      countryCode: id.country,
      publisherName: `Government of ${await countryName(sb, id.country)}`,
      prefix: (prefix as { value?: string } | null)?.value || undefined,
    });
    return {
      data: pkg.projects,
      extra: {
        package: {
          uri: pkg.uri,
          publishedDate: pkg.publishedDate,
          publisher: pkg.publisher,
          version: pkg.version,
          license: pkg.license,
        },
      },
    };
  },

  projects: async (sb, id, req) => {
    const c = db(sb);
    let q = c
      .from("investment_projects")
      .select(
        "id,title,sector,structure,stage,capex_usd,summary,revenue_model,es_category,climate_alignment,version,approved_at,updated_at",
      )
      .eq("country_code", id.country)
      .eq("approval_status", "approved")
      .order("updated_at", { ascending: false })
      .limit(LIMIT);
    const s = since(req);
    if (s) q = q.gt("updated_at", s);
    const { data: projects } = await q;
    const ids = ((projects ?? []) as Array<{ id: string }>).map((p) => p.id);
    const { data: teasers } = ids.length
      ? await c
          .from("investment_packages")
          .select("project_id,version,content,approved_at")
          .in("project_id", ids)
          .eq("kind", "teaser")
          .eq("status", "approved")
      : { data: [] };
    const byProject = new Map(
      (
        (teasers ?? []) as Array<{
          project_id: string;
          version: number;
          content: unknown;
          approved_at: string;
        }>
      ).map((t) => [t.project_id, t]),
    );
    return ((projects ?? []) as Array<{ id: string }>).map((p) => ({
      ...p,
      teaser: byProject.get(p.id) ?? null,
    }));
  },

  brain: async (sb, id, req) => {
    let q = db(sb)
      .from("memory_objects")
      .select("id,kind,title,payload,sector_code,verified,weight,updated_at")
      .eq("scope_key", id.country)
      .eq("visibility", "public")
      .eq("verified", true)
      .in("kind", ["fact", "risk", "position", "mandate_compact"])
      .order("weight", { ascending: false })
      .limit(LIMIT);
    const s = since(req);
    if (s) q = q.gt("updated_at", s);
    const { data } = await q;
    return data ?? [];
  },

  sources: async (sb, id, req) => {
    let q = db(sb)
      .from("country_sources")
      .select("id,org,title,url,kind,tags,quality_score,summary,last_fetched_at,updated_at")
      .eq("country_code", id.country)
      .eq("visibility", "public")
      .eq("active", true)
      .order("quality_score", { ascending: false })
      .limit(LIMIT);
    const s = since(req);
    if (s) q = q.gt("updated_at", s);
    const { data } = await q;
    return data ?? [];
  },
};

export function isResource(x: string): x is ApiScope {
  return (API_SCOPES as readonly string[]).includes(x);
}

export async function serveResource(
  request: Request,
  identity: ApiIdentity,
  code: string,
  resource: string,
): Promise<Response> {
  const cors = corsHeaders(request, identity);
  if (code.toUpperCase() !== identity.country)
    return problem(request, 403, "Wrong country", `This key reads ${identity.country}.`, identity);
  if (!isResource(resource))
    return problem(
      request,
      404,
      "Unknown resource",
      `Resources: ${API_SCOPES.join(", ")}.`,
      identity,
    );
  if (!identity.scopes.includes(resource))
    return problem(
      request,
      403,
      "Scope not granted",
      `This key does not include "${resource}".`,
      identity,
    );
  const sb = await admin();
  const result = await RESOURCES[resource](sb, identity, request);
  const { data, extra } = Array.isArray(result)
    ? { data: result, extra: {} }
    : { data: result.data, extra: result.extra ?? {} };
  return json(envelope(identity, resource, data, extra), 200, cors);
}

export async function serveHandshake(request: Request, identity: ApiIdentity): Promise<Response> {
  const sb = await admin();
  const [name, prd] = await Promise.all([
    countryName(sb, identity.country),
    approvedPrd(sb, identity.country),
  ]);
  const origin = new URL(request.url).origin;
  const base = `${origin}/api/public/${API_VERSION}/countries/${identity.country}`;
  return json(
    {
      ok: true,
      version: API_VERSION,
      generated_at: new Date().toISOString(),
      country: { code: identity.country, name, iso2: ISO3_TO_ISO2[identity.country] ?? null },
      key: {
        label: identity.label,
        scopes: identity.scopes,
        allowed_origins: identity.allowedOrigins,
      },
      prd: prd
        ? {
            id: prd.id,
            version: prd.version,
            title: prd.title,
            platform_name: prd.scope?.platform_name ?? null,
            approved_at: prd.approved_at,
          }
        : null,
      brand: brandPayload(identity.country, prd?.brand),
      endpoints: Object.fromEntries(identity.scopes.map((s) => [s, `${base}/${s}`])),
      sync: {
        recommended_interval_minutes: 60,
        incremental:
          "Pass ?since=<next_since from the previous response> on kpis, commitments, sectors, projects, brain and sources.",
        cache:
          "Responses may be cached for up to 60 seconds; the platform should keep its last good copy and serve it if GDPVision is unreachable.",
      },
    },
    200,
    corsHeaders(request, identity),
  );
}
