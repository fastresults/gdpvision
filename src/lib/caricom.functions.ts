// @domain caricom
// @tables countries,country_kpis,country_kpi_points,peer_kpi_normalized
// @ui src/components/home/BlocEconomicSummaryModal.tsx

import { createServerFn } from "@tanstack/react-start";

import { requireAdmin } from "@/lib/auth/require-admin";
import { CARICOM_OECS_REGISTRY, isCaricom, isOecs } from "@/lib/caricom-registry";
import { median, normalizeUnit, parsePeriod } from "@/lib/sovereign-eye/peer-stats";

export type BlocKey = "caricom" | "oecs";

export type BlocDistributionPoint = {
  code: string;
  name: string;
  value: number;
  period: string;
  sourceUrl: string | null;
};

export type BlocMetric = {
  key: string;
  label: string;
  value: number | null;
  unit: string;
  method: "total" | "weighted average" | "median";
  period: string;
  coverage: number;
  eligible: number;
  available: boolean;
  distribution: BlocDistributionPoint[];
};

export type BlocTrend = {
  key: string;
  label: string;
  unit: string;
  points: Array<{ year: number; value: number; coverage: number; eligible: number }>;
};

export type BlocSummary = {
  key: BlocKey;
  label: string;
  memberCount: number;
  updatedAt: string | null;
  metrics: BlocMetric[];
  trends: BlocTrend[];
};

export type BlocEconomicSummary = {
  generatedAt: string;
  blocs: Record<BlocKey, BlocSummary>;
};

type NormalizedRow = {
  country_code: string;
  kpi_code: string;
  value_std: number | null;
  unit_std: string;
  ref_year: number | null;
  excluded_reason: string | null;
  source_kpi_id: string;
  updated_at: string;
};

type CountryRow = {
  code: string;
  name: string;
  gdp_current_usd: number | string | null;
  gdp_year: number | null;
};

type KpiRow = {
  id: string;
  country_code: string;
  kpi_code: string;
  source_url: string | null;
  visibility: string | null;
};

type PointRow = {
  country_kpi_id: string;
  period: string;
  value: number | string;
  visibility: string | null;
};

const METRICS = [
  { key: "gdp", label: "Combined GDP", unit: "USD", method: "total" as const },
  { key: "population", label: "Combined population", unit: "people", method: "total" as const },
  { key: "exports_of_goods_and_services", label: "Export intensity", unit: "% of GDP", method: "median" as const },
  { key: "real_gdp_growth", label: "Real GDP growth", unit: "%", method: "weighted average" as const },
  { key: "gdp_per_capita_current_usd", label: "GDP per person", unit: "USD", method: "weighted average" as const },
  { key: "debt_gdp", label: "Government debt", unit: "% of GDP", method: "median" as const },
  { key: "fdi_net_inflows_gdp", label: "FDI inflows", unit: "% of GDP", method: "median" as const },
  { key: "current_account_gdp", label: "Current account", unit: "% of GDP", method: "median" as const },
  { key: "unemployment_rate", label: "Unemployment", unit: "%", method: "median" as const },
] as const;

const TREND_KEYS = new Set(["real_gdp_growth", "debt_gdp", "unemployment_rate"]);
const MIN_COVERAGE = 0.7;

function membersFor(bloc: BlocKey): string[] {
  return CARICOM_OECS_REGISTRY.filter((nation) =>
    bloc === "caricom" ? isCaricom(nation.code) : isOecs(nation.code),
  ).map((nation) => nation.code);
}

function weightedAverage(rows: Array<{ value: number; weight: number }>): number | null {
  const usable = rows.filter((row) => Number.isFinite(row.value) && Number.isFinite(row.weight) && row.weight > 0);
  const weight = usable.reduce((sum, row) => sum + row.weight, 0);
  if (!weight) return null;
  return usable.reduce((sum, row) => sum + row.value * row.weight, 0) / weight;
}

function latestPeriod(rows: NormalizedRow[]): string {
  const years = rows.map((row) => row.ref_year).filter((year): year is number => year != null);
  if (!years.length) return "Current readings";
  const min = Math.min(...years);
  const max = Math.max(...years);
  return min === max ? String(max) : `${min}–${max}`;
}

function makeSummary(
  bloc: BlocKey,
  normalized: NormalizedRow[],
  countries: CountryRow[],
  kpis: KpiRow[],
  points: PointRow[],
): BlocSummary {
  const memberCodes = membersFor(bloc);
  const memberSet = new Set(memberCodes);
  const names = new Map(countries.map((country) => [country.code, country.name]));
  const sourceByKpi = new Map(kpis.map((kpi) => [kpi.id, kpi.source_url]));
  const countryByCode = new Map(countries.map((country) => [country.code, country]));
  const rows = normalized.filter(
    (row) => memberSet.has(row.country_code) && row.excluded_reason == null && row.value_std != null,
  );
  const populationByCode = new Map(
    rows
      .filter((row) => row.kpi_code === "population")
      .map((row) => [row.country_code, Number(row.value_std)]),
  );
  const gdpByCode = new Map(
    memberCodes.flatMap((code) => {
      const country = countryByCode.get(code);
      const value = Number(country?.gdp_current_usd);
      return Number.isFinite(value) && value > 0 ? [[code, value] as const] : [];
    }),
  );

  const metrics: BlocMetric[] = METRICS.map((definition) => {
    if (definition.key === "gdp") {
      const distribution = memberCodes.flatMap((code) => {
        const country = countryByCode.get(code);
        const value = gdpByCode.get(code);
        return value == null
          ? []
          : [{ code, name: country?.name ?? code, value, period: String(country?.gdp_year ?? "Current"), sourceUrl: null }];
      });
      const available = distribution.length / memberCodes.length >= MIN_COVERAGE;
      return {
        ...definition,
        value: available ? distribution.reduce((sum, row) => sum + row.value, 0) : null,
        period: distribution.length ? latestSpan(distribution.map((row) => row.period)) : "Unavailable",
        coverage: distribution.length,
        eligible: memberCodes.length,
        available,
        distribution,
      };
    }

    const metricRows = rows.filter((row) => row.kpi_code === definition.key);
    const distribution = metricRows.map((row) => ({
      code: row.country_code,
      name: names.get(row.country_code) ?? row.country_code,
      value: Number(row.value_std),
      period: String(row.ref_year ?? "Current"),
      sourceUrl: sourceByKpi.get(row.source_kpi_id) ?? null,
    }));
    const available = distribution.length / memberCodes.length >= MIN_COVERAGE;
    let value: number | null = null;
    if (available && definition.method === "total") {
      value = distribution.reduce((sum, row) => sum + row.value, 0);
    } else if (available && definition.method === "weighted average") {
      const weights = definition.key === "gdp_per_capita_current_usd" ? populationByCode : gdpByCode;
      value = weightedAverage(distribution.map((row) => ({ value: row.value, weight: weights.get(row.code) ?? 0 })));
    } else if (available) {
      value = median(distribution.map((row) => row.value));
    }
    return {
      ...definition,
      value,
      period: latestPeriod(metricRows),
      coverage: distribution.length,
      eligible: memberCodes.length,
      available: available && value != null,
      distribution,
    };
  });

  const kpiById = new Map(kpis.filter((kpi) => memberSet.has(kpi.country_code)).map((kpi) => [kpi.id, kpi]));
  const trendBuckets = new Map<string, Map<number, Map<string, number>>>();
  for (const point of points) {
    const kpi = kpiById.get(point.country_kpi_id);
    if (!kpi || !TREND_KEYS.has(kpi.kpi_code)) continue;
    const parsed = parsePeriod(point.period);
    const value = Number(point.value);
    if (parsed.year == null || parsed.projection || !Number.isFinite(value)) continue;
    const byYear = trendBuckets.get(kpi.kpi_code) ?? new Map<number, Map<string, number>>();
    const byCountry = byYear.get(parsed.year) ?? new Map<string, number>();
    byCountry.set(kpi.country_code, value);
    byYear.set(parsed.year, byCountry);
    trendBuckets.set(kpi.kpi_code, byYear);
  }

  const trends: BlocTrend[] = [...TREND_KEYS].map((key) => {
    const definition = METRICS.find((metric) => metric.key === key);
    const years = trendBuckets.get(key) ?? new Map<number, Map<string, number>>();
    const trendPoints = [...years.entries()]
      .map(([year, values]) => ({
        year,
        value: median([...values.values()]),
        coverage: values.size,
        eligible: memberCodes.length,
      }))
      .filter((point) => point.coverage / point.eligible >= MIN_COVERAGE)
      .sort((a, b) => a.year - b.year)
      .slice(-6);
    return { key, label: definition?.label ?? key, unit: definition?.unit ?? normalizeUnit("%"), points: trendPoints };
  });

  const updates = rows.map((row) => row.updated_at).filter(Boolean).sort();
  return {
    key: bloc,
    label: bloc === "caricom" ? "CARICOM" : "OECS",
    memberCount: memberCodes.length,
    updatedAt: updates.at(-1) ?? null,
    metrics,
    trends,
  };
}

function latestSpan(periods: string[]): string {
  const years = periods.map((period) => Number(period)).filter(Number.isFinite);
  if (!years.length) return "Current readings";
  const min = Math.min(...years);
  const max = Math.max(...years);
  return min === max ? String(max) : `${min}–${max}`;
}

export const getBlocEconomicSummary = createServerFn({ method: "GET" })
  .middleware([requireAdmin])
  .handler(async ({ context }): Promise<BlocEconomicSummary> => {
    const [normalizedResult, countriesResult, kpisResult] = await Promise.all([
      context.supabase
        .from("peer_kpi_normalized")
        .select("country_code,kpi_code,value_std,unit_std,ref_year,excluded_reason,source_kpi_id,updated_at"),
      context.supabase.from("countries").select("code,name,gdp_current_usd,gdp_year"),
      context.supabase
        .from("country_kpis")
        .select("id,country_code,kpi_code,source_url,visibility")
        .eq("visibility", "public"),
    ]);
    if (normalizedResult.error) throw normalizedResult.error;
    if (countriesResult.error) throw countriesResult.error;
    if (kpisResult.error) throw kpisResult.error;

    const kpis = (kpisResult.data ?? []) as KpiRow[];
    const ids = kpis.map((kpi) => kpi.id);
    const pointsResult = ids.length
      ? await context.supabase
          .from("country_kpi_points")
          .select("country_kpi_id,period,value,visibility")
          .in("country_kpi_id", ids)
          .eq("visibility", "public")
      : { data: [] as PointRow[], error: null };
    if (pointsResult.error) throw pointsResult.error;

    const normalized = (normalizedResult.data ?? []) as NormalizedRow[];
    const countries = (countriesResult.data ?? []) as CountryRow[];
    const points = (pointsResult.data ?? []) as PointRow[];
    return {
      generatedAt: new Date().toISOString(),
      blocs: {
        caricom: makeSummary("caricom", normalized, countries, kpis, points),
        oecs: makeSummary("oecs", normalized, countries, kpis, points),
      },
    };
  });