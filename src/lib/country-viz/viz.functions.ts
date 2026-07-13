// GDP Vision — visualization data layer.
// Read-only aggregate over already-committed onboarding data. No writes.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data: isAdmin } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (!isAdmin) throw new Error("Forbidden: super admin only");
}

const CodeInput = z.object({ countryCode: z.string().min(2).max(4) });

export type SectorTile = {
  code: string;
  label: string;
  hue_token: string; // e.g. "sector-tou"
  share_pct: number;
  confidence_grade: string;
  ministers: Array<{ ministry_slug: string; ministry_name: string; minister: string | null; weight: number }>;
};

export type MacroKpi = {
  kpi_code: string;
  label: string;
  unit: string;
  latest_value: number | null;
  latest_period: string | null;
  target: number | null;
  direction: string;
  category: string | null;
  freshness_status: string;
  provenance: string;
};

export type SectorKpiPoint = { period: string; value: number };

export type VizOverview = {
  country: { code: string; name: string } | null;
  updated_at: string | null;
  sectors: SectorTile[];
  macro: MacroKpi[]; // hand-picked headline KPIs
  allKpis: MacroKpi[]; // full list, for chart lookups
  ministries: Array<{ slug: string; name: string; minister: string | null }>;
  ministrySectorMatrix: Array<{ ministry_slug: string; sector_code: string; weight: number }>;
  sectorKpiSeries: Array<{ sector_code: string; kpi_code: string; unit: string; label: string; points: SectorKpiPoint[]; latest: number | null; target: number | null }>;
  fiscalSeries: { debtToGdp: SectorKpiPoint[]; fiscalBalance: SectorKpiPoint[] };
  diagnostics: {
    hasSectors: boolean;
    hasKpis: boolean;
    hasMinistries: boolean;
    hasMinistrySectors: boolean;
    missing: string[];
  };
};

const HEADLINE_KPIS = [
  "gdp_usd", "gdp_growth", "gdp_per_capita", "inflation", "unemployment",
  "debt_to_gdp", "fiscal_balance_pct_gdp", "current_account_pct_gdp",
  "poverty_rate", "hdi",
];

// Which KPIs (loose match) are relevant per sector code (fallback registry).
const SECTOR_KPI_HINTS: Record<string, string[]> = {
  TOU: ["tourism", "arrivals", "hotel"],
  AGR: ["agri", "farm", "crop"],
  MAN: ["manufactur", "industry"],
  FIN: ["financ", "bank", "credit"],
  CON: ["constru"],
  TRA: ["transp", "logist", "port"],
  ICT: ["ict", "digital", "internet"],
  ENE: ["energy", "electric", "renew"],
  EDU: ["educat", "school", "literacy"],
  HEA: ["health", "life_expect", "mortal"],
  MIN: ["mining", "extract", "oil", "gas"],
  RET: ["retail", "trade"],
  PUB: ["public", "govern"],
  CRE: ["creative", "cultur"],
  BLU: ["blue", "fish", "marine", "ocean"],
};

function matchSectorKpi(sectorCode: string, kpiCode: string, label: string) {
  const hints = SECTOR_KPI_HINTS[sectorCode] ?? [];
  const hay = `${kpiCode} ${label}`.toLowerCase();
  return hints.some((h) => hay.includes(h));
}

export const getVizOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CodeInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const cc = data.countryCode;

    const [
      { data: country },
      { data: sectorsReg },
      { data: countrySectors },
      { data: kpis },
      { data: ministries },
      { data: ministryProfiles },
      { data: ministrySectors },
    ] = await Promise.all([
      supabaseAdmin.from("countries").select("code, name").eq("code", cc).maybeSingle(),
      supabaseAdmin.from("sectors").select("code, label, hue_token, sort_order").order("sort_order"),
      supabaseAdmin.from("country_sectors").select("*").eq("country_code", cc),
      supabaseAdmin.from("country_kpis").select("id, kpi_code, label, unit, latest_value, latest_period, target, direction, category, freshness_status, provenance, updated_at").eq("country_code", cc),
      supabaseAdmin.from("ministries").select("id, slug, name, sort_order").eq("country_code", cc).order("sort_order"),
      supabaseAdmin.from("ministry_profiles").select("ministry_slug, minister").eq("country_code", cc),
      supabaseAdmin.from("ministry_sectors").select("ministry_id, sector_code, weight").in("ministry_id", []).then(async () => {
        // We need ministry_ids for this country. Re-issue with the right filter.
        const { data: mm } = await supabaseAdmin.from("ministries").select("id").eq("country_code", cc);
        const ids = (mm ?? []).map((m: any) => m.id);
        if (!ids.length) return { data: [] as any[] };
        return supabaseAdmin.from("ministry_sectors").select("ministry_id, sector_code, weight").in("ministry_id", ids);
      }),
    ]);

    const regByCode = new Map<string, { label: string; hue_token: string }>();
    for (const s of sectorsReg ?? []) regByCode.set(s.code, { label: s.label, hue_token: s.hue_token });

    // Ministry lookup
    const ministryBySlug = new Map<string, { id: string; name: string; slug: string; minister: string | null }>();
    const ministryById = new Map<string, { slug: string; name: string; minister: string | null }>();
    const minProfBySlug = new Map<string, string | null>();
    for (const p of ministryProfiles ?? []) minProfBySlug.set(p.ministry_slug, p.minister ?? null);
    for (const m of ministries ?? []) {
      const minister = minProfBySlug.get(m.slug) ?? null;
      ministryBySlug.set(m.slug, { id: m.id, name: m.name, slug: m.slug, minister });
      ministryById.set(m.id, { slug: m.slug, name: m.name, minister });
    }

    // Sectors
    const sectorTiles: SectorTile[] = (countrySectors ?? [])
      .map((cs: any) => {
        const reg = regByCode.get(cs.sector_code);
        const ministers = (ministrySectors ?? [])
          .filter((ms: any) => ms.sector_code === cs.sector_code)
          .map((ms: any) => {
            const m = ministryById.get(ms.ministry_id);
            return {
              ministry_slug: m?.slug ?? "",
              ministry_name: m?.name ?? "Unknown ministry",
              minister: m?.minister ?? null,
              weight: Number(ms.weight ?? 1),
            };
          })
          .sort((a, b) => b.weight - a.weight);
        return {
          code: cs.sector_code,
          label: reg?.label ?? cs.sector_code,
          hue_token: reg?.hue_token ?? "sector-default",
          share_pct: Number(cs.share_pct ?? 0),
          confidence_grade: cs.confidence_grade ?? "C",
          ministers,
        };
      })
      .sort((a, b) => b.share_pct - a.share_pct);

    // Macro KPI subset
    const allKpis: MacroKpi[] = (kpis ?? []).map((k: any) => ({
      kpi_code: k.kpi_code,
      label: k.label,
      unit: k.unit,
      latest_value: k.latest_value == null ? null : Number(k.latest_value),
      latest_period: k.latest_period ?? null,
      target: k.target == null ? null : Number(k.target),
      direction: k.direction ?? "higher_is_better",
      category: k.category ?? null,
      freshness_status: k.freshness_status ?? "unknown",
      provenance: k.provenance ?? "unknown",
    }));

    const macro: MacroKpi[] = HEADLINE_KPIS
      .map((code) => allKpis.find((k) => k.kpi_code === code))
      .filter((k): k is MacroKpi => !!k);

    // KPI time series — batch fetch points for kpis of interest (all macro + first matched per sector).
    const kpiById = new Map<string, { code: string; unit: string; label: string; target: number | null; latest: number | null }>();
    for (const k of kpis ?? []) kpiById.set(k.id, { code: k.kpi_code, unit: k.unit, label: k.label, target: k.target == null ? null : Number(k.target), latest: k.latest_value == null ? null : Number(k.latest_value) });
    const macroKpiIds = (kpis ?? []).filter((k: any) => HEADLINE_KPIS.includes(k.kpi_code)).map((k: any) => k.id);

    // For each sector pick up to 1 headline KPI
    const sectorKpiPick: Array<{ sector: string; id: string; code: string; unit: string; label: string; target: number | null; latest: number | null }> = [];
    for (const s of sectorTiles) {
      const match = (kpis ?? []).find((k: any) => matchSectorKpi(s.code, k.kpi_code, k.label));
      if (match) sectorKpiPick.push({ sector: s.code, id: match.id, code: match.kpi_code, unit: match.unit, label: match.label, target: match.target == null ? null : Number(match.target), latest: match.latest_value == null ? null : Number(match.latest_value) });
    }
    const allInterestIds = Array.from(new Set([...macroKpiIds, ...sectorKpiPick.map((s) => s.id)]));

    const pointsByKpi = new Map<string, SectorKpiPoint[]>();
    if (allInterestIds.length) {
      const { data: pts } = await supabaseAdmin
        .from("country_kpi_points")
        .select("country_kpi_id, period, value")
        .in("country_kpi_id", allInterestIds)
        .order("period", { ascending: true });
      for (const p of pts ?? []) {
        const arr = pointsByKpi.get(p.country_kpi_id) ?? [];
        arr.push({ period: p.period, value: Number(p.value) });
        pointsByKpi.set(p.country_kpi_id, arr);
      }
    }

    const sectorKpiSeries = sectorKpiPick.map((s) => ({
      sector_code: s.sector,
      kpi_code: s.code,
      unit: s.unit,
      label: s.label,
      points: pointsByKpi.get(s.id) ?? [],
      latest: s.latest,
      target: s.target,
    }));

    const fiscalDebtId = (kpis ?? []).find((k: any) => k.kpi_code === "debt_to_gdp")?.id;
    const fiscalBalId = (kpis ?? []).find((k: any) => k.kpi_code === "fiscal_balance_pct_gdp")?.id;

    const fiscalSeries = {
      debtToGdp: fiscalDebtId ? pointsByKpi.get(fiscalDebtId) ?? [] : [],
      fiscalBalance: fiscalBalId ? pointsByKpi.get(fiscalBalId) ?? [] : [],
    };

    const ministrySectorMatrix = (ministrySectors ?? []).map((ms: any) => ({
      ministry_slug: ministryById.get(ms.ministry_id)?.slug ?? "",
      sector_code: ms.sector_code,
      weight: Number(ms.weight ?? 1),
    })).filter((r) => r.ministry_slug);

    const missing: string[] = [];
    if (!sectorTiles.length) missing.push("Sector composition (stage 3)");
    if (!allKpis.length) missing.push("KPI seed (stage 7)");
    if (!(ministries ?? []).length) missing.push("Ministries (stage 4)");
    if (!(ministrySectors ?? []).length) missing.push("Ministry×Sector map (stage 5)");

    return {
      country: country ?? null,
      updated_at: new Date().toISOString(),
      sectors: sectorTiles,
      macro,
      allKpis,
      ministries: (ministries ?? []).map((m: any) => ({ slug: m.slug, name: m.name, minister: minProfBySlug.get(m.slug) ?? null })),
      ministrySectorMatrix,
      sectorKpiSeries,
      fiscalSeries,
      diagnostics: {
        hasSectors: sectorTiles.length > 0,
        hasKpis: allKpis.length > 0,
        hasMinistries: (ministries ?? []).length > 0,
        hasMinistrySectors: (ministrySectors ?? []).length > 0,
        missing,
      },
    } as VizOverview;
  });

const SectorEvidenceInput = z.object({
  countryCode: z.string().min(2).max(4),
  sectorCode: z.string().min(2).max(8),
});

export const getSectorEvidence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SectorEvidenceInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: dossiers }, { data: memory }] = await Promise.all([
      supabaseAdmin
        .from("sector_dossiers")
        .select("kind, payload, citations, updated_at")
        .eq("country_code", data.countryCode)
        .eq("sector_code", data.sectorCode)
        .order("updated_at", { ascending: false }),
      supabaseAdmin
        .from("memory_objects")
        .select("kind, title, content, scope_key, updated_at")
        .ilike("scope_key", `country:${data.countryCode}%`)
        .ilike("content", `%${data.sectorCode}%`)
        .limit(8),
    ]);
    return {
      dossiers: dossiers ?? [],
      memory: memory ?? [],
    };
  });
