// @domain public-data
// @tables index_specs,index_pillars,index_indicators,index_releases,index_scores,index_inputs,countries
// @ui none
//
// Public reads of the Caribbean Indices for GDP Advisor (/api/public/v2/indices*,
// the per-country `indices` resource, and the MCP tools). The method layer is
// always public. Scores and inputs come ONLY from published official editions:
// trackers, drafts and runs never leave GDPVision through this module.

import { db, type AnyClient } from "@/lib/syndication/db";

async function admin(): Promise<AnyClient> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as AnyClient;
}

export const INDEX_CODES = ["CGX", "CHX", "CGV", "CCX"] as const;
export type IndexCode = (typeof INDEX_CODES)[number];
export const isIndexCode = (x: string): x is IndexCode =>
  (INDEX_CODES as readonly string[]).includes(x.toUpperCase());

const SEXTANT = {
  name: "Sextant",
  description:
    "How well-measured the inputs behind a score are, 0–100. It does not change the score.",
  parts: [
    {
      code: "availability",
      weight: 0.3,
      measures: "Share of the index's specified indicators with a valid value",
    },
    {
      code: "timeliness",
      weight: 0.25,
      measures: "Age of inputs against each indicator's age tolerance",
    },
    {
      code: "grade_quality",
      weight: 0.3,
      measures: "Grade mix of inputs: A = 100, B = 75, C = 50, D = 25",
    },
    { code: "source_health", weight: 0.15, measures: "Share of sources that answered on the run" },
  ],
  bands: [
    { band: "clear", min: 80 },
    { band: "fair", min: 60 },
    { band: "hazy", min: 40 },
    { band: "obscured", min: 0 },
  ],
};

const METHOD = {
  standard: "OECD/JRC Handbook on Constructing Composite Indicators (2008), ten steps",
  indicator_score: "100 × (x − worst) / (best − worst), clipped to 0–100; log scale where flagged",
  pillar_score:
    "Weighted mean of indicator scores; scored only if ≥ two-thirds of indicators have a valid value",
  index_score: "Geometric mean of pillar scores; scored only if every pillar is scored",
  imputation: "None. Missing coverage shows as not scored.",
  grades: {
    A: "Government-published, current year",
    B: "Government-published, prior year or partial",
    C: "Multilateral or reputable third party",
    D: "Analyst reconstruction",
  },
  publication:
    "Official editions twice a year (after IMF WEO, April and October), signed off before release. Monthly trackers are provisional and private.",
  document: "https://github.com/fastresults/gdpvision/blob/main/docs/prd/PRD-caribbean-indices.md",
};

/** Method, pillars, indicators, sources and licences — plus the list of published editions. */
export async function getIndexCatalogue() {
  const c = db(await admin());
  const [s, p, i, r] = await Promise.all([
    c
      .from("index_specs")
      .select(
        "code,name,pillar_label,question,benchmark,method_version,method_status,aggregation,pillar_coverage_min,external_composite_cap,position,updated_at",
      )
      .order("position"),
    c.from("index_pillars").select("index_code,code,name,weight,position").order("position"),
    c
      .from("index_indicators")
      .select(
        "index_code,code,pillar_code,name,unit,goal_best,goal_worst,log_scale,window_kind,band_low,band_high,source_kind,source_code,source_org,source_url,fallback,licence,licence_status,indicator_type,age_tolerance_years,status,weight,position,notes",
      )
      .order("position"),
    c
      .from("index_releases")
      .select("id,label,published_at,run_id")
      .eq("status", "published")
      .eq("kind", "edition")
      .order("published_at", { ascending: false }),
  ]);
  const err = s.error ?? p.error ?? i.error ?? r.error;
  if (err) throw new Error(err.message);
  const indexes = (s.data ?? []).map((x: Record<string, unknown>) => ({
    ...x,
    pillars: (p.data ?? [])
      .filter((q: Record<string, unknown>) => q.index_code === x.code)
      .map((q: Record<string, unknown>) => ({
        code: q.code,
        name: q.name,
        weight: q.weight,
        position: q.position,
        indicators: (i.data ?? [])
          .filter(
            (k: Record<string, unknown>) => k.index_code === x.code && k.pillar_code === q.code,
          )
          .map(({ index_code: _a, pillar_code: _b, ...k }: Record<string, unknown>) => k),
      })),
  }));
  return {
    method: METHOD,
    sextant: SEXTANT,
    indexes,
    editions: (r.data ?? []).map((e: Record<string, unknown>) => ({
      id: e.id,
      label: e.label,
      published_at: e.published_at,
    })),
  };
}

async function resolveEdition(c: ReturnType<typeof db>, edition?: string | null) {
  let q = c
    .from("index_releases")
    .select("id,run_id,label,published_at")
    .eq("status", "published")
    .eq("kind", "edition");
  q =
    edition && edition !== "latest"
      ? q.eq("id", edition)
      : q.order("published_at", { ascending: false }).limit(1);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data?.[0] ?? null) as {
    id: string;
    run_id: string;
    label: string;
    published_at: string;
  } | null;
}

const SCORE_COLS =
  "index_code,country_code,status,score,rank,pillar_scores,coverage,not_scored_reason,sextant,sextant_band,sextant_parts,weakest_grade,method_version";

/** League table for one index from a published edition. */
export async function getIndexEdition(
  index: string,
  edition?: string | null,
  countries?: string[] | null,
) {
  const code = index.toUpperCase();
  const c = db(await admin());
  const rel = await resolveEdition(c, edition);
  if (!rel) return { index: code, edition: null, count: 0, data: [] as unknown[] };
  let q = c
    .from("index_scores")
    .select(SCORE_COLS)
    .eq("run_id", rel.run_id)
    .eq("index_code", code)
    .order("rank", { ascending: true, nullsFirst: false });
  if (countries?.length) q = q.in("country_code", countries);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const { data: names } = await c.from("countries").select("code,name");
  const nameOf = new Map(
    (names ?? []).map((n: { code: string; name: string }) => [n.code, n.name]),
  );
  const rows = (data ?? []).map((r: Record<string, unknown>) => ({
    ...r,
    country_name: nameOf.get(r.country_code as string) ?? null,
  }));
  return {
    index: code,
    edition: { id: rel.id, label: rel.label, published_at: rel.published_at },
    count: rows.length,
    data: rows,
  };
}

/** All four indexes for one country, with every input ("why this score"), from a published edition. */
export async function getCountryIndices(country: string, edition?: string | null) {
  const cc = country.toUpperCase();
  const c = db(await admin());
  const rel = await resolveEdition(c, edition);
  if (!rel)
    return {
      data: [] as unknown[],
      extra: { edition: null, note: "No official edition has been published yet." },
    };
  const [s, i] = await Promise.all([
    c.from("index_scores").select(SCORE_COLS).eq("run_id", rel.run_id).eq("country_code", cc),
    c
      .from("index_inputs")
      .select(
        "index_code,indicator_code,raw_value,value_used,period,score,source_org,source_url,licence,grade,method,age_years,excluded_reason",
      )
      .eq("run_id", rel.run_id)
      .eq("country_code", cc),
  ]);
  const err = s.error ?? i.error;
  if (err) throw new Error(err.message);
  const data = (s.data ?? []).map((row: Record<string, unknown>) => ({
    ...row,
    inputs: (i.data ?? [])
      .filter((x: Record<string, unknown>) => x.index_code === row.index_code)
      .map(({ index_code: _x, ...x }: Record<string, unknown>) => x),
  }));
  return {
    data,
    extra: { edition: { id: rel.id, label: rel.label, published_at: rel.published_at } },
  };
}
