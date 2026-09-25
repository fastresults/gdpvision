// @domain standards
// @tables reporting_standards,standard_requirements,country_kpis,country_kpi_points,collection_protocols,standard_kpi_mappings
// @ui src/routes/_authenticated/admin/countries.$code.standards.tsx
//
// Loads everything the standards audit needs for one country and runs the pure
// scoring in ./scoring.ts. Shared by the page's server function (user client,
// RLS applies) and the monthly snapshot (service-role client), so the page and
// the recorded history are always computed the same way.

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import { db, type CollectionPlanRow, type MappingRow } from "@/lib/syndication/db";

import {
  computeAudit,
  type AuditRow,
  type AuditSummary,
  type FigureInput,
  type MappingInput,
  type PlanInput,
  type RequirementInput,
} from "./scoring";

export type TypedClient = SupabaseClient<Database>;

export type StandardInfo = {
  code: string;
  name: string;
  body: string;
  category: string;
  url: string | null;
};

export type Library = {
  standards: StandardInfo[];
  requirements: RequirementInput[];
};

export type CatalogKpi = {
  id: string;
  kpiCode: string;
  label: string;
  unit: string;
  category: string | null;
  latestValue: number | null;
  latestPeriod: string | null;
  sourceUrl: string | null;
};

export type CountryAudit = {
  library: Library;
  catalog: CatalogKpi[];
  plans: CollectionPlanRow[];
  mappings: MappingRow[];
  rows: AuditRow[];
  summary: AuditSummary;
};

/** Points read per figure, newest first — enough to tell monthly from yearly release. */
const POINTS_PER_KPI = 24;
/** PostgREST caps a response at 1000 rows; keep each points query under it. */
const KPI_IDS_PER_QUERY = 40;

/** The standards library. Global, so the snapshot loads it once for all countries. */
export async function loadLibrary(sb: TypedClient): Promise<Library> {
  const [st, rq] = await Promise.all([
    sb.from("reporting_standards").select("code,name,body,category,url").order("code"),
    sb
      .from("standard_requirements")
      .select("id,standard_code,req_key,label,clause,frequency,max_lag_months,impact,kpi_codes")
      .order("standard_code")
      .order("req_key"),
  ]);
  if (st.error) throw new Error(st.error.message);
  if (rq.error) throw new Error(rq.error.message);
  return {
    standards: st.data ?? [],
    requirements: (rq.data ?? []).map((r) => ({
      id: r.id,
      standardCode: r.standard_code,
      reqKey: r.req_key,
      label: r.label,
      clause: r.clause,
      frequency: r.frequency,
      maxLagMonths: r.max_lag_months,
      impact: r.impact,
      kpiCodes: r.kpi_codes ?? [],
    })),
  };
}

/** Every figure the country holds, paged past the 1000-row response cap. */
export async function loadCatalog(sb: TypedClient, code: string): Promise<CatalogKpi[]> {
  const out: CatalogKpi[] = [];
  const page = 1000;
  for (let from = 0; ; from += page) {
    const { data, error } = await sb
      .from("country_kpis")
      .select("id,kpi_code,label,unit,category,latest_value,latest_period,source_url")
      .eq("country_code", code)
      .order("kpi_code")
      .range(from, from + page - 1);
    if (error) throw new Error(error.message);
    for (const k of data ?? []) {
      out.push({
        id: k.id,
        kpiCode: k.kpi_code,
        label: k.label,
        unit: k.unit,
        category: k.category,
        latestValue: k.latest_value,
        latestPeriod: k.latest_period,
        sourceUrl: k.source_url,
      });
    }
    if (!data || data.length < page) break;
  }
  return out;
}

async function loadPointPeriods(sb: TypedClient, kpiIds: string[]): Promise<Map<string, string[]>> {
  const byKpi = new Map<string, string[]>();
  const chunks: string[][] = [];
  for (let i = 0; i < kpiIds.length; i += KPI_IDS_PER_QUERY)
    chunks.push(kpiIds.slice(i, i + KPI_IDS_PER_QUERY));
  const results = await Promise.all(
    chunks.map((ids) =>
      sb
        .from("country_kpi_points")
        .select("country_kpi_id,period")
        .in("country_kpi_id", ids)
        .order("period", { ascending: false })
        .limit(ids.length * POINTS_PER_KPI),
    ),
  );
  for (const r of results) {
    if (r.error) throw new Error(r.error.message);
    for (const p of r.data ?? []) {
      const list = byKpi.get(p.country_kpi_id) ?? [];
      if (list.length < POINTS_PER_KPI) list.push(p.period);
      byKpi.set(p.country_kpi_id, list);
    }
  }
  return byKpi;
}

/**
 * Loads one country's figures, plans and mappings and scores every requirement.
 * `library` can be passed in when auditing many countries in one run.
 */
export async function computeCountryAudit(
  sb: TypedClient,
  code: string,
  opts: { library?: Library; now?: Date } = {},
): Promise<CountryAudit> {
  const c = db(sb);
  const [library, catalog, pl, mp] = await Promise.all([
    opts.library ? Promise.resolve(opts.library) : loadLibrary(sb),
    loadCatalog(sb, code),
    c.from("collection_protocols").select("*").eq("country_code", code),
    c.from("standard_kpi_mappings").select("*").eq("country_code", code),
  ]);
  if (pl.error) throw new Error(pl.error.message);
  if (mp.error) throw new Error(mp.error.message);
  const plans = (pl.data ?? []) as CollectionPlanRow[];
  const mappings = (mp.data ?? []) as MappingRow[];

  // Only figures some requirement can use need their point history.
  const wanted = new Set<string>();
  for (const r of library.requirements) for (const k of r.kpiCodes) wanted.add(k);
  for (const m of mappings) if (m.status === "accepted") wanted.add(m.kpi_code);
  const relevant = catalog.filter((k) => wanted.has(k.kpiCode));
  const points = await loadPointPeriods(
    sb,
    relevant.map((k) => k.id),
  );

  const figures: FigureInput[] = relevant.map((k) => ({
    kpiCode: k.kpiCode,
    label: k.label,
    latestValue: k.latestValue,
    latestPeriod: k.latestPeriod,
    sourceUrl: k.sourceUrl,
    pointPeriods: points.get(k.id) ?? [],
  }));
  const planInputs: PlanInput[] = plans.map((p) => ({
    id: p.id,
    requirementId: p.requirement_id,
    status: p.status,
    ownerAgency: p.owner_agency,
    dueDate: p.due_date,
    version: p.version ?? 1,
  }));
  const mappingInputs: MappingInput[] = mappings.map((m) => ({
    requirementId: m.requirement_id,
    kpiCode: m.kpi_code,
    status: m.status,
  }));

  const { rows, summary } = computeAudit({
    requirements: library.requirements,
    figures,
    plans: planInputs,
    mappings: mappingInputs,
    standardCodes: library.standards.map((s) => s.code),
    now: opts.now,
  });
  return { library, catalog, plans, mappings, rows, summary };
}

/** The shape written to standards_audit_snapshots. */
export function snapshotRecord(
  code: string,
  periodLabel: string,
  audit: Pick<CountryAudit, "rows" | "summary">,
) {
  return {
    country_code: code,
    period_label: periodLabel,
    computed_at: new Date().toISOString(),
    coverage_pct: audit.summary.coveragePct,
    weighted_pct: audit.summary.weightedPct,
    counts: audit.summary.counts,
    by_standard: audit.summary.byStandard,
    rows: audit.rows.map((r) => ({ id: r.id, status: r.status })),
  };
}

/** "YYYY-MM" for the given date, in UTC. */
export function monthLabel(at: Date): string {
  return `${at.getUTCFullYear()}-${String(at.getUTCMonth() + 1).padStart(2, "0")}`;
}
