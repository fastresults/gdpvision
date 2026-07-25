// @domain core
// @tables audit_log,cadence_closes,kpi_snapshots,kpis
// @ui —

// Cadence engine (PRD Wave E1).
// Closes monthly/quarterly/annual/term windows by snapshotting every KPI
// value against its target, then recording an audit row in cadence_closes.
// Callable manually from the Admin console; also invoked by the daily cron
// hook at src/routes/api/public/hooks/cadence-daily.ts.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type WindowKind = "monthly" | "quarterly" | "annual" | "term";

function periodLabelFor(kind: WindowKind, at: Date): string {
  const y = at.getUTCFullYear();
  const m = at.getUTCMonth() + 1;
  switch (kind) {
    case "monthly":
      return `${y}-${String(m).padStart(2, "0")}`;
    case "quarterly":
      return `${y}-Q${Math.floor((m - 1) / 3) + 1}`;
    case "annual":
      return `${y}`;
    case "term":
      // Term = 4-year window aligned to Jan 1; label first year.
      return `${y - (y % 4)}-T`;
  }
}

async function assertStewardOrAdmin(ctx: { supabase: any; userId: string }) {
  const [{ data: admin }, { data: steward }] = await Promise.all([
    ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" }),
    ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "data_steward" }),
  ]);
  if (!admin && !steward) throw new Error("Forbidden: admin or data steward only");
}

const CloseInput = z.object({
  windowKind: z.enum(["monthly", "quarterly", "annual", "term"]),
  at: z.string().datetime().optional(),
  notes: z.string().max(500).optional(),
});

export const runCadenceClose = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CloseInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertStewardOrAdmin(context);
    const at = data.at ? new Date(data.at) : new Date();
    const period = periodLabelFor(data.windowKind, at);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Skip if already closed.
    const { data: existing } = await supabaseAdmin
      .from("cadence_closes")
      .select("id")
      .eq("window_kind", data.windowKind)
      .eq("period_label", period)
      .maybeSingle();
    if (existing) throw new Error(`Cadence ${data.windowKind}·${period} is already closed`);

    const { data: kpis, error: kpiErr } = await supabaseAdmin
      .from("kpis")
      .select("id,baseline,target");
    if (kpiErr) throw new Error(kpiErr.message);

    const snapshots = (kpis ?? []).map((k) => {
      const value = k.baseline as number | null;
      const target = k.target as number | null;
      const variance =
        value !== null && target !== null && target !== 0
          ? Number((((value - target) / target) * 100).toFixed(2))
          : null;
      return {
        kpi_id: k.id,
        window_kind: data.windowKind,
        period_label: period,
        value,
        target,
        variance_pct: variance,
        created_by: context.userId,
      };
    });


    if (snapshots.length > 0) {
      const { error: snapErr } = await supabaseAdmin.from("kpi_snapshots").insert(snapshots);
      if (snapErr) throw new Error(snapErr.message);
    }

    const { error: closeErr } = await supabaseAdmin.from("cadence_closes").insert({
      window_kind: data.windowKind,
      period_label: period,
      closed_by: context.userId,
      snapshot_count: snapshots.length,
      notes: data.notes ?? null,
    });
    if (closeErr) throw new Error(closeErr.message);

    await supabaseAdmin.from("audit_log").insert({
      actor_id: context.userId,
      action: "cadence.close",
      target_type: "cadence",
      target_id: `${data.windowKind}:${period}`,
      metadata: { snapshotCount: snapshots.length } as any,
    });

    return { ok: true, period, snapshotCount: snapshots.length };
  });

export interface CadenceCloseRow {
  id: string;
  window_kind: WindowKind;
  period_label: string;
  closed_at: string;
  snapshot_count: number;
  notes: string | null;
}

export const listCadenceHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CadenceCloseRow[]> => {
    const { data, error } = await context.supabase
      .from("cadence_closes")
      .select("id,window_kind,period_label,closed_at,snapshot_count,notes")
      .order("closed_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return (data ?? []) as CadenceCloseRow[];
  });
