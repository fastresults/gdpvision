// @domain executive
// @tables countries,country_kpis,country_source_documents,country_sources
// @ui src/components/executive/ExecutiveDashboard.tsx
//
// The Executive Dashboard read. One protected server fn, eight independent
// chamber resolvers. A resolver that throws degrades to a quiet card — one
// broken chamber never blanks the Principal's screen.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

import type { ExecutiveDashboardDTO } from "./types";

export const getExecutiveDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ country_code: z.string().min(2).max(8) }).parse(d))
  .handler(async ({ data, context }): Promise<ExecutiveDashboardDTO> => {
    const cc = data.country_code.toUpperCase();
    const sb = context.supabase as any;

    const [{ resolveLedger, resolvePortfolios, resolveScenarios, resolveStudio }, { resolveNarrative, resolveCabinet, resolvePersonas, resolveMandate }] =
      await Promise.all([
        import("./resolvers/core.server"),
        import("./resolvers/office.server"),
      ]);

    const [country, kpis, freshDoc, ...chambers] = await Promise.all([
      sb.from("countries").select("name,currency,gdp_current_usd,gdp_year").eq("code", cc).maybeSingle(),
      sb.from("country_kpis").select("confidence,latest_value").eq("country_code", cc).limit(2000),
      sb
        .from("country_source_documents")
        .select("created_at, country_sources!inner(country_code)")
        .eq("country_sources.country_code", cc)
        .order("created_at", { ascending: false })
        .limit(1),
      resolveLedger(sb, cc),
      resolvePortfolios(sb, cc),
      resolveScenarios(sb, cc),
      resolveStudio(sb, cc),
      resolveNarrative(sb, cc),
      resolveCabinet(sb, cc),
      resolvePersonas(sb, cc),
      resolveMandate(sb, cc),
    ]);

    const kpiRows = (kpis.data ?? []).filter((r: any) => r.latest_value !== null && r.latest_value !== undefined);
    const graded = kpiRows.filter((r: any) => ["A", "B"].includes(String(r.confidence ?? "").toUpperCase()));

    return {
      masthead: {
        code: cc,
        name: country.data?.name ?? null,
        currency: country.data?.currency ?? null,
        gdp_usd: country.data?.gdp_current_usd != null ? Number(country.data.gdp_current_usd) : null,
        gdp_year: country.data?.gdp_year ?? null,
        grade_ab: kpiRows.length ? graded.length / kpiRows.length : null,
        corpus_fresh_at: (freshDoc.data ?? [])[0]?.created_at ?? null,
      },
      chambers,
      generated_at: new Date().toISOString(),
    };
  });
