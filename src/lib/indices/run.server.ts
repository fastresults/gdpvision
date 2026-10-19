// @domain indices
// @tables index_specs,index_pillars,index_indicators,index_evidence,index_runs,index_inputs,index_scores,index_releases,countries,country_kpis
// @ui none
//
// The Caribbean Indices runner. Gathers every input from its declared source,
// freezes a copy of each value it used (or excluded, with the reason), scores
// with the pure functions in scoring.ts, and records the run. Called by the
// scheduled hook (/api/public/hooks/indices) and by admins from indices.functions.ts.
//
//   watch    weekly: refresh inputs and Sextant; no release
//   tracker  monthly: same, plus a draft PROVISIONAL tracker release
//   edition  manual only: a draft official edition, published after sign-off

import {
  rankScores,
  scoreCountry,
  type IndexSpec,
  type IndicatorSpec,
  type RawInput,
} from "./scoring";
import {
  fetchAllEvidence,
  fetchImfWeo,
  fetchKpi,
  fetchWdi,
  type Country,
  type SourceResult,
} from "./sources.server";
import { db, type AnyClient } from "@/lib/syndication/db";

export type RunMode = "watch" | "tracker" | "edition";

interface IndicatorRow extends IndicatorSpec {
  index_code: string;
  source_kind: "wdi" | "imf_weo" | "kpi" | "evidence";
  source_code: string | null;
  source_org: string;
  source_url: string | null;
  licence: string;
}

export interface RunSummary {
  run_id: string;
  mode: RunMode;
  data_cutoff: string;
  release_id: string | null;
  indexes: Record<string, { scored: number; not_scored: number; median_sextant: number | null }>;
  sources: { ok: number; failed: Array<{ indicator: string; error: string }> };
}

async function admin(): Promise<AnyClient> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as AnyClient;
}

export async function loadSpecs(
  sb: AnyClient,
): Promise<{ specs: IndexSpec[]; indicators: IndicatorRow[] }> {
  const c = db(sb);
  const [s, p, i] = await Promise.all([
    c
      .from("index_specs")
      .select("code,method_version,aggregation,pillar_coverage_min,external_composite_cap,position")
      .order("position"),
    c.from("index_pillars").select("index_code,code,weight,position").order("position"),
    c.from("index_indicators").select("*").order("position"),
  ]);
  const err = s.error ?? p.error ?? i.error;
  if (err) throw new Error(err.message);
  const indicators = (i.data ?? []).map((r: Record<string, unknown>) => ({
    ...(r as unknown as IndicatorRow),
    goal_best: Number(r.goal_best),
    goal_worst: Number(r.goal_worst),
    band_low: r.band_low == null ? null : Number(r.band_low),
    band_high: r.band_high == null ? null : Number(r.band_high),
    weight: Number(r.weight ?? 1),
    is_external_composite: r.indicator_type === "external_composite",
  })) as IndicatorRow[];
  const specs = (
    (s.data ?? []) as Array<{
      code: string;
      method_version: number;
      aggregation: "geometric" | "arithmetic";
      pillar_coverage_min: number;
      external_composite_cap: number | null;
    }>
  ).map((x) => ({
    code: x.code,
    method_version: x.method_version,
    aggregation: x.aggregation,
    pillar_coverage_min: Number(x.pillar_coverage_min),
    external_composite_cap: Number(x.external_composite_cap ?? 0.2),
    pillars: ((p.data ?? []) as Array<{ index_code: string; code: string; weight: number }>)
      .filter((q) => q.index_code === x.code)
      .map((q) => ({ code: q.code, weight: Number(q.weight) })),
    indicators: indicators.filter((q) => q.index_code === x.code),
  }));
  return { specs, indicators };
}

async function fetchSource(
  sb: AnyClient,
  ind: IndicatorRow,
  countries: Country[],
  cutoffYear: number,
): Promise<SourceResult> {
  if (ind.status !== "active") return { byCountry: new Map(), ok: true, error: null };
  switch (ind.source_kind) {
    case "wdi":
      return ind.source_code
        ? fetchWdi(ind.source_code, countries, cutoffYear)
        : { byCountry: new Map(), ok: false, error: "no source_code" };
    case "imf_weo":
      return ind.source_code
        ? fetchImfWeo(ind.source_code, countries, cutoffYear)
        : { byCountry: new Map(), ok: false, error: "no source_code" };
    case "kpi":
      return ind.source_code
        ? fetchKpi(sb, ind.source_code, countries)
        : { byCountry: new Map(), ok: false, error: "no source_code" };
    case "evidence":
      return { byCountry: new Map(), ok: false, error: "evidence is loaded in one query" };
  }
}

async function insertChunked(sb: AnyClient, table: string, rows: Record<string, unknown>[]) {
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await db(sb)
      .from(table)
      .insert(rows.slice(i, i + 500));
    if (error) throw new Error(`${table}: ${error.message}`);
  }
}

const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export async function runIndices(opts: {
  mode: RunMode;
  trigger: "manual" | "scheduled";
  startedBy?: string | null;
  cutoff?: string;
}): Promise<RunSummary> {
  const sb = await admin();
  const c = db(sb);
  const data_cutoff = opts.cutoff ?? new Date().toISOString().slice(0, 10);
  const cutoffYear = Number(data_cutoff.slice(0, 4));

  const { specs, indicators } = await loadSpecs(sb);
  const { data: crows, error: cerr } = await c
    .from("countries")
    .select("code,iso3")
    .not("iso3", "is", null)
    .order("code");
  if (cerr) throw new Error(cerr.message);
  const countries = (crows ?? []) as Country[];

  // a run cut off mid-way (Worker cancelled) never reaches its catch block
  await c
    .from("index_runs")
    .update({
      status: "failed",
      error: "Run did not finish (timed out or cancelled).",
      finished_at: new Date().toISOString(),
    })
    .eq("status", "running")
    .lt("started_at", new Date(Date.now() - 30 * 60_000).toISOString());

  const { data: run, error: rerr } = await c
    .from("index_runs")
    .insert({
      trigger: opts.trigger,
      mode: opts.mode,
      data_cutoff,
      method_versions: Object.fromEntries(specs.map((s) => [s.code, s.method_version])),
      started_by: opts.startedBy ?? null,
    })
    .select("id")
    .single();
  if (rerr) throw new Error(rerr.message);
  const runId = (run as { id: string }).id;

  try {
    // 1 · gather: one request per distinct API series (four at a time), and every
    //     verified evidence row in a single query
    const fetched = new Map<string, SourceResult>();
    const failed: RunSummary["sources"]["failed"] = [];
    let ok = 0;
    const evidence = await fetchAllEvidence(sb, countries);
    const seriesCache = new Map<string, Promise<SourceResult>>();
    const active = indicators.filter((i) => i.status === "active");
    const load = (ind: IndicatorRow): Promise<SourceResult> => {
      if (ind.source_kind === "evidence") {
        return Promise.resolve(
          evidence.ok
            ? {
                byCountry: evidence.byIndicator.get(`${ind.index_code}.${ind.code}`) ?? new Map(),
                ok: true,
                error: null,
              }
            : { byCountry: new Map(), ok: false, error: evidence.error },
        );
      }
      const key = `${ind.source_kind}:${ind.source_code}`;
      if (!seriesCache.has(key)) seriesCache.set(key, fetchSource(sb, ind, countries, cutoffYear));
      return seriesCache.get(key)!;
    };
    for (let i = 0; i < active.length; i += 4) {
      const batch = active.slice(i, i + 4);
      const res = await Promise.all(batch.map(load));
      batch.forEach((ind, j) => {
        fetched.set(`${ind.index_code}.${ind.code}`, res[j]);
        if (res[j].ok) ok++;
        else
          failed.push({
            indicator: `${ind.index_code}.${ind.code}`,
            error: res[j].error ?? "unknown",
          });
      });
    }

    // 2 · score, freeze inputs
    const inputRows: Record<string, unknown>[] = [];
    const scoreRows: Record<string, unknown>[] = [];
    const indexes: RunSummary["indexes"] = {};
    for (const spec of specs) {
      const results = countries.map((country) => {
        const raws: RawInput[] = (spec.indicators as IndicatorRow[]).map((ind) => {
          const src = fetched.get(`${ind.index_code}.${ind.code}`);
          const hit = src?.byCountry.get(country.code);
          return {
            indicator_code: ind.code,
            observations: hit?.observations ?? [],
            grade: hit?.grade ?? null,
            source_ok: src?.ok ?? false,
          };
        });
        return { country, result: scoreCountry(spec, raws, cutoffYear) };
      });
      const ranks = rankScores(
        results.map((r) => ({ country_code: r.country.code, score: r.result.score })),
      );

      for (const { country, result } of results) {
        for (const inp of result.inputs) {
          const ind = (spec.indicators as IndicatorRow[]).find(
            (i) => i.code === inp.indicator_code,
          )!;
          const src = fetched.get(`${ind.index_code}.${ind.code}`);
          const hit = src?.byCountry.get(country.code);
          const latestRaw = hit?.observations.find((o) => o.period === inp.period)?.value ?? null;
          inputRows.push({
            run_id: runId,
            index_code: spec.code,
            indicator_code: inp.indicator_code,
            country_code: country.code,
            raw_value: latestRaw,
            value_used: inp.value_used,
            period: inp.period,
            score: inp.score,
            source_kind: ind.source_kind,
            source_org: hit?.source_org ?? ind.source_org,
            source_url: hit?.source_url ?? ind.source_url,
            licence: ind.licence,
            grade: inp.grade,
            method: inp.method,
            age_years: inp.age_years,
            source_ok: inp.source_ok,
            excluded_reason: inp.excluded_reason,
          });
        }
        scoreRows.push({
          run_id: runId,
          index_code: spec.code,
          country_code: country.code,
          status: result.status,
          score: result.score,
          rank: ranks.get(country.code) ?? null,
          pillar_scores: result.pillar_scores,
          coverage: result.coverage,
          not_scored_reason: result.not_scored_reason,
          sextant: result.sextant,
          sextant_band: result.sextant_band,
          sextant_parts: result.sextant_parts,
          weakest_grade: result.weakest_grade,
          method_version: spec.method_version,
        });
      }
      indexes[spec.code] = {
        scored: results.filter((r) => r.result.status === "scored").length,
        not_scored: results.filter((r) => r.result.status === "not_scored").length,
        median_sextant: median(results.map((r) => r.result.sextant)),
      };
    }
    await insertChunked(sb, "index_inputs", inputRows);
    await insertChunked(sb, "index_scores", scoreRows);

    // 3 · release draft (never published here: publishing needs a named sign-off)
    let release_id: string | null = null;
    if (opts.mode !== "watch") {
      const d = new Date(`${data_cutoff}T00:00:00Z`);
      const label =
        opts.mode === "tracker"
          ? `${data_cutoff.slice(0, 7)} tracker (provisional)`
          : `${d.toLocaleString("en-GB", { month: "long", timeZone: "UTC" })} ${d.getUTCFullYear()} edition`;
      const { data: rel, error } = await c
        .from("index_releases")
        .insert({ run_id: runId, kind: opts.mode === "tracker" ? "tracker" : "edition", label })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      release_id = (rel as { id: string }).id;
    }

    const stats = {
      indexes,
      sources: { ok, failed },
      countries: countries.length,
      inputs: inputRows.length,
    };
    await c
      .from("index_runs")
      .update({ status: "complete", stats, finished_at: new Date().toISOString() })
      .eq("id", runId);
    return {
      run_id: runId,
      mode: opts.mode,
      data_cutoff,
      release_id,
      indexes,
      sources: { ok, failed },
    };
  } catch (e) {
    await c
      .from("index_runs")
      .update({
        status: "failed",
        error: (e as Error).message.slice(0, 1000),
        finished_at: new Date().toISOString(),
      })
      .eq("id", runId);
    throw e;
  }
}
