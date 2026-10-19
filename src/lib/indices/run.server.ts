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
//   test     manual only: a private TEST release so every index can be reviewed on
//            GDP Advisor's preview. Parked sources are fetched too, and any input still
//            missing gets a labelled fixture (testdata.ts, origin 'test_fixture', grade D).
//            A test release can never be published (database CHECK) and expires in 14 days.
//
// Every API request waits and retries (retry.ts). Every successful API series is kept
// as a snapshot; when a live source still fails, a snapshot captured within 30 days
// stands in (origin 'snapshot', source_ok false so the Sextant's source health drops).

import {
  rankScores,
  scoreCountry,
  type IndexSpec,
  type IndicatorSpec,
  type RawInput,
} from "./scoring";
import { scoreForTest } from "./testdata";
import {
  loadSnapshot,
  saveSnapshot,
  snapshotable,
  SNAPSHOT_MAX_AGE_DAYS,
} from "./snapshots.server";
import { setRetryDeadline } from "./retry";
import {
  fetchAllEvidence,
  trackAttempts,
  fetchImfWeo,
  fetchKpi,
  fetchWdi,
  type Country,
  type SourceResult,
} from "./sources.server";
import { db, type AnyClient } from "@/lib/syndication/db";

export type RunMode = "watch" | "tracker" | "edition" | "test";

/** Test releases (and their runs) are deleted after this many days. */
export const TEST_RELEASE_TTL_DAYS = 14;
/** No retry starts after this much of a run has passed. */
const RUN_RETRY_BUDGET_MS = 8 * 60_000;

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
  includeParked = false,
): Promise<SourceResult> {
  // a test run also fetches parked API series (e.g. IMF pending permission) for internal review
  const live =
    ind.status === "active" || (includeParked && snapshotable(ind.source_kind, ind.source_code));
  if (!live) return { byCountry: new Map(), ok: true, error: null };
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

  await purgeExpiredTestReleases(sb);
  // one run at a time: overlapping runs would share the retry budget and attempt log
  {
    const { data: busy } = await c
      .from("index_runs")
      .select("id")
      .eq("status", "running")
      .gte("started_at", new Date(Date.now() - 30 * 60_000).toISOString())
      .limit(1);
    if ((busy ?? []).length)
      throw new Error("Another indices run is in progress; try again when it finishes.");
  }
  const isTest = opts.mode === "test";
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
    const attempts = new Map<string, number>();
    const snapshotsUsed: Array<{ series: string; captured_at: string | null }> = [];
    const snapshotErrors: string[] = [];
    trackAttempts(attempts);
    setRetryDeadline(Date.now() + RUN_RETRY_BUDGET_MS);
    const active = indicators.filter(
      (i) => i.status === "active" || (isTest && snapshotable(i.source_kind, i.source_code)),
    );
    /** Live fetch with retries; on failure the last snapshot (≤ 30 days) stands in. */
    const fetchWithFallback = async (ind: IndicatorRow): Promise<SourceResult> => {
      const res = await fetchSource(sb, ind, countries, cutoffYear, isTest);
      if (!snapshotable(ind.source_kind, ind.source_code)) return res;
      if (res.ok) {
        const err = await saveSnapshot(sb, ind.source_kind, ind.source_code, res, runId);
        if (err) snapshotErrors.push(`${ind.source_kind}:${ind.source_code}: ${err}`);
        return res;
      }
      const snap = await loadSnapshot(sb, ind.source_kind, ind.source_code, SNAPSHOT_MAX_AGE_DAYS);
      if (!snap?.byCountry.size) return res;
      snapshotsUsed.push({
        series: `${ind.source_kind}:${ind.source_code}`,
        captured_at: snap.oldest,
      });
      // source_ok stays false: the score uses the snapshot, the Sextant records the failure
      return { byCountry: snap.byCountry, ok: false, error: res.error, snapshot_at: snap.oldest };
    };
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
      if (!seriesCache.has(key)) seriesCache.set(key, fetchWithFallback(ind));
      return seriesCache.get(key)!;
    };
    // two series at a time, with a short pause between batches, to stay polite to the APIs
    for (let i = 0; i < active.length; i += 2) {
      const batch = active.slice(i, i + 2);
      const res = await Promise.all(batch.map(load));
      batch.forEach((ind, j) => {
        fetched.set(`${ind.index_code}.${ind.code}`, res[j]);
        if (res[j].ok) ok++;
        else
          failed.push({
            indicator: `${ind.index_code}.${ind.code}`,
            error: `${res[j].error ?? "unknown"}${res[j].snapshot_at ? ` (snapshot of ${res[j].snapshot_at!.slice(0, 10)} used)` : ""}`,
          });
      });
      if (i + 2 < active.length) await new Promise((r) => setTimeout(r, 300));
    }
    trackAttempts(null);
    setRetryDeadline(null);
    const fixtureCount: Record<string, number> = {};

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
        if (!isTest)
          return {
            country,
            result: scoreCountry(spec, raws, cutoffYear),
            raws,
            fixtures: new Set<string>(),
          };
        const t = scoreForTest(spec, raws, country.code, cutoffYear);
        fixtureCount[spec.code] = (fixtureCount[spec.code] ?? 0) + t.fixtures.size;
        return { country, result: t.result, raws: t.raws, fixtures: t.fixtures };
      });
      const ranks = rankScores(
        results.map((r) => ({ country_code: r.country.code, score: r.result.score })),
      );

      for (const { country, result, raws, fixtures } of results) {
        for (const inp of result.inputs) {
          const ind = (spec.indicators as IndicatorRow[]).find(
            (i) => i.code === inp.indicator_code,
          )!;
          const src = fetched.get(`${ind.index_code}.${ind.code}`);
          const fixture = fixtures.has(inp.indicator_code);
          const hit = fixture ? undefined : src?.byCountry.get(country.code);
          const obs = fixture
            ? raws.find((r) => r.indicator_code === inp.indicator_code)?.observations
            : hit?.observations;
          const latestRaw = obs?.find((o) => o.period === inp.period)?.value ?? null;
          const origin = fixture ? "test_fixture" : src?.snapshot_at && hit ? "snapshot" : "live";
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
            source_org: fixture
              ? "TEST DATA (generated fixture)"
              : (hit?.source_org ?? ind.source_org),
            source_url: fixture ? null : (hit?.source_url ?? ind.source_url),
            licence: fixture ? "Test data, not for publication" : ind.licence,
            origin,
            snapshot_at:
              origin === "snapshot" ? (hit?.retrieved_at ?? src!.snapshot_at ?? null) : null,
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
        opts.mode === "test"
          ? `TEST DATA · ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC`
          : opts.mode === "tracker"
            ? `${data_cutoff.slice(0, 7)} tracker (provisional)`
            : `${d.toLocaleString("en-GB", { month: "long", timeZone: "UTC" })} ${d.getUTCFullYear()} edition`;
      const kind = opts.mode === "test" ? "test" : opts.mode === "tracker" ? "tracker" : "edition";
      const { data: rel, error } = await c
        .from("index_releases")
        .insert({ run_id: runId, kind, label })
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
      retries: Object.fromEntries(attempts),
      snapshots_used: snapshotsUsed,
      ...(snapshotErrors.length ? { snapshot_errors: snapshotErrors } : {}),
      ...(isTest ? { test_fixtures: fixtureCount } : {}),
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
    trackAttempts(null);
    setRetryDeadline(null);
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

/**
 * Delete test releases (and their runs, inputs and scores) older than TEST_RELEASE_TTL_DAYS,
 * plus test runs that never produced a release (failed or cut off). `all` clears every test row.
 * Returns how many test runs were removed; throws if a delete fails.
 */
export async function purgeExpiredTestReleases(sb: AnyClient, all = false): Promise<number> {
  const c = db(sb);
  const cutoff = new Date(Date.now() - TEST_RELEASE_TTL_DAYS * 86_400_000).toISOString();
  let rq = c.from("index_releases").select("id,run_id").eq("kind", "test");
  if (!all) rq = rq.lt("created_at", cutoff);
  const { data: rels, error: rerr } = await rq;
  if (rerr) throw new Error(rerr.message);
  const releases = (rels ?? []) as Array<{ id: string; run_id: string }>;
  if (releases.length) {
    // releases first: index_releases.run_id is ON DELETE RESTRICT
    const { error } = await c
      .from("index_releases")
      .delete()
      .in(
        "id",
        releases.map((r) => r.id),
      )
      .eq("kind", "test");
    if (error) throw new Error(`clear test releases: ${error.message}`);
  }
  // every old (or, with `all`, every) test run with no release left: inputs and scores cascade
  let q = c.from("index_runs").select("id").eq("mode", "test").neq("status", "running");
  if (!all) q = q.lt("started_at", cutoff);
  const { data: runs, error: qerr } = await q;
  if (qerr) throw new Error(qerr.message);
  const ids = ((runs ?? []) as Array<{ id: string }>).map((r) => r.id);
  const withRelease = new Set(
    ids.length
      ? (
          ((await c.from("index_releases").select("run_id").in("run_id", ids)).data ??
            []) as Array<{ run_id: string }>
        ).map((r) => r.run_id)
      : [],
  );
  const doomed = ids.filter((id) => !withRelease.has(id));
  if (doomed.length) {
    const { error } = await c.from("index_runs").delete().in("id", doomed).eq("mode", "test");
    if (error) throw new Error(`clear test runs: ${error.message}`);
  }
  return doomed.length;
}
