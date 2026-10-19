// @domain indices
// @tables country_kpis,index_evidence
// @ui none
//
// Source adapters for the Caribbean Indices runner. Each returns, per country,
// the dated observations for one indicator plus a grade and whether the source
// answered. Keyless public APIs are pulled directly (World Bank WDI, IMF WEO
// DataMapper); documentary and external-assessment values come only from
// verified rows in index_evidence. Nothing here is AI-assembled.

import type { Grade, Observation } from "./scoring";
import { db, type AnyClient } from "@/lib/syndication/db";

export interface Country {
  code: string;
  iso3: string;
}

export interface SourceResult {
  byCountry: Map<
    string,
    {
      observations: Observation[];
      grade: Grade | null;
      source_url: string | null;
      source_org: string | null;
    }
  >;
  ok: boolean;
  error: string | null;
}

const FIRST_YEAR = 2010;
const TIMEOUT_MS = 20_000;

async function getJson(url: string): Promise<unknown> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctl.signal, headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

let economies: { at: number; set: Promise<Set<string> | null> } | null = null;

/** ISO3 codes the World Bank API publishes, cached for an hour; null if the list is unreachable. */
export function worldBankEconomies(): Promise<Set<string> | null> {
  if (economies && Date.now() - economies.at < 3_600_000) return economies.set;
  const set = getJson("https://api.worldbank.org/v2/country?format=json&per_page=500")
    .then((json) => {
      const rows = (Array.isArray(json) ? json[1] : null) as Array<{ id: string }> | null;
      return rows?.length ? new Set(rows.map((r) => r.id.toUpperCase())) : null;
    })
    .catch(() => null);
  economies = { at: Date.now(), set };
  return set;
}

/** World Bank WDI (and other WB API databases). Multilateral → grade C. */
export async function fetchWdi(
  code: string,
  countries: Country[],
  cutoffYear: number,
): Promise<SourceResult> {
  const byCountry: SourceResult["byCountry"] = new Map();
  // One unknown code makes the World Bank reject the whole request, so ask only
  // for economies it publishes (Guadeloupe, Martinique, Montserrat are not among them).
  const known = await worldBankEconomies();
  const asked = known ? countries.filter((c) => known.has(c.iso3.toUpperCase())) : countries;
  if (!asked.length) return { byCountry, ok: true, error: null };
  const iso = asked.map((c) => c.iso3).join(";");
  const byIso = new Map(asked.map((c) => [c.iso3, c.code]));
  const base = `https://api.worldbank.org/v2/country/${iso}/indicator/${encodeURIComponent(code)}?format=json&per_page=2000&date=${FIRST_YEAR}:${cutoffYear}`;
  const attempt = async (url: string) => {
    const json = (await getJson(url)) as unknown[];
    // a valid request with no observations comes back as [{ total: 0, … }, null]
    if (Array.isArray(json) && (json[0] as { total?: number } | undefined)?.total === 0) return [];
    if (!Array.isArray(json) || json.length < 2 || !Array.isArray(json[1])) {
      const msg = (json as Array<{ message?: Array<{ value?: string }> }>)?.[0]?.message?.[0]
        ?.value;
      throw new Error(msg ?? "no data array");
    }
    return json[1] as Array<{ countryiso3code: string; date: string; value: number | null }>;
  };
  try {
    let rows: Array<{ countryiso3code: string; date: string; value: number | null }>;
    try {
      rows = await attempt(base);
    } catch {
      rows = await attempt(`${base}&source=3`); // Worldwide Governance Indicators database
    }
    for (const r of rows) {
      const cc = byIso.get(r.countryiso3code);
      if (!cc || r.value == null || !Number.isFinite(Number(r.value))) continue;
      const entry = byCountry.get(cc) ?? {
        observations: [],
        grade: "C" as Grade,
        source_url: `https://data.worldbank.org/indicator/${code}?locations=${r.countryiso3code}`,
        source_org: "World Bank",
      };
      entry.observations.push({ period: String(r.date).slice(0, 4), value: Number(r.value) });
      byCountry.set(cc, entry);
    }
    return { byCountry, ok: true, error: null };
  } catch (e) {
    return { byCountry, ok: false, error: (e as Error).message.slice(0, 300) };
  }
}

/**
 * IMF WEO via DataMapper. The current and previous year are WEO projections or staff
 * estimates for most Caribbean economies, so only years up to cut-off − 2 are used.
 */
export async function fetchImfWeo(
  code: string,
  countries: Country[],
  cutoffYear: number,
): Promise<SourceResult> {
  const byCountry: SourceResult["byCountry"] = new Map();
  const url = `https://www.imf.org/external/datamapper/api/v1/${encodeURIComponent(code)}/${countries.map((c) => c.iso3).join("/")}`;
  try {
    const json = (await getJson(url)) as {
      values?: Record<string, Record<string, Record<string, number>>>;
    };
    // an unknown code returns the country list instead of values: that is a failure, not "no data"
    if (!json?.values?.[code]) throw new Error(`IMF DataMapper has no series ${code}`);
    const series = json.values[code];
    for (const c of countries) {
      const s = series[c.iso3];
      if (!s) continue;
      const observations = Object.entries(s)
        .filter(
          ([y, v]) =>
            Number(y) >= FIRST_YEAR &&
            Number(y) < cutoffYear - 1 &&
            typeof v === "number" &&
            Number.isFinite(v),
        )
        .map(([y, v]) => ({ period: y, value: v }));
      if (observations.length)
        byCountry.set(c.code, {
          observations,
          grade: "C",
          source_url: `https://www.imf.org/external/datamapper/${code}@WEO/${c.iso3}`,
          source_org: "IMF World Economic Outlook",
        });
    }
    return { byCountry, ok: true, error: null };
  } catch (e) {
    return { byCountry, ok: false, error: (e as Error).message.slice(0, 300) };
  }
}

/** Grade for a registry KPI from its source host: multilateral C, government B, otherwise D. */
function kpiGrade(url: string | null): Grade {
  if (!url) return "D";
  try {
    const h = new URL(url).hostname;
    if (
      /(worldbank|imf|un|undp|who|unesco|ilo|oecd|eccb-centralbank|caribank|cepal|paho)\.org$/.test(
        h,
      ) ||
      h.endsWith(".un.org")
    )
      return "C";
    if (/\.gov(\.[a-z]{2})?$/.test(h) || /\.gov\.[a-z]{2}$/.test(h)) return "B";
  } catch {
    return "D";
  }
  return "D";
}

/** Public, non-inferred registry KPIs (country_kpis). */
export async function fetchKpi(
  sb: AnyClient,
  kpiCode: string,
  countries: Country[],
): Promise<SourceResult> {
  const byCountry: SourceResult["byCountry"] = new Map();
  const { data, error } = await db(sb)
    .from("country_kpis")
    .select("country_code,latest_value,latest_period,source_url,provenance")
    .eq("kpi_code", kpiCode)
    .eq("visibility", "public")
    .not("latest_value", "is", null)
    .in(
      "country_code",
      countries.map((c) => c.code),
    );
  if (error) return { byCountry, ok: false, error: error.message };
  for (const r of (data ?? []) as Array<{
    country_code: string;
    latest_value: number;
    latest_period: string | null;
    source_url: string | null;
    provenance: string;
  }>) {
    // only values a person verified or entered; AI-inferred or AI-researched values never enter an index
    if (!["admin_verified", "admin_override"].includes(r.provenance) || !r.latest_period) continue;
    byCountry.set(r.country_code, {
      observations: [
        { period: String(r.latest_period).slice(0, 4), value: Number(r.latest_value) },
      ],
      grade: kpiGrade(r.source_url),
      source_url: r.source_url,
      source_org: null,
    });
  }
  return { byCountry, ok: true, error: null };
}

/** Every verified documentary / external-assessment value, grouped by "INDEX.indicator". */
export async function fetchAllEvidence(
  sb: AnyClient,
  countries: Country[],
): Promise<{
  byIndicator: Map<string, SourceResult["byCountry"]>;
  ok: boolean;
  error: string | null;
}> {
  const byIndicator = new Map<string, SourceResult["byCountry"]>();
  // PostgREST caps a response at 1,000 rows: page through until a short page.
  const PAGE = 1000;
  const data: unknown[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data: page, error } = await db(sb)
      .from("index_evidence")
      .select("index_code,indicator_code,country_code,value,period,document_url,publisher,grade")
      .eq("verified", true)
      .in(
        "country_code",
        countries.map((c) => c.code),
      )
      .order("period", { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) return { byIndicator, ok: false, error: error.message };
    data.push(...(page ?? []));
    if ((page ?? []).length < PAGE) break;
  }
  type Row = {
    index_code: string;
    indicator_code: string;
    country_code: string;
    value: number;
    period: string;
    document_url: string;
    publisher: string;
    grade: Grade;
  };
  for (const r of data as Row[]) {
    const key = `${r.index_code}.${r.indicator_code}`;
    const m = byIndicator.get(key) ?? new Map();
    const e = m.get(r.country_code) ?? {
      observations: [],
      grade: r.grade,
      source_url: r.document_url,
      source_org: r.publisher,
    };
    e.observations.push({ period: String(r.period).slice(0, 4), value: Number(r.value) });
    // rows arrive oldest first, so the newest document ends up as the cited one
    e.source_url = r.document_url;
    e.source_org = r.publisher;
    e.grade = r.grade;
    m.set(r.country_code, e);
    byIndicator.set(key, m);
  }
  return { byIndicator, ok: true, error: null };
}
