// @domain sovereign-eye
// @tables capital_flow_nodes,countries,country_capital_flows,country_kpi_points,country_kpis,country_sectors,country_sources,memory_objects,ministries,ministry_profiles,sectors,sovereign_eye_scenes
// @ui src/components/sovereign-eye/SovereignEyeWorkspace.tsx; src/routes/_authenticated/admin/countries.$code.godseye.tsx

import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database, Json } from "@/integrations/supabase/types";

const CountryInput = z.object({ countryCode: z.string().min(2).max(4) });

const SceneLayerInput = z.object({
  id: z.string(),
  label: z.string(),
  kind: z.string(),
  status: z.string(),
  visible: z.boolean(),
  strength: z.number().nullable(),
  evidenceCount: z.number(),
  visibility: z.object({ public: z.number(), private: z.number() }),
  updatedAt: z.string().nullable(),
  narrative: z.string(),
});

const SaveSceneInput = z.object({
  countryCode: z.string().min(2).max(4),
  title: z.string().min(2).max(120),
  description: z.string().max(400).nullable().default(null),
  layers: z.array(SceneLayerInput).min(1).max(12),
  camera: z.record(z.unknown()).default({}),
  notes: z.string().max(2000).nullable().default(null),
  visibility: z.enum(["private", "public"]).default("private"),
});

const BriefInput = z.object({
  countryCode: z.string().min(2).max(4),
  selectedLayerIds: z.array(z.string()).min(1).max(12),
  question: z.string().max(600).optional(),
});

const PublicSceneInput = z.object({ token: z.string().min(12).max(96) });

export type SovereignEyeCountry = {
  code: string;
  name: string;
  iso3: string | null;
  currency: string;
  isCbiState: boolean;
  coordinates: { lat: number; lon: number; label: string };
};

export type SovereignEyeLayerKind =
  | "macro"
  | "sector"
  | "capital"
  | "ministry"
  | "corpus"
  | "live";

export type SovereignEyeLayer = {
  id: string;
  label: string;
  kind: SovereignEyeLayerKind;
  status: "ready" | "partial" | "missing";
  visible: boolean;
  strength: number | null;
  evidenceCount: number;
  visibility: { public: number; private: number };
  updatedAt: string | null;
  narrative: string;
};

export type SovereignEyeKpi = {
  id: string;
  code: string;
  label: string;
  unit: string;
  value: number | null;
  period: string | null;
  target: number | null;
  category: string | null;
  provenance: string;
  visibility: "public" | "private";
  points: Array<{ period: string; value: number }>;
};

export type SovereignEyeSector = {
  code: string;
  label: string;
  share: number;
  grade: string;
  ministers: Array<{ name: string; minister: string | null; weight: number }>;
};

export type SovereignEyeFlow = {
  nodeKey: string;
  label: string;
  side: "input" | "output";
  valueUsdM: number;
  period: string;
  confidence: string;
  method: string;
  visibility: "public" | "private";
  notes: string | null;
};

export type SovereignEyeEvidence = {
  sources: Array<{
    title: string;
    org: string;
    kind: string;
    url: string | null;
    quality: number | null;
    visibility: "public" | "private";
    status: string | null;
  }>;
  memory: Array<{
    title: string;
    kind: string;
    sectorCode: string;
    weight: number;
    verified: boolean;
    visibility: "public" | "private";
    updatedAt: string | null;
  }>;
};

export type SovereignEyeLiveFeed = {
  weather: {
    status: "ready" | "unavailable";
    temperatureC: number | null;
    windKph: number | null;
    precipitationMm: number | null;
    summary: string;
  };
  earthquakes: {
    status: "ready" | "unavailable";
    count7d: number;
    strongestMagnitude: number | null;
    summary: string;
  };
  checkedAt: string;
};

export type SovereignEyeScene = {
  id: string;
  countryCode: string;
  title: string;
  description: string | null;
  layers: SovereignEyeLayer[];
  camera: Json;
  notes: string | null;
  visibility: "private" | "public";
  shareToken: string | null;
  updatedAt: string;
};

export type SovereignEyeWorkspaceData = {
  country: SovereignEyeCountry;
  layers: SovereignEyeLayer[];
  kpis: SovereignEyeKpi[];
  sectors: SovereignEyeSector[];
  flows: SovereignEyeFlow[];
  evidence: SovereignEyeEvidence;
  live: SovereignEyeLiveFeed;
  scenes: SovereignEyeScene[];
  diagnostics: { missing: string[]; generatedAt: string };
};

const GEO: Record<string, { lat: number; lon: number; label: string }> = {
  AIA: { lat: 18.2206, lon: -63.0686, label: "Anguilla" },
  ATG: { lat: 17.0608, lon: -61.7964, label: "Antigua & Barbuda" },
  BHS: { lat: 25.0343, lon: -77.3963, label: "The Bahamas" },
  BLZ: { lat: 17.1899, lon: -88.4976, label: "Belize" },
  BMU: { lat: 32.3078, lon: -64.7505, label: "Bermuda" },
  BRB: { lat: 13.1939, lon: -59.5432, label: "Barbados" },
  CYM: { lat: 19.3133, lon: -81.2546, label: "Cayman Islands" },
  DMA: { lat: 15.415, lon: -61.371, label: "Dominica" },
  GLP: { lat: 16.265, lon: -61.551, label: "Guadeloupe" },
  GRD: { lat: 12.1165, lon: -61.679, label: "Grenada" },
  GUY: { lat: 6.8013, lon: -58.1551, label: "Guyana" },
  HTI: { lat: 18.9712, lon: -72.2852, label: "Haiti" },
  JAM: { lat: 18.1096, lon: -77.2975, label: "Jamaica" },
  KNA: { lat: 17.3578, lon: -62.783, label: "St. Kitts & Nevis" },
  LCA: { lat: 13.9094, lon: -60.9789, label: "Saint Lucia" },
  MSR: { lat: 16.7425, lon: -62.1874, label: "Montserrat" },
  MTQ: { lat: 14.6415, lon: -61.0242, label: "Martinique" },
  SUR: { lat: 5.852, lon: -55.2038, label: "Suriname" },
  TCA: { lat: 21.694, lon: -71.7979, label: "Turks & Caicos Islands" },
  TTO: { lat: 10.6918, lon: -61.2225, label: "Trinidad & Tobago" },
  VCT: { lat: 13.2528, lon: -61.1971, label: "St. Vincent & the Grenadines" },
  VGB: { lat: 18.4207, lon: -64.64, label: "British Virgin Islands" },
};

const HEADLINE_KPIS = new Set([
  "gdp_usd",
  "gdp_growth",
  "gdp_per_capita",
  "inflation",
  "unemployment",
  "debt_to_gdp",
  "fiscal_balance_pct_gdp",
  "current_account_pct_gdp",
  "tourism_arrivals",
  "poverty_rate",
]);

function firstError(...errors: Array<{ message: string } | null | undefined>) {
  return errors.find(Boolean)?.message ?? null;
}

function numeric(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizedVisibility(value: unknown): "public" | "private" {
  return value === "private" ? "private" : "public";
}

function latestDate(values: Array<string | null | undefined>) {
  const times = values
    .map((v) => (v ? Date.parse(v) : NaN))
    .filter((v) => Number.isFinite(v));
  if (!times.length) return null;
  return new Date(Math.max(...times)).toISOString();
}

function gradeStrength(grade: string | null | undefined): number {
  if (grade === "A") return 92;
  if (grade === "B") return 76;
  if (grade === "C") return 58;
  if (grade === "D") return 38;
  return 52;
}

function statusFrom(count: number, expected: number): SovereignEyeLayer["status"] {
  if (count <= 0) return "missing";
  if (count < expected) return "partial";
  return "ready";
}

function visibilityCounts(rows: Array<{ visibility?: unknown }>) {
  return rows.reduce(
    (acc, row) => {
      const key = normalizedVisibility(row.visibility);
      acc[key] += 1;
      return acc;
    },
    { public: 0, private: 0 },
  );
}

async function assertCountryAccess(context: { supabase: any; userId: string }, countryCode: string) {
  const { data: isAdmin, error: adminError } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (adminError) throw new Error(adminError.message);
  if (isAdmin) return;
  const { data: hasCountry, error: countryError } = await context.supabase.rpc("has_country_access", {
    _user_id: context.userId,
    _country_code: countryCode,
  });
  if (countryError) throw new Error(countryError.message);
  if (!hasCountry) throw new Error("Forbidden: no access to this country");
}

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`Feed unavailable (${res.status})`);
  return res.json();
}

function weatherText(code: number | null) {
  if (code == null) return "No weather code returned.";
  if ([0, 1].includes(code)) return "Clear to mainly clear.";
  if ([2, 3].includes(code)) return "Partly cloudy to overcast.";
  if ([45, 48].includes(code)) return "Fog conditions reported.";
  if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) return "Rain or showers reported.";
  if ([95, 96, 99].includes(code)) return "Thunderstorm conditions reported.";
  return "Weather conditions reported.";
}

async function loadLiveFeed(geo: { lat: number; lon: number }): Promise<SovereignEyeLiveFeed> {
  const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${geo.lat}&longitude=${geo.lon}&current=temperature_2m,wind_speed_10m,precipitation,weather_code&forecast_days=1`;
  const quakeUrl = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_week.geojson";
  const [weather, quakes] = await Promise.allSettled([fetchJson(weatherUrl), fetchJson(quakeUrl)]);

  const current =
    weather.status === "fulfilled" &&
    weather.value &&
    typeof weather.value === "object" &&
    "current" in weather.value
      ? (weather.value.current as Record<string, unknown>)
      : null;

  const features =
    quakes.status === "fulfilled" &&
    quakes.value &&
    typeof quakes.value === "object" &&
    Array.isArray((quakes.value as { features?: unknown }).features)
      ? ((quakes.value as { features: Array<{ geometry?: { coordinates?: number[] }; properties?: { mag?: number } }> }).features)
      : [];

  const nearby = features.filter((f) => {
    const coords = f.geometry?.coordinates;
    if (!coords || coords.length < 2) return false;
    const lon = coords[0] ?? 0;
    const lat = coords[1] ?? 0;
    return Math.abs(lat - geo.lat) <= 8 && Math.abs(lon - geo.lon) <= 8;
  });
  const strongest = nearby.reduce<number | null>((max, f) => {
    const mag = numeric(f.properties?.mag);
    if (mag == null) return max;
    return max == null ? mag : Math.max(max, mag);
  }, null);

  const temperature = numeric(current?.temperature_2m);
  const wind = numeric(current?.wind_speed_10m);
  const precipitation = numeric(current?.precipitation);
  const weatherCode = numeric(current?.weather_code);

  return {
    weather: {
      status: current ? "ready" : "unavailable",
      temperatureC: temperature,
      windKph: wind,
      precipitationMm: precipitation,
      summary: current
        ? `${weatherText(weatherCode)} ${temperature == null ? "" : `${temperature.toFixed(1)}°C`}`.trim()
        : "Live weather feed did not respond.",
    },
    earthquakes: {
      status: quakes.status === "fulfilled" ? "ready" : "unavailable",
      count7d: nearby.length,
      strongestMagnitude: strongest,
      summary: nearby.length
        ? `${nearby.length} regional seismic event${nearby.length === 1 ? "" : "s"} above magnitude 2.5 in the past week.`
        : "No regional seismic events above magnitude 2.5 in the past week.",
    },
    checkedAt: new Date().toISOString(),
  };
}

function toScene(row: {
  id: string;
  country_code: string;
  title: string;
  description: string | null;
  layers: Json;
  camera: Json;
  notes: string | null;
  visibility: string;
  share_token: string | null;
  updated_at: string;
}): SovereignEyeScene {
  return {
    id: row.id,
    countryCode: row.country_code,
    title: row.title,
    description: row.description,
    layers: Array.isArray(row.layers) ? (row.layers as SovereignEyeLayer[]) : [],
    camera: row.camera ?? {},
    notes: row.notes,
    visibility: row.visibility === "public" ? "public" : "private",
    shareToken: row.share_token,
    updatedAt: row.updated_at,
  };
}

async function loadWorkspaceData(countryCode: string): Promise<SovereignEyeWorkspaceData> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const cc = countryCode.toUpperCase();

  const [
    countryRes,
    kpiRes,
    sectorRes,
    sectorRegistryRes,
    ministryRes,
    profileRes,
    flowRes,
    nodeRes,
    sourceRes,
    memoryRes,
    sceneRes,
  ] = await Promise.all([
    supabaseAdmin.from("countries").select("code,name,iso3,currency,is_cbi_state").eq("code", cc).maybeSingle(),
    supabaseAdmin
      .from("country_kpis")
      .select("id,kpi_code,label,unit,latest_value,latest_period,target,category,provenance,visibility,updated_at")
      .eq("country_code", cc)
      .order("updated_at", { ascending: false }),
    supabaseAdmin
      .from("country_sectors")
      .select("sector_code,share_pct,confidence_grade,updated_at")
      .eq("country_code", cc)
      .order("share_pct", { ascending: false }),
    supabaseAdmin.from("sectors").select("code,label,sort_order").order("sort_order", { ascending: true }),
    supabaseAdmin.from("ministries").select("id,slug,name,sort_order").eq("country_code", cc).order("sort_order"),
    supabaseAdmin.from("ministry_profiles").select("ministry_slug,minister,visibility,updated_at").eq("country_code", cc),
    supabaseAdmin
      .from("country_capital_flows")
      .select("node_key,period,value_usd_m,method,confidence_grade,visibility,notes,updated_at")
      .eq("country_code", cc)
      .order("value_usd_m", { ascending: false })
      .limit(40),
    supabaseAdmin.from("capital_flow_nodes").select("node_key,label,side,sort_order").order("sort_order"),
    supabaseAdmin
      .from("country_sources")
      .select("title,org,kind,url,quality_score,visibility,fetch_status,last_fetched_at")
      .eq("country_code", cc)
      .order("updated_at", { ascending: false })
      .limit(16),
    supabaseAdmin
      .from("memory_objects")
      .select("kind,title,sector_code,weight,verified,visibility,updated_at")
      .ilike("scope_key", `%${cc}%`)
      .order("updated_at", { ascending: false })
      .limit(16),
    supabaseAdmin
      .from("sovereign_eye_scenes")
      .select("id,country_code,title,description,layers,camera,notes,visibility,share_token,updated_at")
      .eq("country_code", cc)
      .order("updated_at", { ascending: false })
      .limit(12),
  ]);

  const error = firstError(
    countryRes.error,
    kpiRes.error,
    sectorRes.error,
    sectorRegistryRes.error,
    ministryRes.error,
    profileRes.error,
    flowRes.error,
    nodeRes.error,
    sourceRes.error,
    memoryRes.error,
    sceneRes.error,
  );
  if (error) throw new Error(error);
  if (!countryRes.data) throw new Error(`Country ${cc} not found`);

  const geo = GEO[cc] ?? { lat: 17.5, lon: -63.5, label: countryRes.data.name };
  const live = await loadLiveFeed(geo);
  const registry = new Map((sectorRegistryRes.data ?? []).map((s) => [s.code, s.label]));
  const profiles = new Map((profileRes.data ?? []).map((p) => [p.ministry_slug, p]));
  const ministries = ministryRes.data ?? [];
  const nodes = new Map((nodeRes.data ?? []).map((n) => [n.node_key, n]));
  const kpiIds = (kpiRes.data ?? []).map((k) => k.id);
  const pointsByKpi = new Map<string, Array<{ period: string; value: number }>>();
  if (kpiIds.length) {
    const { data: pointRows, error: pointError } = await supabaseAdmin
      .from("country_kpi_points")
      .select("country_kpi_id,period,value")
      .in("country_kpi_id", kpiIds)
      .order("period", { ascending: true });
    if (pointError) throw new Error(pointError.message);
    for (const point of pointRows ?? []) {
      const existing = pointsByKpi.get(point.country_kpi_id) ?? [];
      existing.push({ period: point.period, value: numeric(point.value) ?? 0 });
      pointsByKpi.set(point.country_kpi_id, existing);
    }
  }

  const kpis: SovereignEyeKpi[] = (kpiRes.data ?? [])
    .filter((k) => HEADLINE_KPIS.has(k.kpi_code) || k.latest_value != null)
    .slice(0, 12)
    .map((k) => ({
      id: k.id,
      code: k.kpi_code,
      label: k.label,
      unit: k.unit,
      value: numeric(k.latest_value),
      period: k.latest_period,
      target: numeric(k.target),
      category: k.category,
      provenance: k.provenance ?? "unknown",
      visibility: normalizedVisibility(k.visibility),
      points: pointsByKpi.get(k.id) ?? [],
    }));

  const sectors: SovereignEyeSector[] = (sectorRes.data ?? []).slice(0, 10).map((s) => ({
    code: s.sector_code,
    label: registry.get(s.sector_code) ?? s.sector_code,
    share: numeric(s.share_pct) ?? 0,
    grade: s.confidence_grade ?? "C",
    ministers: ministries
      .slice(0, 5)
      .map((m) => ({
        name: m.name,
        minister: profiles.get(m.slug)?.minister ?? null,
        weight: 1,
      })),
  }));

  const flows: SovereignEyeFlow[] = (flowRes.data ?? []).slice(0, 12).map((f) => {
    const node = nodes.get(f.node_key);
    const side = node?.side === "output" ? "output" : "input";
    return {
      nodeKey: f.node_key,
      label: node?.label ?? f.node_key,
      side,
      valueUsdM: numeric(f.value_usd_m) ?? 0,
      period: f.period,
      confidence: f.confidence_grade ?? "C",
      method: f.method ?? "reported",
      visibility: normalizedVisibility(f.visibility),
      notes: f.notes,
    };
  });

  const sources = (sourceRes.data ?? []).map((s) => ({
    title: s.title,
    org: s.org,
    kind: s.kind,
    url: s.url,
    quality: numeric(s.quality_score),
    visibility: normalizedVisibility(s.visibility),
    status: s.fetch_status,
  }));

  const memory = (memoryRes.data ?? []).map((m) => ({
    title: m.title,
    kind: m.kind,
    sectorCode: m.sector_code,
    weight: numeric(m.weight) ?? 0,
    verified: Boolean(m.verified),
    visibility: normalizedVisibility(m.visibility),
    updatedAt: m.updated_at,
  }));

  const kpiVisibility = visibilityCounts(kpiRes.data ?? []);
  const sectorVisibility = { public: sectorRes.data?.length ?? 0, private: 0 };
  const flowVisibility = visibilityCounts(flowRes.data ?? []);
  const sourceVisibility = visibilityCounts(sourceRes.data ?? []);
  const memoryVisibility = visibilityCounts(memoryRes.data ?? []);
  const profileVisibility = visibilityCounts(profileRes.data ?? []);
  const avgSectorStrength = sectors.length
    ? Math.round(sectors.reduce((sum, s) => sum + gradeStrength(s.grade), 0) / sectors.length)
    : null;
  const avgFlowStrength = flows.length
    ? Math.round(flows.reduce((sum, f) => sum + gradeStrength(f.confidence), 0) / flows.length)
    : null;
  const liveReady = live.weather.status === "ready" || live.earthquakes.status === "ready";

  const layers: SovereignEyeLayer[] = [
    {
      id: "macro-pulse",
      label: "Macro pulse",
      kind: "macro",
      status: statusFrom(kpis.length, 4),
      visible: true,
      strength: kpis.length ? Math.min(95, 46 + kpis.length * 5) : null,
      evidenceCount: kpis.length,
      visibility: kpiVisibility,
      updatedAt: latestDate(kpiRes.data?.map((k) => k.updated_at) ?? []),
      narrative: "Headline GDP, fiscal and social indicators from the country corpus.",
    },
    {
      id: "sector-terrain",
      label: "Sector terrain",
      kind: "sector",
      status: statusFrom(sectors.length, 4),
      visible: true,
      strength: avgSectorStrength,
      evidenceCount: sectors.length,
      visibility: sectorVisibility,
      updatedAt: latestDate(sectorRes.data?.map((s) => s.updated_at) ?? []),
      narrative: "GDP-weighted sector composition with confidence grades and ministerial context.",
    },
    {
      id: "capital-currents",
      label: "Capital currents",
      kind: "capital",
      status: statusFrom(flows.length, 6),
      visible: true,
      strength: avgFlowStrength,
      evidenceCount: flows.length,
      visibility: flowVisibility,
      updatedAt: latestDate(flowRes.data?.map((f) => f.updated_at) ?? []),
      narrative: "Inbound and outbound capital-flow nodes from the ledger balance.",
    },
    {
      id: "ministerial-cover",
      label: "Ministerial cover",
      kind: "ministry",
      status: statusFrom(ministries.length, 3),
      visible: true,
      strength: ministries.length ? Math.min(92, 48 + profiles.size * 7) : null,
      evidenceCount: ministries.length,
      visibility: profileVisibility,
      updatedAt: latestDate(profileRes.data?.map((p) => p.updated_at) ?? []),
      narrative: "Named ministries and current minister profiles used to interpret accountability.",
    },
    {
      id: "second-brain",
      label: "Second brain",
      kind: "corpus",
      status: statusFrom(sources.length + memory.length, 6),
      visible: true,
      strength: sources.length + memory.length ? Math.min(98, 42 + (sources.length + memory.length) * 3) : null,
      evidenceCount: sources.length + memory.length,
      visibility: {
        public: sourceVisibility.public + memoryVisibility.public,
        private: sourceVisibility.private + memoryVisibility.private,
      },
      updatedAt: latestDate([
        ...(sourceRes.data?.map((s) => s.last_fetched_at) ?? []),
        ...(memoryRes.data?.map((m) => m.updated_at) ?? []),
      ]),
      narrative: "Public evidence and private country material separated at the layer boundary.",
    },
    {
      id: "live-conditions",
      label: "Live conditions",
      kind: "live",
      status: liveReady ? "ready" : "missing",
      visible: true,
      strength: liveReady ? 72 : null,
      evidenceCount: Number(live.weather.status === "ready") + Number(live.earthquakes.status === "ready"),
      visibility: { public: Number(live.weather.status === "ready") + Number(live.earthquakes.status === "ready"), private: 0 },
      updatedAt: live.checkedAt,
      narrative: "No-key public live feeds for weather and regional seismic context.",
    },
  ];

  const missing = layers.filter((l) => l.status !== "ready").map((l) => l.label);

  return {
    country: {
      code: countryRes.data.code,
      name: countryRes.data.name,
      iso3: countryRes.data.iso3,
      currency: countryRes.data.currency,
      isCbiState: Boolean(countryRes.data.is_cbi_state),
      coordinates: geo,
    },
    layers,
    kpis,
    sectors,
    flows,
    evidence: { sources, memory },
    live,
    scenes: (sceneRes.data ?? []).map(toScene),
    diagnostics: { missing, generatedAt: new Date().toISOString() },
  };
}

function gatewayMessage(status: number, body: string) {
  try {
    const parsed = JSON.parse(body) as { message?: string; error?: { message?: string }; type?: string };
    return parsed.message ?? parsed.error?.message ?? body.slice(0, 400) ?? `AI request failed (${status})`;
  } catch {
    return body.slice(0, 400) || `AI request failed (${status})`;
  }
}

async function gatewayFetchWithBackoff(body: Record<string, unknown>, key: string) {
  let attempt = 0;
  let last: Response | null = null;
  while (attempt < 3) {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": key,
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify(body),
    });
    if (res.ok) return res;
    last = res;
    if (res.status !== 429 && res.status < 500) return res;
    const retryAfter = Number(res.headers.get("Retry-After"));
    const waitMs = Number.isFinite(retryAfter)
      ? Math.min(10_000, Math.max(1_000, retryAfter * 1000))
      : 900 * 2 ** attempt + Math.floor(Math.random() * 300);
    await new Promise((resolve) => setTimeout(resolve, waitMs));
    attempt += 1;
  }
  return last;
}

async function readResponsesStream(res: Response) {
  if (!res.body) return "";
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split("\n\n");
    buffer = chunks.pop() ?? "";
    for (const chunk of chunks) {
      for (const line of chunk.split("\n")) {
        if (!line.startsWith("data:")) continue;
        const data = line.slice(5).trim();
        if (!data || data === "[DONE]") continue;
        try {
          const event = JSON.parse(data) as {
            type?: string;
            delta?: string;
            response?: { output_text?: string; status?: string };
          };
          if (event.type === "response.output_text.delta" && event.delta) text += event.delta;
          if (!text && event.type === "response.completed" && event.response?.output_text) {
            text = event.response.output_text;
          }
        } catch {
          // Ignore malformed stream fragments; terminal status is handled by HTTP status.
        }
      }
    }
  }
  return text.trim();
}

export const getSovereignEyeWorkspace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => CountryInput.parse(data))
  .handler(async ({ data, context }) => {
    await assertCountryAccess(context, data.countryCode.toUpperCase());
    return loadWorkspaceData(data.countryCode);
  });

export const saveSovereignEyeScene = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => SaveSceneInput.parse(data))
  .handler(async ({ data, context }) => {
    const countryCode = data.countryCode.toUpperCase();
    await assertCountryAccess(context, countryCode);
    if (data.visibility === "public" && data.layers.some((layer) => layer.visibility.private > 0)) {
      throw new Error("Remove layers containing private country evidence before creating a public link.");
    }
    const shareToken = data.visibility === "public" ? crypto.randomUUID().replaceAll("-", "") : null;
    const { data: row, error } = await context.supabase
      .from("sovereign_eye_scenes")
      .insert({
        country_code: countryCode,
        title: data.title,
        description: data.description,
        layers: data.layers as unknown as Json,
        camera: data.camera as Json,
        notes: data.notes,
        visibility: data.visibility,
        share_token: shareToken,
        created_by: context.userId,
      })
      .select("id,country_code,title,description,layers,camera,notes,visibility,share_token,updated_at")
      .single();
    if (error) throw new Error(error.message);
    return toScene(row);
  });

export const generateSovereignEyeBrief = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => BriefInput.parse(data))
  .handler(async ({ data, context }) => {
    const countryCode = data.countryCode.toUpperCase();
    await assertCountryAccess(context, countryCode);
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("AI briefing is not configured for this workspace.");
    const workspace = await loadWorkspaceData(countryCode);
    const selected = workspace.layers.filter((l) => data.selectedLayerIds.includes(l.id));
    const prompt = [
      `Country: ${workspace.country.name} (${workspace.country.code})`,
      `Question: ${data.question?.trim() || "Prepare a sovereign-eye readout of the active map layers."}`,
      `Layers: ${selected.map((l) => `${l.label} ${l.status} strength ${l.strength ?? "unknown"} evidence ${l.evidenceCount} public ${l.visibility.public} private ${l.visibility.private}`).join("; ")}`,
      `KPIs: ${workspace.kpis.map((k) => `${k.label}: ${k.value ?? "—"}${k.unit} ${k.period ?? ""}`).join("; ")}`,
      `Sectors: ${workspace.sectors.map((s) => `${s.label} ${s.share.toFixed(2)}% grade ${s.grade}`).join("; ")}`,
      `Capital flows: ${workspace.flows.map((f) => `${f.label} ${f.side} US$${f.valueUsdM.toFixed(2)}m ${f.period}`).join("; ")}`,
      `Live feeds: ${workspace.live.weather.summary}; ${workspace.live.earthquakes.summary}`,
      "Write a concise briefing for a Cabinet or country administrator. Use only the evidence above. Do not mention internal platform names. Flag gaps plainly. Structure with: Situation, What changed, Exposure, Evidence gaps, Recommended next actions.",
    ].join("\n");

    const res = await gatewayFetchWithBackoff(
      {
        model: "openai/gpt-6-astra",
        stream: true,
        reasoning: { effort: "low", summary: "auto" },
        include: ["reasoning.encrypted_content"],
        input: [
          {
            role: "developer",
            content: [
              {
                type: "input_text",
                text: "You are a sovereign economic-intelligence analyst. Be concrete, source-limited, and operational.",
              },
            ],
          },
          { role: "user", content: [{ type: "input_text", text: prompt }] },
        ],
      },
      key,
    );
    if (!res) throw new Error("AI briefing did not return a response.");
    if (!res.ok) {
      const body = await res.text();
      throw new Error(gatewayMessage(res.status, body));
    }
    const text = await readResponsesStream(res);
    return {
      text: text || "The AI run completed without answer text. Review the selected layers and try again.",
      generatedAt: new Date().toISOString(),
    };
  });

export const getPublicSovereignEyeScene = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => PublicSceneInput.parse(data))
  .handler(async ({ data }) => {
    const url = process.env["SUPABASE_URL"];
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
    if (!url || !key) throw new Error("Shared scenes are not configured.");
    const supabasePublic = createClient<Database>(url, key, {
      auth: { persistSession: false },
      global: {
        fetch: (input, init) => {
          const headers = new Headers(init?.headers);
          if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) {
            headers.delete("Authorization");
          }
          headers.set("apikey", key);
          return fetch(input, { ...init, headers });
        },
      },
    });
    const { data: row, error } = await supabasePublic
      .from("sovereign_eye_scenes")
      .select("id,country_code,title,description,layers,camera,notes,visibility,share_token,updated_at")
      .eq("share_token", data.token)
      .eq("visibility", "public")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("This shared scene is not available.");
    return toScene(row);
  });