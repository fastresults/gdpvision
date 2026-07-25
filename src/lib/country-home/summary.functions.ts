// @domain country-home
// @tables cabinet_sessions,countries,country_kpis,country_source_documents,country_sources,ministries,service_request_deliverables
// @ui src/components/country/CountryMasthead.tsx

// Country home summary: masthead brief-strip data.
// Returns light KPI + activity counts. Any missing value is returned as
// `null` and the UI renders "— not yet on record" (empty state contract).

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface CountryHomeSummary {
  code: string;
  name: string | null;
  currency: string | null;
  gdp_usd: number | null;
  gdp_year: number | null;
  kpi_count: number;
  corpus_sources: number;
  corpus_documents: number;
  ministries: number;
  pending_deliverables: number;
  next_cabinet_at: string | null;
  last_commit_at: string | null;
}

export const getCountryHomeSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ countryCode: z.string().min(2).max(8) }).parse(d),
  )
  .handler(async ({ data, context }): Promise<CountryHomeSummary> => {
    const cc = data.countryCode.toUpperCase();

    const [
      countryRes,
      kpiCountRes,
      sourcesRes,
      docsRes,
      ministriesRes,
      deliverablesRes,
      cabinetRes,
    ] = await Promise.all([
      context.supabase
        .from("countries")
        .select("name,currency,gdp_current_usd,gdp_year,updated_at")
        .eq("code", cc)
        .maybeSingle(),
      context.supabase
        .from("country_kpis")
        .select("kpi_code", { count: "exact", head: true })
        .eq("country_code", cc)
        .not("latest_value", "is", null),
      context.supabase
        .from("country_sources")
        .select("id", { count: "exact", head: true })
        .eq("country_code", cc),
      context.supabase
        .from("country_source_documents")
        .select("id, country_sources!inner(country_code)", { count: "exact", head: true })
        .eq("country_sources.country_code", cc),
      context.supabase
        .from("ministries")
        .select("id", { count: "exact", head: true })
        .eq("country_code", cc),
      context.supabase
        .from("service_request_deliverables")
        .select("id", { count: "exact", head: true })
        .is("read_at", null),
      context.supabase
        .from("cabinet_sessions")
        .select("scheduled_for")
        .eq("country_code", cc)
        .gt("scheduled_for", new Date().toISOString())
        .order("scheduled_for", { ascending: true })
        .limit(1)
        .maybeSingle(),
    ]);

    const country = countryRes.data ?? null;

    return {
      code: cc,
      name: country?.name ?? null,
      currency: country?.currency ?? null,
      gdp_usd: country?.gdp_current_usd != null ? Number(country.gdp_current_usd) : null,
      gdp_year: country?.gdp_year ?? null,
      kpi_count: kpiCountRes.count ?? 0,
      corpus_sources: sourcesRes.count ?? 0,
      corpus_documents: docsRes.count ?? 0,
      ministries: ministriesRes.count ?? 0,
      pending_deliverables: deliverablesRes.count ?? 0,
      next_cabinet_at: (cabinetRes.data as any)?.scheduled_for ?? null,
      last_commit_at: country?.updated_at ?? null,
    };
  });
