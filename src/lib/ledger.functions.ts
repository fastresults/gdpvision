// Ledger server functions (PRD §7.1 Chamber 1). All reads run under the
// authenticated user's RLS via requireSupabaseAuth; writes are additionally
// role-gated inside the handler with has_role().

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const CountryInput = z.object({ countryCode: z.string().min(3).max(4) });

export interface InstanceOverview {
  country: {
    code: string;
    name: string;
    currency: string;
    fiscalYearStartMonth: number;
    isCbiState: boolean;
    countryPack: Record<string, string | number | boolean | null | Record<string, string>>;
  };
  composition: Array<{
    sector_code: string;
    share_pct: number;
    confidence_grade: string;
  }>;
  exposureIndex: {
    period: string;
    value: number;
    confidence_grade: string;
  } | null;
}

export const getInstanceOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => CountryInput.parse(data))
  .handler(async ({ data, context }): Promise<InstanceOverview> => {
    const { supabase } = context;

    const [{ data: country, error: countryErr }, { data: comp, error: compErr }, { data: exp }] =
      await Promise.all([
        supabase
          .from("countries")
          .select("code,name,currency,fiscal_year_start_month,is_cbi_state,country_pack")
          .eq("code", data.countryCode)
          .maybeSingle(),
        supabase
          .from("country_sectors")
          .select("sector_code,share_pct,confidence_grade")
          .eq("country_code", data.countryCode),
        supabase
          .from("exposure_index")
          .select("period,value,confidence_grade")
          .eq("country_code", data.countryCode)
          .order("period", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

    if (countryErr) throw new Error(countryErr.message);
    if (compErr) throw new Error(compErr.message);
    if (!country) throw new Error(`Country ${data.countryCode} not found`);

    return {
      country: {
        code: country.code,
        name: country.name,
        currency: country.currency,
        fiscalYearStartMonth: country.fiscal_year_start_month,
        isCbiState: country.is_cbi_state,
        countryPack: (country.country_pack ?? {}) as InstanceOverview["country"]["countryPack"],
      },
      composition: (comp ?? []).map((row) => ({
        sector_code: row.sector_code,
        share_pct: Number(row.share_pct),
        confidence_grade: row.confidence_grade,
      })),
      exposureIndex: exp
        ? {
            period: exp.period,
            value: Number(exp.value),
            confidence_grade: exp.confidence_grade,
          }
        : null,
    };
  });

export const listInstanceBindings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("instance_bindings")
      .select("country_code,is_default,countries(name,currency,is_cbi_state)")
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

// ─── Sector Detail ────────────────────────────────────────────────────────────

const SectorInput = z.object({
  countryCode: z.string().min(3).max(4),
  sectorCode: z.string().min(2).max(64),
});

export interface SectorDetail {
  country: { code: string; name: string; currency: string };
  sector: { code: string; share_pct: number; confidence_grade: string };
  series: Array<{
    id: string;
    metric: string;
    unit: string;
    frequency: string;
    confidence_grade: string;
    source_name: string | null;
    points: Array<{ period: string; value: number }>;
  }>;
}

export const getSectorDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => SectorInput.parse(data))
  .handler(async ({ data, context }): Promise<SectorDetail> => {
    const { supabase } = context;

    const [{ data: country }, { data: comp }, { data: seriesRows }] = await Promise.all([
      supabase
        .from("countries")
        .select("code,name,currency")
        .eq("code", data.countryCode)
        .maybeSingle(),
      supabase
        .from("country_sectors")
        .select("sector_code,share_pct,confidence_grade")
        .eq("country_code", data.countryCode)
        .eq("sector_code", data.sectorCode)
        .maybeSingle(),
      supabase
        .from("series")
        .select("id,metric,unit,frequency,confidence_grade,sources(name)")
        .eq("country_code", data.countryCode)
        .eq("sector_code", data.sectorCode)
        .order("metric", { ascending: true }),
    ]);

    if (!country) throw new Error(`Country ${data.countryCode} not found`);

    const seriesIds = (seriesRows ?? []).map((s) => s.id);
    const points = seriesIds.length
      ? (
          await supabase
            .from("series_points")
            .select("series_id,period,value")
            .in("series_id", seriesIds)
            .order("period", { ascending: true })
        ).data ?? []
      : [];

    return {
      country: { code: country.code, name: country.name, currency: country.currency },
      sector: {
        code: data.sectorCode,
        share_pct: comp ? Number(comp.share_pct) : 0,
        confidence_grade: comp?.confidence_grade ?? "D",
      },
      series: (seriesRows ?? []).map((s) => ({
        id: s.id,
        metric: s.metric,
        unit: s.unit,
        frequency: s.frequency,
        confidence_grade: s.confidence_grade,
        source_name:
          (s.sources as unknown as { name: string } | null)?.name ?? null,
        points: points
          .filter((p) => p.series_id === s.id)
          .map((p) => ({ period: p.period, value: Number(p.value) })),
      })),
    };
  });

// ─── Exposure Index (full history + decomposition) ───────────────────────────

export interface ExposureHistory {
  country: { code: string; name: string };
  history: Array<{
    period: string;
    value: number;
    confidence_grade: string;
    methodology_ref: string | null;
    decomposition: Record<string, number>;
  }>;
}

export const getExposureHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => CountryInput.parse(data))
  .handler(async ({ data, context }): Promise<ExposureHistory> => {
    const { supabase } = context;
    const [{ data: country }, { data: rows, error }] = await Promise.all([
      supabase
        .from("countries")
        .select("code,name")
        .eq("code", data.countryCode)
        .maybeSingle(),
      supabase
        .from("exposure_index")
        .select("period,value,confidence_grade,methodology_ref,decomposition")
        .eq("country_code", data.countryCode)
        .order("period", { ascending: true }),
    ]);
    if (error) throw new Error(error.message);
    if (!country) throw new Error(`Country ${data.countryCode} not found`);
    return {
      country: { code: country.code, name: country.name },
      history: (rows ?? []).map((r) => ({
        period: r.period,
        value: Number(r.value),
        confidence_grade: r.confidence_grade,
        methodology_ref: r.methodology_ref,
        decomposition: (r.decomposition ?? {}) as Record<string, number>,
      })),
    };
  });

// ─── Stewardship queue ───────────────────────────────────────────────────────

export interface StewardshipQueue {
  isSteward: boolean;
  revisions: Array<{
    id: string;
    created_at: string;
    reason: string | null;
    period: string | null;
    previous_value: number | null;
    new_value: number | null;
    series: { metric: string; country_code: string; sector_code: string } | null;
  }>;
  seriesCounts: {
    total: number;
    graded: Record<string, number>;
  };
}

export const getStewardshipQueue = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => CountryInput.parse(data))
  .handler(async ({ data, context }): Promise<StewardshipQueue> => {
    const { supabase, userId } = context;

    const [{ data: stewardCheck }, { data: adminCheck }] = await Promise.all([
      supabase.rpc("has_role", { _user_id: userId, _role: "data_steward" }),
      supabase.rpc("has_role", { _user_id: userId, _role: "admin" }),
    ]);
    const isSteward = Boolean(stewardCheck) || Boolean(adminCheck);

    const { data: seriesRows } = await supabase
      .from("series")
      .select("id,confidence_grade")
      .eq("country_code", data.countryCode);

    const graded: Record<string, number> = {};
    for (const r of seriesRows ?? []) {
      graded[r.confidence_grade] = (graded[r.confidence_grade] ?? 0) + 1;
    }

    const seriesIds = (seriesRows ?? []).map((r) => r.id);
    const { data: revisions } = seriesIds.length
      ? await supabase
          .from("data_revisions")
          .select(
            "id,created_at,reason,period,previous_value,new_value,series:series_id(metric,country_code,sector_code)",
          )
          .in("series_id", seriesIds)
          .order("created_at", { ascending: false })
          .limit(50)
      : { data: [] };

    return {
      isSteward,
      seriesCounts: { total: seriesRows?.length ?? 0, graded },
      revisions: (revisions ?? []).map((r) => ({
        id: r.id,
        created_at: r.created_at,
        reason: r.reason,
        period: r.period,
        previous_value: r.previous_value !== null ? Number(r.previous_value) : null,
        new_value: r.new_value !== null ? Number(r.new_value) : null,
        series: (r.series as unknown as {
          metric: string;
          country_code: string;
          sector_code: string;
        } | null) ?? null,
      })),
    };
  });
