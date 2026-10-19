// @domain indices
// @tables index_specs,index_pillars,index_indicators,index_evidence,index_runs,index_scores,index_inputs,index_releases,countries
// @ui src/routes/_authenticated/admin/indices.tsx
//
// Read side of the Caribbean Indices back office: one overview for the page,
// the evidence queue, "what changed since the last run", and the publish
// checklist. Writes stay in indices.functions.ts (run, publish, evidence).

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertIndicesRole, globalIndicesRoles, type IndicesCtx } from "./access";
import type { ReadinessCheck, RunDiff } from "./review";
import { db, type AnyClient } from "@/lib/syndication/db";

async function adminClient(): Promise<AnyClient> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as AnyClient;
}

export interface IndicatorMeta {
  index_code: string;
  code: string;
  pillar_code: string;
  name: string;
  unit: string;
  goal_best: number;
  goal_worst: number;
  log_scale: boolean;
  window_kind: string;
  source_kind: "wdi" | "imf_weo" | "kpi" | "evidence";
  source_code: string | null;
  source_org: string;
  source_url: string | null;
  licence: string;
  licence_status: "confirmed" | "to_confirm";
  indicator_type: string;
  age_tolerance_years: number;
  status: "active" | "pending_source";
  weight: number;
  position: number;
  notes: string | null;
}

export interface IndicesOverview {
  me: { userId: string; isAdmin: boolean };
  specs: Array<{
    code: string;
    name: string;
    pillar_label: string;
    question: string;
    benchmark: string;
    method_version: number;
    method_status: "draft" | "frozen";
    position: number;
  }>;
  pillars: Array<{
    index_code: string;
    code: string;
    name: string;
    weight: number;
    position: number;
  }>;
  indicators: IndicatorMeta[];
  countries: Array<{ code: string; name: string }>;
  runs: Array<{
    id: string;
    trigger: string;
    mode: "watch" | "tracker" | "edition";
    data_cutoff: string;
    status: "running" | "complete" | "failed";
    stats: {
      indexes?: Record<
        string,
        { scored: number; not_scored: number; median_sextant: number | null }
      >;
      sources?: { ok: number; failed: Array<{ indicator: string; error: string }> };
      countries?: number;
      inputs?: number;
    } | null;
    error: string | null;
    started_at: string;
    finished_at: string | null;
    release: {
      id: string;
      kind: string;
      label: string;
      status: string;
      published_at: string | null;
    } | null;
  }>;
  evidence: { unverified: number; verified: number };
  /** per evidence indicator: states with a verified value still within its age tolerance, and the rest */
  coverage: Array<{
    index_code: string;
    indicator_code: string;
    verified_current: number;
    verified_stale: number;
    unverified: number;
  }>;
}

/** Everything the page needs on first paint, in one round trip. */
export const getIndicesOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<IndicesOverview> => {
    const ctx = context as IndicesCtx;
    await assertIndicesRole(ctx, "data_steward");
    const c = db(await adminClient());
    const { fetchAllRows } = await import("./review.server");
    const [roles, specs, pillars, inds, countries, runs, unv, ver, ev] = await Promise.all([
      globalIndicesRoles(ctx),
      c
        .from("index_specs")
        .select("code,name,pillar_label,question,benchmark,method_version,method_status,position")
        .order("position"),
      c
        .from("index_pillars")
        .select("index_code,code,name,weight,position")
        .order("index_code")
        .order("position"),
      c
        .from("index_indicators")
        .select(
          "index_code,code,pillar_code,name,unit,goal_best,goal_worst,log_scale,window_kind,source_kind,source_code,source_org,source_url,licence,licence_status,indicator_type,age_tolerance_years,status,weight,position,notes",
        )
        .order("index_code")
        .order("pillar_code")
        .order("position"),
      c.from("countries").select("code,name").not("iso3", "is", null).order("name"),
      c
        .from("index_runs")
        .select("id,trigger,mode,data_cutoff,status,stats,error,started_at,finished_at")
        .order("started_at", { ascending: false })
        .limit(30),
      c.from("index_evidence").select("id", { count: "exact", head: true }).eq("verified", false),
      c.from("index_evidence").select("id", { count: "exact", head: true }).eq("verified", true),
      fetchAllRows<{
        index_code: string;
        indicator_code: string;
        country_code: string;
        period: string;
        verified: boolean;
      }>((a, b) =>
        c
          .from("index_evidence")
          .select("index_code,indicator_code,country_code,period,verified")
          .order("id")
          .range(a, b),
      ),
    ]);
    const isAdmin = roles.has("admin");
    for (const r of [specs, pillars, inds, countries, runs])
      if (r.error) throw new Error(r.error.message);

    const runRows = (runs.data ?? []) as Array<Omit<IndicesOverview["runs"][number], "release">>;
    const rels = runRows.length
      ? await c
          .from("index_releases")
          .select("id,run_id,kind,label,status,published_at")
          .in(
            "run_id",
            runRows.map((r) => r.id),
          )
      : { data: [] as unknown[] };
    const byRun = new Map(
      (
        (rels.data ?? []) as Array<
          { run_id: string } & NonNullable<IndicesOverview["runs"][number]["release"]>
        >
      ).map((r) => [
        r.run_id,
        { id: r.id, kind: r.kind, label: r.label, status: r.status, published_at: r.published_at },
      ]),
    );

    // coverage the way a run sees it: one state counts once, and a verified value older
    // than the indicator's age tolerance would be excluded as stale
    const tol = new Map(
      ((inds.data ?? []) as IndicatorMeta[]).map((i) => [
        `${i.index_code}.${i.code}`,
        i.age_tolerance_years,
      ]),
    );
    const year = new Date().getUTCFullYear();
    const cov = new Map<
      string,
      { current: Set<string>; stale: Set<string>; unverified: Set<string> }
    >();
    for (const e of ev) {
      const k = `${e.index_code}.${e.indicator_code}`;
      const m = cov.get(k) ?? { current: new Set(), stale: new Set(), unverified: new Set() };
      if (!e.verified) m.unverified.add(e.country_code);
      else if (year - Number(e.period) <= (tol.get(k) ?? 3)) m.current.add(e.country_code);
      else m.stale.add(e.country_code);
      cov.set(k, m);
    }
    const coverage = [...cov.entries()].map(([k, m]) => {
      const [index_code, indicator_code] = k.split(".");
      return {
        index_code,
        indicator_code,
        verified_current: m.current.size,
        verified_stale: [...m.stale].filter((c) => !m.current.has(c)).length,
        unverified: [...m.unverified].filter((c) => !m.current.has(c)).length,
      };
    });

    return {
      me: { userId: ctx.userId, isAdmin },
      specs: (specs.data ?? []) as IndicesOverview["specs"],
      pillars: (pillars.data ?? []) as IndicesOverview["pillars"],
      indicators: ((inds.data ?? []) as IndicatorMeta[]).map((i) => ({
        ...i,
        goal_best: Number(i.goal_best),
        goal_worst: Number(i.goal_worst),
        weight: Number(i.weight),
      })),
      countries: (countries.data ?? []) as IndicesOverview["countries"],
      runs: runRows.map((r) => ({ ...r, release: byRun.get(r.id) ?? null })),
      evidence: { unverified: unv.count ?? 0, verified: ver.count ?? 0 },
      coverage,
    };
  });

export interface EvidenceRow {
  id: string;
  index_code: string;
  indicator_code: string;
  country_code: string;
  value: number;
  period: string;
  document_title: string;
  document_url: string;
  document_date: string | null;
  publisher: string;
  grade: "A" | "B" | "C" | "D";
  verified: boolean;
  verified_at: string | null;
  notes: string | null;
  updated_at: string;
  entered_by_me: boolean;
  verified_by_me: boolean;
}

/** The evidence queue. `unverified` is what a second person needs to check. */
export const listIndexEvidence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        state: z.enum(["unverified", "verified", "all"]).default("unverified"),
        indexCode: z.enum(["CGX", "CHX", "CGV", "CCX"]).optional(),
        country: z
          .string()
          .regex(/^[A-Za-z]{2,4}$/)
          .optional(),
        limit: z.number().int().min(1).max(500).default(200),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<EvidenceRow[]> => {
    const ctx = context as IndicesCtx;
    await assertIndicesRole(ctx, "data_steward");
    let q = db(ctx.supabase)
      .from("index_evidence")
      .select(
        "id,index_code,indicator_code,country_code,value,period,document_title,document_url,document_date,publisher,grade,verified,verified_by,verified_at,entered_by,notes,updated_at",
      )
      .order("updated_at", { ascending: false })
      .limit(data.limit);
    if (data.state !== "all") q = q.eq("verified", data.state === "verified");
    if (data.indexCode) q = q.eq("index_code", data.indexCode);
    if (data.country) q = q.eq("country_code", data.country.toUpperCase());
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (
      (rows ?? []) as Array<EvidenceRow & { entered_by: string | null; verified_by: string | null }>
    ).map(({ entered_by, verified_by, ...r }) => ({
      ...r,
      value: Number(r.value),
      entered_by_me: entered_by === ctx.userId,
      verified_by_me: verified_by === ctx.userId,
    }));
  });

/** What changed between a run and the complete run before it (or a chosen base). */
export const compareIndexRuns = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ runId: z.string().uuid(), baseRunId: z.string().uuid().optional() }).parse(d),
  )
  .handler(
    async ({
      data,
      context,
    }): Promise<{
      base: { id: string; mode: string; data_cutoff: string; started_at: string } | null;
      diff: RunDiff | null;
    }> => {
      await assertIndicesRole(context as IndicesCtx, "data_steward");
      const sb = await adminClient();
      const { loadRunLite, previousCompleteRun } = await import("./review.server");
      const { diffRuns } = await import("./review");
      const { data: runRow } = await db(sb)
        .from("index_runs")
        .select("status")
        .eq("id", data.runId)
        .maybeSingle();
      if (!runRow) throw new Error("Run not found.");
      if ((runRow as { status: string }).status !== "complete")
        throw new Error("Only a complete run can be compared.");
      let base: { id: string; mode: string; data_cutoff: string; started_at: string } | null = null;
      if (data.baseRunId) {
        const { data: b } = await db(sb)
          .from("index_runs")
          .select("id,mode,data_cutoff,started_at,status")
          .eq("id", data.baseRunId)
          .maybeSingle();
        if (!b || (b as { status: string }).status !== "complete")
          throw new Error("The comparison run must exist and be complete.");
        const bb = b as { id: string; mode: string; data_cutoff: string; started_at: string };
        base = { id: bb.id, mode: bb.mode, data_cutoff: bb.data_cutoff, started_at: bb.started_at };
      } else {
        base = await previousCompleteRun(sb, data.runId);
      }
      if (!base) return { base: null, diff: null };
      const [cur, prev] = await Promise.all([
        loadRunLite(sb, data.runId),
        loadRunLite(sb, base.id),
      ]);
      return { base, diff: diffRuns(cur, prev) };
    },
  );

/** The publish checklist for a release. publishIndexRelease enforces the same checks. */
export const getReleaseReadiness = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ releaseId: z.string().uuid() }).parse(d))
  .handler(
    async ({
      data,
      context,
    }): Promise<{
      release: {
        id: string;
        kind: string;
        label: string;
        status: string;
        published_at: string | null;
        notes: string | null;
      };
      ready: boolean;
      checks: ReadinessCheck[];
    }> => {
      await assertIndicesRole(context as IndicesCtx, "data_steward");
      const { loadReadiness } = await import("./review.server");
      const { release, ready, checks } = await loadReadiness(await adminClient(), data.releaseId);
      return {
        release: {
          id: release.id,
          kind: release.kind,
          label: release.label,
          status: release.status,
          published_at: release.published_at,
          notes: release.notes,
        },
        ready,
        checks,
      };
    },
  );

/** Whether the caller may open the indices back office (route gate). Never throws. */
export const getIndicesAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ admin: boolean; steward: boolean }> => {
    try {
      const roles = await globalIndicesRoles(context as IndicesCtx);
      return { admin: roles.has("admin"), steward: roles.has("data_steward") };
    } catch {
      return { admin: false, steward: false };
    }
  });
