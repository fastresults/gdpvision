// GDP Vision — Sovereign capital flow ledger.
// Read-only aggregate over committed country_capital_flows + registry.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Input = z.object({
  countryCode: z.string().min(2).max(4),
  period: z.string().optional(),
});

export type FlowNode = {
  node_key: string;
  label: string;
  side: "input" | "output";
  sort_order: number;
  hue_token: string | null;
  sector_code: string | null;
  preferred_sources: string[];
};

export type FlowValue = {
  node_key: string;
  period: string;
  value_usd_m: number;
  method: string;
  confidence_grade: string;
  notes: string | null;
  citations: Array<{ url: string; title?: string; domain?: string }>;
  updated_at: string;
};

export type CapitalFlowsOverview = {
  country: { code: string; name: string } | null;
  period: string | null;
  availablePeriods: string[];
  nodes: FlowNode[];
  values: FlowValue[];
  totals: { inputs: number; outputs: number; residual: number; residual_pct: number };
  diagnostics: {
    hasData: boolean;
    missingNodes: string[];
    lowConfidence: string[];
    staleUpdate: boolean;
    reconciliationWarn: boolean;
  };
};

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data: isAdmin } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (!isAdmin) throw new Error("Forbidden: super admin only");
}

export const getCapitalFlows = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { recordCorpusReadOutcome } = await import("@/lib/corpus/gateway.server");
    const cc = data.countryCode;
    const t0 = Date.now();

    const [{ data: country }, { data: registry }, { data: allValues }] = await Promise.all([
      supabaseAdmin.from("countries").select("code, name").eq("code", cc).maybeSingle(),
      supabaseAdmin.from("capital_flow_nodes").select("*").order("sort_order"),
      supabaseAdmin
        .from("country_capital_flows")
        .select("node_key, period, value_usd_m, method, confidence_grade, notes, citations, updated_at")
        .eq("country_code", cc)
        .order("period", { ascending: false }),
    ]);

    void recordCorpusReadOutcome({
      countryCode: cc, domain: "flow", key: "capital_flows:all",
      outcome: (allValues?.length ?? 0) > 0 ? "hit" : "empty",
      latencyMs: Date.now() - t0, actor: context.userId,
    });

    const nodes: FlowNode[] = (registry ?? []).map((r: any) => ({
      node_key: r.node_key,
      label: r.label,
      side: r.side,
      sort_order: r.sort_order,
      hue_token: r.hue_token ?? null,
      sector_code: r.sector_code ?? null,
      preferred_sources: r.preferred_sources ?? [],
    }));

    const availablePeriods = Array.from(new Set((allValues ?? []).map((v: any) => v.period as string))).sort((a, b) => b.localeCompare(a));
    const period = data.period && availablePeriods.includes(data.period) ? data.period : availablePeriods[0] ?? null;

    const values: FlowValue[] = period
      ? (allValues ?? [])
          .filter((v: any) => v.period === period)
          .map((v: any) => ({
            node_key: v.node_key,
            period: v.period,
            value_usd_m: Number(v.value_usd_m),
            method: v.method,
            confidence_grade: v.confidence_grade,
            notes: v.notes ?? null,
            citations: Array.isArray(v.citations) ? v.citations : [],
            updated_at: v.updated_at,
          }))
      : [];

    const sideOf = new Map(nodes.map((n) => [n.node_key, n.side]));
    let sumIn = 0, sumOut = 0;
    for (const v of values) {
      if (v.node_key === "RECONCILIATION_RESIDUAL") continue;
      const s = sideOf.get(v.node_key);
      if (s === "input") sumIn += v.value_usd_m;
      else if (s === "output") sumOut += v.value_usd_m;
    }
    const residual = sumIn - sumOut;
    const residual_pct = sumIn > 0 ? Math.abs(residual) / sumIn : 0;

    const presentKeys = new Set(values.map((v) => v.node_key));
    const missingNodes = nodes.filter((n) => n.node_key !== "RECONCILIATION_RESIDUAL" && !presentKeys.has(n.node_key)).map((n) => n.label);
    const lowConfidence = values.filter((v) => v.confidence_grade === "C").map((v) => v.node_key);
    const latestUpdate = values.reduce((max, v) => (v.updated_at > max ? v.updated_at : max), "");
    const staleUpdate = latestUpdate ? Date.now() - new Date(latestUpdate).getTime() > 365 * 24 * 3600 * 1000 : false;

    return {
      country: country ?? null,
      period,
      availablePeriods,
      nodes,
      values,
      totals: { inputs: sumIn, outputs: sumOut, residual, residual_pct },
      diagnostics: {
        hasData: values.length > 0,
        missingNodes,
        lowConfidence,
        staleUpdate,
        reconciliationWarn: residual_pct > 0.1,
      },
    } as CapitalFlowsOverview;
  });
