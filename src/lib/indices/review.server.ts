// @domain indices
// @tables index_releases,index_runs,index_specs,index_indicators,index_inputs,index_scores,index_evidence
// @ui src/routes/_authenticated/admin/indices.tsx
//
// Database reads behind the review logic in review.ts. Server only.
// Every read of index_inputs / index_scores pages past PostgREST's 1,000-row cap:
// a run holds ~1,500 inputs (states × indicators).

import { readinessChecks, type InputLite, type ReadinessFacts, type ScoreLite } from "./review";
import { db, type AnyClient } from "@/lib/syndication/db";

const PAGE = 1000;

/** Fetch every row of a query, 1,000 at a time. `build` must return a fresh, ordered query. */
export async function fetchAllRows<T>(
  build: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>,
  max = 50_000,
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; from < max; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length < PAGE) break;
  }
  return out;
}

export async function loadRunLite(
  sb: AnyClient,
  runId: string,
): Promise<{ scores: ScoreLite[]; inputs: InputLite[] }> {
  const c = db(sb);
  const [scores, inputs] = await Promise.all([
    fetchAllRows<ScoreLite>((a, b) =>
      c
        .from("index_scores")
        .select("index_code,country_code,status,score,rank,sextant_band")
        .eq("run_id", runId)
        .order("index_code")
        .order("country_code")
        .range(a, b),
    ),
    fetchAllRows<InputLite>((a, b) =>
      c
        .from("index_inputs")
        .select(
          "index_code,indicator_code,country_code,value_used,period,excluded_reason,source_org",
        )
        .eq("run_id", runId)
        .order("index_code")
        .order("country_code")
        .order("indicator_code")
        .range(a, b),
    ),
  ]);
  return {
    scores: scores.map((s) => ({ ...s, score: s.score == null ? null : Number(s.score) })),
    inputs: inputs.map((r) => ({
      ...r,
      value_used: r.value_used == null ? null : Number(r.value_used),
    })),
  };
}

/** The complete run that came immediately before `runId` (any mode), or null. */
export async function previousCompleteRun(
  sb: AnyClient,
  runId: string,
): Promise<{ id: string; mode: string; data_cutoff: string; started_at: string } | null> {
  const c = db(sb);
  const { data: cur } = await c
    .from("index_runs")
    .select("started_at")
    .eq("id", runId)
    .maybeSingle();
  if (!cur) return null;
  const { data } = await c
    .from("index_runs")
    .select("id,mode,data_cutoff,started_at")
    .eq("status", "complete")
    .lt("started_at", (cur as { started_at: string }).started_at)
    .order("started_at", { ascending: false })
    .limit(1);
  return (
    ((data ?? [])[0] as { id: string; mode: string; data_cutoff: string; started_at: string }) ??
    null
  );
}

export async function loadReadiness(sb: AnyClient, releaseId: string) {
  const c = db(sb);
  const { data: rel, error } = await c
    .from("index_releases")
    .select("id,run_id,kind,label,status,signed_off_by,published_at,notes")
    .eq("id", releaseId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!rel) throw new Error("Release not found.");
  const release = rel as {
    id: string;
    run_id: string;
    kind: string;
    label: string;
    status: string;
    signed_off_by: string[];
    published_at: string | null;
    notes: string | null;
  };

  const [runR, specsR, indsR, used, scores, evR] = await Promise.all([
    c.from("index_runs").select("status,data_cutoff,stats").eq("id", release.run_id).maybeSingle(),
    c.from("index_specs").select("code,method_status,method_version").order("position"),
    c.from("index_indicators").select("index_code,code,licence,licence_status,source_org"),
    fetchAllRows<{ index_code: string; indicator_code: string; source_org: string | null }>(
      (a, b) =>
        c
          .from("index_inputs")
          .select("index_code,indicator_code,source_org")
          .eq("run_id", release.run_id)
          .not("value_used", "is", null)
          .is("excluded_reason", null)
          .order("index_code")
          .order("indicator_code")
          .order("country_code")
          .range(a, b),
    ),
    fetchAllRows<{ index_code: string; status: string }>((a, b) =>
      c
        .from("index_scores")
        .select("index_code,status")
        .eq("run_id", release.run_id)
        .order("index_code")
        .order("country_code")
        .range(a, b),
    ),
    c.from("index_evidence").select("id", { count: "exact", head: true }).eq("verified", false),
  ]);
  if (runR.error) throw new Error(runR.error.message);
  if (specsR.error) throw new Error(specsR.error.message);
  if (indsR.error) throw new Error(indsR.error.message);

  const inds = new Map(
    (
      (indsR.data ?? []) as Array<{
        index_code: string;
        code: string;
        licence: string;
        licence_status: string;
        source_org: string;
      }>
    ).map((r) => [`${r.index_code}|${r.code}`, r]),
  );
  const uses = new Map<string, number>();
  for (const u of used)
    uses.set(
      `${u.index_code}|${u.indicator_code}`,
      (uses.get(`${u.index_code}|${u.indicator_code}`) ?? 0) + 1,
    );
  const usedLicences: ReadinessFacts["usedLicences"] = [...uses.entries()].map(([k, n]) => {
    const [index_code, indicator_code] = k.split("|");
    const ind = inds.get(k);
    return {
      index_code,
      indicator_code,
      licence: ind?.licence ?? null,
      // an input whose indicator no longer exists cannot have a confirmed licence
      licence_status: ind?.licence_status ?? null,
      source_org: ind?.source_org ?? null,
      uses: n,
    };
  });

  const scored: ReadinessFacts["scored"] = {};
  for (const s of scores) {
    scored[s.index_code] ??= { scored: 0, not_scored: 0 };
    if (s.status === "scored") scored[s.index_code].scored++;
    else scored[s.index_code].not_scored++;
  }

  const run = (runR.data ?? {
    status: "missing",
    data_cutoff: new Date().toISOString().slice(0, 10),
    stats: null,
  }) as ReadinessFacts["run"];
  const facts: ReadinessFacts = {
    release: { kind: release.kind, status: release.status },
    run,
    methods: (specsR.data ?? []) as ReadinessFacts["methods"],
    usedLicences: usedLicences.sort(
      (a, b) =>
        a.index_code.localeCompare(b.index_code) ||
        a.indicator_code.localeCompare(b.indicator_code),
    ),
    scored,
    unverifiedEvidence: evR.count ?? 0,
    today: new Date().toISOString().slice(0, 10),
  };
  return { release, facts, ...readinessChecks(facts) };
}
