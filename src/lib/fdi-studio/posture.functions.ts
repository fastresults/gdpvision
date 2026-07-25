// @domain fdi-studio
// @tables fdi_posture_snapshots,country_sectors,country_capital_flows,exposure_index,countries,fdi_threats,fdi_strategies
// @ui src/components/studio/MacroFdiBoard.tsx

// Chamber 04 v2 — FDI posture score + peers + capital gap.
// Compact, deterministic maths on live corpus tables; optional AI value-prop layered on top.

import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

const CountryInput = z.object({ countryCode: z.string().min(2).max(4) });

export interface PeerRow {
  code: string;
  name: string;
  gdp_usd: number | null;
  top1_share_pct: number;
  hhi: number;
  fdi_pct_gdp: number | null;
}

export interface ActiveTransition {
  threat_id: string;
  name: string;
  severity_pct: number;
  ministries_engaged: number;
  residual_risk_pp: number | null;
  status: "no_strategy" | "draft" | "plan_of_record";
}

export interface PostureView {
  country: { code: string; name: string; gdp_usd: number | null };
  posture_score: number;
  components: {
    concentration: number;   // 0..1 (higher = worse)
    diversification: number; // 0..1 (higher = better vs peers)
    pipeline: number;        // 0..1 (higher = more active strategies)
    coverage: number;        // 0..1 (higher = more exposure closed)
    hhi: number;
    top1_share_pct: number;
    top3_share_pct: number;
    fdi_pct_gdp: number | null;
  };
  capital_gap: {
    current_fdi_usd: number | null;
    target_fdi_usd: number | null;
    gap_usd: number | null;
    gap_pct_gdp: number | null;
    target_pct_gdp: number;
    target_basis: string;
  };
  peers: PeerRow[];
  active_transitions: ActiveTransition[];
  sectors: Array<{ code: string; label: string; share_pct: number; hue_token: string | null; fdi_dependency: number | null }>;
  investor_value_prop: string | null;
  snapshot_id: string | null;
  generated_at: string | null;
}

function hhi(shares: number[]): number {
  return shares.reduce((s, v) => s + v * v, 0);
}

async function loadCountrySectors(supabase: any, code: string) {
  const { data, error } = await supabase
    .from("country_sectors")
    .select("sector_code, share_pct, sectors(label, hue_token)")
    .eq("country_code", code)
    .order("share_pct", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: any) => ({
    code: r.sector_code as string,
    label: (r.sectors?.label as string) ?? r.sector_code,
    hue_token: (r.sectors?.hue_token as string | null) ?? null,
    share_pct: Number(r.share_pct ?? 0),
  }));
}

async function computeFdiInflow(supabase: any, code: string): Promise<number | null> {
  const { data, error } = await supabase
    .from("country_capital_flows")
    .select("node_key, value_usd_m, period, capital_flow_nodes(side)")
    .eq("country_code", code)
    .order("period", { ascending: false })
    .limit(200);
  if (error) return null;
  const latestPeriod = (data ?? [])[0]?.period;
  if (!latestPeriod) return null;
  const inflow = (data ?? [])
    .filter((r: any) => r.period === latestPeriod && (r.capital_flow_nodes?.side === "inputs" || String(r.node_key).toLowerCase().includes("fdi")))
    .filter((r: any) => String(r.node_key).toLowerCase().includes("fdi"))
    .reduce((s: number, r: any) => s + Number(r.value_usd_m ?? 0), 0);
  return inflow > 0 ? inflow * 1_000_000 : null;
}

async function pickPeers(supabase: any, self: { code: string; gdp_usd: number | null }): Promise<PeerRow[]> {
  const { data: pool } = await supabase
    .from("countries")
    .select("code, name, gdp_current_usd, is_caricom, is_oecs")
    .neq("code", self.code)
    .limit(50);
  const ranked = (pool ?? [])
    .filter((c: any) => c.gdp_current_usd)
    .sort((a: any, b: any) => {
      const da = Math.abs((a.gdp_current_usd ?? 0) - (self.gdp_usd ?? 0));
      const db = Math.abs((b.gdp_current_usd ?? 0) - (self.gdp_usd ?? 0));
      return da - db;
    })
    .slice(0, 3);
  const out: PeerRow[] = [];
  for (const p of ranked) {
    const sectors = await loadCountrySectors(supabase, p.code);
    const shares = sectors.map((s) => s.share_pct / 100);
    const inflow = await computeFdiInflow(supabase, p.code);
    out.push({
      code: p.code,
      name: p.name,
      gdp_usd: p.gdp_current_usd,
      top1_share_pct: sectors[0]?.share_pct ?? 0,
      hhi: hhi(shares),
      fdi_pct_gdp: inflow && p.gdp_current_usd ? (inflow / p.gdp_current_usd) * 100 : null,
    });
  }
  return out;
}

async function generateValueProp(
  countryName: string,
  sectors: Array<{ code: string; label: string; share_pct: number }>,
  peers: PeerRow[],
  gapPctGdp: number | null,
): Promise<{ text: string | null; model: string }> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) return { text: null, model: "" };
  try {
    const gateway = createLovableAiGatewayProvider(key);
    const model = "google/gemini-2.5-flash";
    const topSectors = sectors.slice(0, 4).map((s) => `${s.label} (${s.share_pct.toFixed(1)}%)`).join(", ");
    const peerLine = peers.map((p) => `${p.name} HHI ${p.hhi.toFixed(3)}`).join("; ");
    const gapLine = gapPctGdp ? `capital gap ~${gapPctGdp.toFixed(1)}% of GDP` : "capital gap not yet quantified";
    const prompt = `Write a single McKinsey-caliber paragraph (max 90 words) framing ${countryName} as an FDI destination for prospective institutional investors. Anchor on the transition opportunity — moving beyond ${topSectors} — and reference realistic peer benchmarks (${peerLine}). Note the ${gapLine}. Speak plainly, no jargon, no hype, no bullet points.`;
    const { text } = await generateText({ model: gateway(model), prompt });
    return { text: text.trim(), model };
  } catch {
    return { text: null, model: "" };
  }
}

export const getFdiPosture = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CountryInput.parse(d))
  .handler(async ({ data, context }): Promise<PostureView> => {
    const { supabase } = context;
    const code = data.countryCode;

    const [{ data: country }, sectors, { data: threats }, { data: strategies }, { data: exposureRow }] =
      await Promise.all([
        supabase.from("countries").select("code,name,gdp_current_usd").eq("code", code).maybeSingle(),
        loadCountrySectors(supabase, code),
        supabase.from("fdi_threats").select("id,name,severity_pct").eq("country_code", code),
        supabase
          .from("fdi_strategies")
          .select("id,fdi_threat_id,status,metrics")
          .eq("country_code", code),
        supabase
          .from("exposure_index")
          .select("value,period,decomposition")
          .eq("country_code", code)
          .order("period", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

    const gdp = country?.gdp_current_usd ?? null;
    const currentInflow = await computeFdiInflow(supabase, code);

    const shares = sectors.map((s) => s.share_pct / 100);
    const hhiVal = hhi(shares);
    const top1 = sectors[0]?.share_pct ?? 0;
    const top3 = sectors.slice(0, 3).reduce((s, r) => s + r.share_pct, 0);

    const peers = await pickPeers(supabase, { code, gdp_usd: gdp });

    // Component scoring 0..1
    const concentration = Math.min(1, hhiVal / 0.35); // HHI 0.35+ = fully concentrated
    const peerAvgHhi = peers.length ? peers.reduce((s, p) => s + p.hhi, 0) / peers.length : hhiVal;
    const diversification = peerAvgHhi > 0 ? Math.max(0, Math.min(1, (peerAvgHhi - hhiVal) / peerAvgHhi + 0.5)) : 0.5;

    const strategyList = (strategies ?? []) as Array<{ fdi_threat_id: string; status: string; metrics: any }>;
    const activeThreats = (threats ?? []) as Array<{ id: string; name: string; severity_pct: number }>;
    const withStrategy = new Set(strategyList.map((s) => s.fdi_threat_id));
    const pipeline = activeThreats.length === 0 ? 0.5 : Math.min(1, withStrategy.size / activeThreats.length);

    const totalExposure = activeThreats.reduce((s, t) => s + Number(t.severity_pct ?? 0), 0);
    const totalClosed = strategyList.reduce(
      (s, x) => s + Number(x.metrics?.exposure_closed_pp ?? 0),
      0,
    );
    const coverage = totalExposure > 0 ? Math.min(1, totalClosed / totalExposure) : 0.5;

    const posture = Math.round(
      100 *
        Math.max(
          0,
          Math.min(
            1,
            (1 - concentration) * 0.35 +
              diversification * 0.25 +
              pipeline * 0.2 +
              coverage * 0.2,
          ),
        ),
    );

    const targetPctGdp = 5.0; // aspirational target: FDI ~5% of GDP for small SIDS
    const targetFdi = gdp ? gdp * (targetPctGdp / 100) : null;
    const gapUsd = targetFdi != null && currentInflow != null ? Math.max(0, targetFdi - currentInflow) : null;
    const gapPctGdp = gapUsd != null && gdp ? (gapUsd / gdp) * 100 : null;

    // Active transitions rollup
    const stratByThreat = new Map<string, { status: string; metrics: any }[]>();
    strategyList.forEach((s) => {
      const arr = stratByThreat.get(s.fdi_threat_id) ?? [];
      arr.push(s);
      stratByThreat.set(s.fdi_threat_id, arr);
    });
    const active_transitions: ActiveTransition[] = activeThreats.map((t) => {
      const strats = stratByThreat.get(t.id) ?? [];
      const best = strats.find((s) => s.status === "plan_of_record") ?? strats[0];
      return {
        threat_id: t.id,
        name: t.name,
        severity_pct: Number(t.severity_pct ?? 0),
        ministries_engaged: Number(best?.metrics?.ministries_engaged ?? 0),
        residual_risk_pp: best ? Number(best.metrics?.residual_risk_pp ?? null) : null,
        status: !best ? "no_strategy" : (best.status as "draft" | "plan_of_record"),
      };
    });

    const valueProp = await generateValueProp(country?.name ?? code, sectors, peers, gapPctGdp);

    // Persist snapshot
    const { data: snap } = await supabase
      .from("fdi_posture_snapshots")
      .insert({
        country_code: code,
        posture_score: posture,
        components: {
          concentration, diversification, pipeline, coverage,
          hhi: hhiVal, top1_share_pct: top1, top3_share_pct: top3,
          fdi_pct_gdp: currentInflow && gdp ? (currentInflow / gdp) * 100 : null,
        },
        peer_country_codes: peers.map((p) => p.code),
        capital_gap_usd: gapUsd,
        capital_gap_pct_gdp: gapPctGdp,
        investor_value_prop: valueProp.text,
        ai_model: valueProp.model || null,
      })
      .select("id, generated_at")
      .maybeSingle();

    return {
      country: { code, name: country?.name ?? code, gdp_usd: gdp },
      posture_score: posture,
      components: {
        concentration, diversification, pipeline, coverage,
        hhi: hhiVal, top1_share_pct: top1, top3_share_pct: top3,
        fdi_pct_gdp: currentInflow && gdp ? (currentInflow / gdp) * 100 : null,
      },
      capital_gap: {
        current_fdi_usd: currentInflow,
        target_fdi_usd: targetFdi,
        gap_usd: gapUsd,
        gap_pct_gdp: gapPctGdp,
        target_pct_gdp: targetPctGdp,
        target_basis: "SIDS aspirational: FDI = 5% of GDP",
      },
      peers,
      active_transitions,
      sectors: sectors.map((s) => ({ ...s, fdi_dependency: null })),
      investor_value_prop: valueProp.text,
      snapshot_id: snap?.id ?? null,
      generated_at: snap?.generated_at ?? new Date().toISOString(),
    };
  });
