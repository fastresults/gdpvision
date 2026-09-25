// @domain standards
// @tables reporting_standards,standard_requirements,country_kpis,collection_protocols
// @ui src/routes/_authenticated/admin/countries.$code.standards.tsx

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ReqStatus = "collected" | "partial" | "stale" | "missing";

export type AuditRow = {
  id: string;
  standardCode: string;
  label: string;
  clause: string | null;
  frequency: string;
  maxLagMonths: number;
  impact: string;
  status: ReqStatus;
  evidence: Array<{ kpi: string; period: string | null; source: string | null }>;
  protocol: { id: string; status: string; owner: string | null; due: string | null } | null;
};

export type StandardsAudit = {
  standards: Array<{ code: string; name: string; body: string; category: string; url: string | null; met: number; total: number }>;
  rows: AuditRow[];
};

function periodYear(p: string | null): number | null {
  const m = p?.match(/(19|20)\d{2}/);
  return m ? Number(m[0]) : null;
}

export const getStandardsAudit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ code: z.string().min(2).max(3) }).parse(d))
  .handler(async ({ data, context }): Promise<StandardsAudit> => {
    const sb = context.supabase;
    const [st, rq, kp, pr] = await Promise.all([
      sb.from("reporting_standards").select("code,name,body,category,url").order("code"),
      sb.from("standard_requirements").select("*"),
      sb.from("country_kpis").select("kpi_code,latest_value,latest_period,source_url").eq("country_code", data.code),
      sb.from("collection_protocols").select("id,requirement_id,status,owner_agency,due_date").eq("country_code", data.code),
    ]);
    for (const r of [st, rq, kp, pr]) if (r.error) throw new Error(r.error.message);
    const kpis = new Map((kp.data ?? []).map((k) => [k.kpi_code, k]));
    const protos = new Map((pr.data ?? []).map((p) => [p.requirement_id, p]));
    const nowYear = new Date().getUTCFullYear();

    const rows: AuditRow[] = (rq.data ?? []).map((r) => {
      const evidence = r.kpi_codes
        .map((c) => kpis.get(c))
        .filter((k): k is NonNullable<typeof k> => !!k && k.latest_value != null)
        .map((k) => ({ kpi: k.kpi_code, period: k.latest_period, source: k.source_url }));
      const p = protos.get(r.id);
      let status: ReqStatus;
      if (r.kpi_codes.length === 0) {
        status = p?.status === "approved" ? "collected" : p ? "partial" : "missing";
      } else if (evidence.length === 0) {
        status = "missing";
      } else {
        const lagYears = Math.max(1, Math.ceil(r.max_lag_months / 12));
        const years = evidence.map((e) => periodYear(e.period) ?? 0);
        const fresh = Math.max(...years) >= nowYear - lagYears - 1;
        const high = r.frequency === "monthly" || r.frequency === "quarterly";
        if (!fresh) status = "stale";
        else if (evidence.length < r.kpi_codes.length || high) status = "partial";
        else status = "collected";
      }
      return {
        id: r.id,
        standardCode: r.standard_code,
        label: r.label,
        clause: r.clause,
        frequency: r.frequency,
        maxLagMonths: r.max_lag_months,
        impact: r.impact,
        status,
        evidence,
        protocol: p ? { id: p.id, status: p.status, owner: p.owner_agency, due: p.due_date } : null,
      };
    });

    const standards = (st.data ?? []).map((s) => {
      const mine = rows.filter((r) => r.standardCode === s.code);
      return { ...s, met: mine.filter((r) => r.status === "collected").length, total: mine.length };
    });
    return { standards, rows };
  });

export const saveProtocol = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        code: z.string().min(2).max(3),
        requirementId: z.string().uuid(),
        owner: z.string().max(200).optional(),
        method: z.string().max(200),
        cadence: z.string().max(50),
        validation: z.string().max(2000).optional(),
        due: z.string().optional(),
        action: z.enum(["save", "submit", "approve"]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const now = new Date().toISOString();
    const row: Record<string, unknown> = {
      country_code: data.code,
      requirement_id: data.requirementId,
      owner_agency: data.owner || null,
      method: data.method,
      cadence: data.cadence,
      validation_rules: data.validation || null,
      due_date: data.due || null,
    };
    if (data.action === "submit") Object.assign(row, { status: "submitted", submitted_by: context.userId, submitted_at: now });
    if (data.action === "approve") {
      const { data: existing } = await sb
        .from("collection_protocols")
        .select("submitted_by,status")
        .eq("country_code", data.code)
        .eq("requirement_id", data.requirementId)
        .maybeSingle();
      if (existing?.status !== "submitted") throw new Error("Protocol must be submitted before approval");
      if (existing.submitted_by === context.userId) throw new Error("Four-eyes rule: a different person must approve");
      Object.assign(row, { status: "approved", approved_by: context.userId, approved_at: now });
    }
    const { error } = await sb.from("collection_protocols").upsert(row as never, { onConflict: "country_code,requirement_id" });
    if (error) throw new Error(error.message);
    await sb.from("audit_log").insert({ action: `protocol_${data.action}`, actor_id: context.userId, scope_key: data.code, target_type: "collection_protocols", target_id: data.requirementId });
    return { ok: true };
  });
