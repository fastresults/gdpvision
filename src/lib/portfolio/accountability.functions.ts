// @domain portfolio
// @tables goal_cycles,kpis
// @ui src/routes/_authenticated/admin/countries.$code.portfolio.index.tsx; src/routes/_authenticated/admin/countries.$code.portfolio.$ministry.tsx

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { DeliveryKpi } from "./accountability";

const Input = z.object({ countryCode: z.string().min(2).max(4) });

export const listPortfolioDeliveryKpis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((value: unknown) => Input.parse(value))
  .handler(async ({ data, context }): Promise<DeliveryKpi[]> => {
    const { data: allowed } = await context.supabase.rpc("has_country_access", {
      _user_id: context.userId,
      _country_code: data.countryCode,
    });
    const { data: admin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!allowed && !admin) throw new Error("Forbidden: no access to this country");

    const { data: rows, error } = await context.supabase
      .from("kpis")
      .select(
        "id,ministry_id,sector_code,metric,unit,baseline,baseline_period,target,target_period,direction,target_basis,evidence_url,cadence,warning_tolerance_pct,critical_tolerance_pct,verification_status",
      )
      .eq("country_code", data.countryCode)
      .order("metric");
    if (error) throw new Error(error.message);
    const ids = (rows ?? []).map((row) => row.id);
    const latest = new Map<string, { period: string; value: number | null; captured_at: string }>();
    if (ids.length) {
      const { data: cycles, error: cycleError } = await context.supabase
        .from("goal_cycles")
        .select("kpi_id,period,figures,snapshot_at")
        .in("kpi_id", ids)
        .order("snapshot_at", { ascending: false });
      if (cycleError) throw new Error(cycleError.message);
      for (const cycle of cycles ?? []) {
        if (latest.has(cycle.kpi_id)) continue;
        const figures = (cycle.figures ?? {}) as { actual?: unknown };
        latest.set(cycle.kpi_id, {
          period: cycle.period,
          value: typeof figures.actual === "number" ? figures.actual : null,
          captured_at: cycle.snapshot_at,
        });
      }
    }
    return (rows ?? []).map((row) => ({
      ...row,
      baseline: row.baseline == null ? null : Number(row.baseline),
      target: Number(row.target),
      warning_tolerance_pct: Number(row.warning_tolerance_pct),
      critical_tolerance_pct: Number(row.critical_tolerance_pct),
      latest: latest.get(row.id) ?? null,
    }));
  });
