// Goal-seek (PRD Wave E2).
// Given a KPI and a target value, search available levers for the smallest-cost
// combination whose sum of KPI impacts reaches the target within a horizon.
// v1 is a simple greedy solver over stored `levers.expected_impact` values.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Input = z.object({
  kpiId: z.string().uuid(),
  targetValue: z.number(),
  horizonMonths: z.number().int().min(1).max(120).default(12),
});

export interface GoalSeekLever {
  id: string;
  name: string;
  expected_impact: number;
  cost_estimate: number | null;
}

export interface GoalSeekResult {
  kpiId: string;
  baseline: number;
  target: number;
  gap: number;
  horizonMonths: number;
  chosen: GoalSeekLever[];
  projectedImpact: number;
  totalCost: number;
  feasible: boolean;
}

export const solveForTarget = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data, context }): Promise<GoalSeekResult> => {
    const { data: kpi, error } = await context.supabase
      .from("kpis")
      .select("id,baseline,target,sector_code,country_code")
      .eq("id", data.kpiId)
      .single();
    if (error) throw new Error(error.message);

    const baseline = Number(kpi.baseline ?? kpi.target ?? 0);
    const gap = data.targetValue - baseline;

    const { data: levers } = await context.supabase
      .from("levers")
      .select("id,name,expected_impact,cost_estimate,sector_code")
      .eq("country_code", kpi.country_code)
      .eq("sector_code", kpi.sector_code);

    // Sort by cost-efficiency (impact per unit cost), descending.
    const ranked = (levers ?? [])
      .map((l) => ({
        id: l.id,
        name: l.name,
        expected_impact: Number(l.expected_impact ?? 0),
        cost_estimate: l.cost_estimate === null ? null : Number(l.cost_estimate),
      }))
      .filter((l) => (gap >= 0 ? l.expected_impact > 0 : l.expected_impact < 0))
      .sort((a, b) => {
        const ea = a.cost_estimate && a.cost_estimate > 0 ? Math.abs(a.expected_impact) / a.cost_estimate : Math.abs(a.expected_impact);
        const eb = b.cost_estimate && b.cost_estimate > 0 ? Math.abs(b.expected_impact) / b.cost_estimate : Math.abs(b.expected_impact);
        return eb - ea;
      });

    const chosen: GoalSeekLever[] = [];
    let projected = 0;
    let cost = 0;
    for (const l of ranked) {
      if (Math.abs(projected) >= Math.abs(gap)) break;
      chosen.push(l);
      projected += l.expected_impact;
      cost += l.cost_estimate ?? 0;
    }

    return {
      kpiId: data.kpiId,
      baseline,
      target: data.targetValue,
      gap,
      horizonMonths: data.horizonMonths,
      chosen,
      projectedImpact: Number(projected.toFixed(4)),
      totalCost: Number(cost.toFixed(2)),
      feasible: Math.abs(projected) >= Math.abs(gap),
    };
  });
