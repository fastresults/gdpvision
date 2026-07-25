// @domain country-data
// @tables country_kpis
// @ui src/routes/_authenticated/instrument/mandate.scorecard.tsx

// Consumer-facing reads over the ingested country data corpus.
// Any authenticated user bound to the country (RLS-enforced) can read.
// KPI reads reflect source toggles: a KPI whose linked source is inactive
// is hidden immediately.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const CodeInput = z.object({ countryCode: z.string().min(2).max(4) });

export type ConsumerKpi = {
  id: string;
  country_code: string;
  kpi_code: string;
  label: string;
  unit: string | null;
  direction: string | null;
  category: string | null;
  source_id: string | null;
  latest_value: number | null;
  latest_period: string | null;
  target: number | null;
  notes: string | null;
  provenance: string | null;
  confidence: string | null;
  inference_rationale: string | null;
  inference_model: string | null;
  source: { id: string; url: string; title: string; org: string; active: boolean } | null;
};

export const listCountryKpis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CodeInput.parse(d))
  .handler(async ({ data, context }): Promise<ConsumerKpi[]> => {
    const { recordCorpusReadOutcome } = await import("@/lib/corpus/gateway.server");
    const t0 = Date.now();
    // RLS scopes to bound users + admins.
    const { data: rows, error } = await context.supabase
      .from("country_kpis")
      .select(
        "id, country_code, kpi_code, label, unit, direction, category, source_id, latest_value, latest_period, target, notes, provenance, confidence, inference_rationale, inference_model, country_sources(id, url, title, org, active)",
      )
      .eq("country_code", data.countryCode)
      .order("category", { ascending: true })
      .order("kpi_code", { ascending: true });
    if (error) throw error;

    void recordCorpusReadOutcome({
      countryCode: data.countryCode,
      domain: "kpi",
      key: "consume:list",
      outcome: (rows?.length ?? 0) > 0 ? "hit" : "empty",
      latencyMs: Date.now() - t0,
      actor: context.userId,
    });

    // Hide KPIs whose linked source is toggled off. KPIs without a source
    // still surface (manually curated or inferred) so operators are not blocked.
    return ((rows ?? []) as any[])
      .filter((r) => !r.country_sources || r.country_sources.active !== false)
      .map((r) => ({
        id: r.id,
        country_code: r.country_code,
        kpi_code: r.kpi_code,
        label: r.label,
        unit: r.unit,
        direction: r.direction,
        category: r.category,
        source_id: r.source_id,
        latest_value: r.latest_value,
        latest_period: r.latest_period,
        target: r.target,
        notes: r.notes,
        provenance: r.provenance ?? null,
        confidence: r.confidence ?? null,
        inference_rationale: r.inference_rationale ?? null,
        inference_model: r.inference_model ?? null,
        source: r.country_sources
          ? {
              id: r.country_sources.id,
              url: r.country_sources.url,
              title: r.country_sources.title,
              org: r.country_sources.org,
              active: r.country_sources.active,
            }
          : null,
      }));
  });
