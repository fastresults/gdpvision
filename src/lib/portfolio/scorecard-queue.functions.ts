// @domain portfolio
// @tables kpis,goal_cycles,ministries,countries,kpi_setup_sessions
// @ui src/routes/_authenticated/admin/scorecards.tsx

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth/require-admin";
import { assessDelivery, type DeliveryKpi } from "./accountability";

export type QueueRow = {
  id: string;
  country_code: string;
  ministry: string;
  metric: string;
  unit: string;
  baseline: number | null;
  baseline_period: string | null;
  target: number;
  target_period: string | null;
  direction: string;
  target_basis: string | null;
  evidence_url: string | null;
  source: string;
  ai_rationale: string | null;
  peer_median: number | null;
  inferred: boolean;
  review_note: string | null;
  verification_status: string;
  owner_is_me: boolean;
  state: "in_review" | "qualified" | "stale" | "returned" | "draft";
  latest: DeliveryKpi["latest"];
};

export type CountryCoverage = {
  code: string;
  name: string;
  ministries: number;
  started: number;
  qualifiedMinistries: number;
  kpis: number;
  qualified: number;
  inReview: number;
  stale: number;
};

export const listScorecardQueue = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .handler(async ({ context }) => {
    const sb = context.supabase;
    const [countries, ministries, kpis, sessions] = await Promise.all([
      sb.from("countries").select("code,name").order("name"),
      sb.from("ministries").select("id,name,country_code"),
      sb
        .from("kpis")
        .select(
          "id,country_code,ministry_id,sector_code,metric,unit,baseline,baseline_period,target,target_period,direction,target_basis,evidence_url,cadence,warning_tolerance_pct,critical_tolerance_pct,verification_status,source,ai_rationale,peer_median,inferred,review_note,owner_id",
        )
        .not("ministry_id", "is", null),
      sb.from("kpi_setup_sessions").select("country_code,ministry_id,status"),
    ]);
    const ids = (kpis.data ?? []).map((k) => k.id);
    const latest = new Map<string, DeliveryKpi["latest"]>();
    if (ids.length) {
      const { data: cycles } = await sb
        .from("goal_cycles")
        .select("kpi_id,period,figures,snapshot_at")
        .in("kpi_id", ids)
        .order("snapshot_at", { ascending: false });
      for (const c of cycles ?? []) {
        if (latest.has(c.kpi_id)) continue;
        const f = (c.figures ?? {}) as { actual?: unknown };
        latest.set(c.kpi_id, {
          period: c.period,
          value: typeof f.actual === "number" ? f.actual : null,
          captured_at: c.snapshot_at,
        });
      }
    }
    const minName = new Map((ministries.data ?? []).map((m) => [m.id, m.name]));
    const rows: QueueRow[] = (kpis.data ?? []).map((k) => {
      const dk: DeliveryKpi = {
        ...k,
        baseline: k.baseline == null ? null : Number(k.baseline),
        target: Number(k.target),
        warning_tolerance_pct: Number(k.warning_tolerance_pct),
        critical_tolerance_pct: Number(k.critical_tolerance_pct),
        latest: latest.get(k.id) ?? null,
      };
      const a = assessDelivery(dk);
      const state: QueueRow["state"] =
        k.verification_status === "submitted"
          ? "in_review"
          : k.verification_status === "returned"
            ? "returned"
            : k.verification_status === "qualified"
              ? a.status === "unscored" && /stale|No reported/.test(a.reason ?? "")
                ? "stale"
                : "qualified"
              : "draft";
      return {
        id: k.id,
        country_code: k.country_code,
        ministry: minName.get(k.ministry_id as string) ?? "—",
        metric: k.metric,
        unit: k.unit,
        baseline: dk.baseline,
        baseline_period: k.baseline_period,
        target: dk.target,
        target_period: k.target_period,
        direction: k.direction,
        target_basis: k.target_basis,
        evidence_url: k.evidence_url,
        source: k.source,
        ai_rationale: k.ai_rationale,
        peer_median: k.peer_median == null ? null : Number(k.peer_median),
        inferred: k.inferred,
        review_note: k.review_note,
        verification_status: k.verification_status,
        owner_is_me: k.owner_id === context.userId,
        state,
        latest: dk.latest,
      };
    });
    const coverage: CountryCoverage[] = (countries.data ?? []).map((c) => {
      const mins = (ministries.data ?? []).filter((m) => m.country_code === c.code);
      const ck = rows.filter((r) => r.country_code === c.code);
      const qualifiedMin = new Set(
        (kpis.data ?? [])
          .filter((k) => k.country_code === c.code && k.verification_status === "qualified")
          .map((k) => k.ministry_id),
      );
      return {
        code: c.code,
        name: c.name,
        ministries: mins.length,
        started: (sessions.data ?? []).filter((s) => s.country_code === c.code).length,
        qualifiedMinistries: qualifiedMin.size,
        kpis: ck.length,
        qualified: ck.filter((r) => r.state === "qualified").length,
        inReview: ck.filter((r) => r.state === "in_review").length,
        stale: ck.filter((r) => r.state === "stale").length,
      };
    });
    return { rows, coverage };
  });

const Review = z.object({
  kpiId: z.string().uuid(),
  action: z.enum(["approve", "return"]),
  note: z.string().max(1000).optional(),
  confirmInferred: z.boolean().optional(),
});

export const reviewScorecardKpi = createServerFn({ method: "POST" })
  .middleware([requireAdmin])
  .inputValidator((v: unknown) => Review.parse(v))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const { data: k, error } = await sb
      .from("kpis")
      .select("owner_id,verification_status,inferred,evidence_url")
      .eq("id", data.kpiId)
      .single();
    if (error) throw new Error(error.message);
    if (k.verification_status !== "submitted") throw new Error("Only KPIs in review can be decided.");
    if (data.action === "return") {
      if (!data.note?.trim()) throw new Error("Add a note explaining what needs to change.");
      const { error: e } = await sb
        .from("kpis")
        .update({ verification_status: "returned", review_note: data.note })
        .eq("id", data.kpiId);
      if (e) throw new Error(e.message);
      return { ok: true };
    }
    if (k.owner_id === context.userId)
      throw new Error("A second authorised person must approve this KPI.");
    if (k.inferred && !data.confirmInferred)
      throw new Error("This KPI contains inferred figures. Confirm you have checked them against the evidence.");
    if (!k.evidence_url) throw new Error("An evidence link is required before approval.");
    const { error: e } = await sb
      .from("kpis")
      .update({
        verification_status: "qualified",
        verified_by: context.userId,
        verified_at: new Date().toISOString(),
        inferred: false,
        qualification_notes: data.note ?? null,
        review_note: null,
      })
      .eq("id", data.kpiId)
      .eq("verification_status", "submitted");
    if (e) throw new Error(e.message);
    return { ok: true };
  });
