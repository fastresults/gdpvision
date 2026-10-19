// @domain indices
// @tables index_runs,index_scores,index_inputs,index_releases,index_evidence,index_indicators
// @ui none
//
// Admin and steward controls for the Caribbean Indices: run on demand, review a
// run, sign off and publish an official edition, and enter documentary evidence.
// Scores are never typed in: they come only from a run (run.server.ts).

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { db } from "@/lib/syndication/db";

type Num = number | null;
export interface IndexScoreRow {
  index_code: string;
  country_code: string;
  status: "scored" | "not_scored";
  score: Num;
  rank: Num;
  pillar_scores: Record<string, Num>;
  coverage: {
    present: number;
    specified: number;
    by_pillar: Record<string, { present: number; specified: number; live: number }>;
  };
  not_scored_reason: string | null;
  sextant: Num;
  sextant_band: string | null;
  sextant_parts: Record<string, number>;
  weakest_grade: string | null;
  method_version: number;
}
export interface IndexInputRow {
  index_code: string;
  indicator_code: string;
  raw_value: Num;
  value_used: Num;
  period: string | null;
  score: Num;
  source_kind: string;
  source_org: string | null;
  source_url: string | null;
  licence: string | null;
  grade: string | null;
  method: string | null;
  age_years: Num;
  source_ok: boolean;
  excluded_reason: string | null;
}

type Ctx = { supabase: Parameters<typeof db>[0]; userId: string };

async function assertRole(ctx: Ctx, role: "admin" | "data_steward" = "admin") {
  const { data } = await db(ctx.supabase).rpc("has_role", { _user_id: ctx.userId, _role: role });
  if (data) return;
  if (role === "data_steward") {
    const { data: isAdmin } = await db(ctx.supabase).rpc("has_role", {
      _user_id: ctx.userId,
      _role: "admin",
    });
    if (isAdmin) return;
  }
  throw new Error("Forbidden");
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return db(supabaseAdmin);
}

/** Run now. `edition` drafts an official edition for sign-off. */
export const runIndicesNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ mode: z.enum(["watch", "tracker", "edition"]).default("watch") }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertRole(context as Ctx);
    const { runIndices } = await import("./run.server");
    return runIndices({ mode: data.mode, trigger: "manual", startedBy: (context as Ctx).userId });
  });

export const listIndexRuns = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ limit: z.number().int().min(1).max(100).default(20) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertRole(context as Ctx, "data_steward");
    const c = await admin();
    const { data: runs, error } = await c
      .from("index_runs")
      .select(
        "id,trigger,mode,data_cutoff,method_versions,status,stats,error,started_at,finished_at",
      )
      .order("started_at", { ascending: false })
      .limit(data.limit);
    if (error) throw new Error(error.message);
    const { data: rels } = await c
      .from("index_releases")
      .select("id,run_id,kind,label,status,published_at")
      .in(
        "run_id",
        (runs ?? []).map((r: { id: string }) => r.id),
      );
    const byRun = new Map((rels ?? []).map((r: { run_id: string }) => [r.run_id, r]));
    return (runs ?? []).map((r: { id: string }) => ({ ...r, release: byRun.get(r.id) ?? null }));
  });

/** One run's scores, and optionally one country's frozen inputs. */
export const getIndexRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        runId: z.string().uuid(),
        country: z
          .string()
          .regex(/^[A-Za-z]{2,4}$/)
          .optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertRole(context as Ctx, "data_steward");
    const c = await admin();
    const { data: scores, error } = await c
      .from("index_scores")
      .select(
        "index_code,country_code,status,score,rank,pillar_scores,coverage,not_scored_reason,sextant,sextant_band,sextant_parts,weakest_grade,method_version",
      )
      .eq("run_id", data.runId)
      .order("index_code")
      .order("rank", { ascending: true, nullsFirst: false });
    if (error) throw new Error(error.message);
    let inputs: IndexInputRow[] = [];
    if (data.country) {
      const r = await c
        .from("index_inputs")
        .select(
          "index_code,indicator_code,raw_value,value_used,period,score,source_kind,source_org,source_url,licence,grade,method,age_years,source_ok,excluded_reason",
        )
        .eq("run_id", data.runId)
        .eq("country_code", data.country.toUpperCase());
      inputs = (r.data ?? []) as IndexInputRow[];
    }
    return { scores: (scores ?? []) as IndexScoreRow[], inputs };
  });

/** Sign off and publish an official edition. Trackers stay private by rule. */
export const publishIndexRelease = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ releaseId: z.string().uuid(), notes: z.string().max(2000).optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    await assertRole(ctx);
    const c = await admin();
    const { data: rel, error } = await c
      .from("index_releases")
      .select("id,kind,status,signed_off_by,run_id")
      .eq("id", data.releaseId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!rel) throw new Error("Release not found.");
    const r = rel as { kind: string; status: string; signed_off_by: string[]; run_id: string };
    if (r.kind !== "edition")
      throw new Error("Only an official edition can be published; trackers stay private.");
    if (r.status === "published") return { ok: true, already: true };
    if (r.status === "withdrawn")
      throw new Error("A withdrawn edition cannot be republished; run a new edition.");
    const { data: run } = await c
      .from("index_runs")
      .select("status")
      .eq("id", r.run_id)
      .maybeSingle();
    if ((run as { status?: string } | null)?.status !== "complete")
      throw new Error("The edition's run did not complete.");
    const { data: drafts } = await c
      .from("index_specs")
      .select("code")
      .neq("method_status", "frozen");
    if ((drafts ?? []).length)
      throw new Error(
        `The method is still a draft for ${(drafts as Array<{ code: string }>).map((d) => d.code).join(", ")}. Freeze it (a migration, after the methodology panel ratifies it) before publishing an edition.`,
      );
    const signed = Array.from(new Set([...(r.signed_off_by ?? []), ctx.userId]));
    const { data: updated, error: uerr } = await c
      .from("index_releases")
      .update({
        status: "published",
        signed_off_by: signed,
        published_at: new Date().toISOString(),
        notes: data.notes ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.releaseId)
      .eq("status", r.status) // no race: only from the status we read
      .select("id");
    if (!uerr && !(updated ?? []).length)
      throw new Error("The release changed while you were publishing it; reload.");
    if (uerr) throw new Error(uerr.message);
    await c.from("audit_log").insert({
      action: "index_release.published",
      actor_id: ctx.userId,
      target_type: "index_release",
      target_id: data.releaseId,
      metadata: { notes: data.notes ?? null },
    });
    return { ok: true };
  });

/** Enter a documentary or external-assessment value with its evidence (unverified until a second person verifies). */
export const saveIndexEvidence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        indexCode: z.enum(["CGX", "CHX", "CGV", "CCX"]),
        indicatorCode: z.string().regex(/^[a-z0-9_]{2,60}$/),
        country: z.string().regex(/^[A-Za-z]{2,4}$/),
        value: z.number().finite(),
        period: z.string().regex(/^\d{4}$/),
        documentTitle: z.string().trim().min(3).max(300),
        documentUrl: z.string().url().startsWith("https://"),
        documentDate: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional(),
        publisher: z.string().trim().min(2).max(200),
        grade: z.enum(["A", "B", "C", "D"]),
        notes: z.string().max(2000).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    await assertRole(ctx, "data_steward");
    const { error } = await db(ctx.supabase)
      .from("index_evidence")
      .upsert(
        {
          index_code: data.indexCode,
          indicator_code: data.indicatorCode,
          country_code: data.country.toUpperCase(),
          value: data.value,
          period: data.period,
          document_title: data.documentTitle,
          document_url: data.documentUrl,
          document_date: data.documentDate ?? null,
          publisher: data.publisher,
          grade: data.grade,
          notes: data.notes ?? null,
          entered_by: ctx.userId,
          verified: false,
          verified_by: null,
          verified_at: null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "index_code,indicator_code,country_code,period" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** A second person verifies evidence before it can feed a run. */
export const verifyIndexEvidence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    await assertRole(ctx, "data_steward");
    const c = db(ctx.supabase);
    const { data: row } = await c
      .from("index_evidence")
      .select("entered_by")
      .eq("id", data.id)
      .maybeSingle();
    if (!row) throw new Error("Evidence not found.");
    if ((row as { entered_by: string | null }).entered_by === ctx.userId)
      throw new Error("A second person must verify evidence.");
    const { error } = await c
      .from("index_evidence")
      .update({ verified: true, verified_by: ctx.userId, verified_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
