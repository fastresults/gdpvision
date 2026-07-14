// KPI-domain external searcher.
// Given a country + kpi_code, runs the standard onboarding fallback
// waterfall (Perplexity → Gemini repair → inference) to find the most
// recent authoritative value + citation. Returns rows shaped for
// `upsertKpi` in writers.server.ts.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { buildCountryContext } from "@/lib/country-onboarding/country-context.server";
import { runWithFallbacks, jsonParser } from "@/lib/country-onboarding/fallback.server";
import { findRegistryEntry } from "@/lib/country-onboarding/kpi-registry";
import type { CorpusCitation } from "../types";
import type { KpiWriteInput } from "../writers.server";

export type KpiSearchInput = {
  countryCode: string;
  kpiCode: string;
};

type KpiPayload = {
  kpi_code: string;
  label: string;
  unit: string;
  latest_value: number | null;
  latest_period: string | null;
  source_url: string;
  source_org?: string | null;
  notes?: string | null;
};

export async function searchKpi(input: KpiSearchInput): Promise<{
  data: { row: KpiWriteInput };
  citations: CorpusCitation[];
  tier: string;
  notes?: string[];
} | null> {
  const ctx = await buildCountryContext(supabaseAdmin, input.countryCode);
  const reg = findRegistryEntry(input.kpiCode);
  const label = reg?.label ?? input.kpiCode;
  const unit = reg?.unit ?? "";
  const orgs = reg?.authoritative_orgs?.join(" / ") ?? "World Bank / IMF / UN";

  const result = await runWithFallbacks<KpiPayload>({
    context: ctx,
    topic: `latest ${label} for ${ctx.name}`,
    perplexity: {
      model: "sonar-pro",
      system: `You are a national statistics analyst. Return ONLY JSON matching the schema. Never fabricate a number — if unknown, set latest_value to null and explain in notes.`,
      user: `Find the most recent authoritative value for "${label}" (${input.kpiCode}) in ${ctx.name}. Preferred sources: ${orgs}. Report the exact period (year or year-quarter) and the exact source URL.`,
      recency: "year",
      responseSchema: {
        type: "object",
        properties: {
          kpi_code: { type: "string" },
          label: { type: "string" },
          unit: { type: "string" },
          latest_value: { type: ["number", "null"] },
          latest_period: { type: ["string", "null"] },
          source_url: { type: "string" },
          source_org: { type: "string" },
          notes: { type: "string" },
        },
        required: ["kpi_code", "latest_value", "source_url"],
      },
    },
    gemini: {
      system: `Repair the JSON. source_url must be a real https URL. Never invent a value.`,
      user: `Extract the latest ${label} for ${ctx.name}. Prefer ${orgs}.`,
      schemaHint: `{"kpi_code":"${input.kpiCode}","label":"...","unit":"${unit}","latest_value":number|null,"latest_period":"YYYY","source_url":"https://...","source_org":"...","notes":"..."}`,
    },
    parse: jsonParser<KpiPayload>(),
    validate: (v) => !!v && /^https?:\/\//.test(v.source_url ?? ""),
    infer: () => ({
      kpi_code: input.kpiCode,
      label,
      unit,
      latest_value: null,
      latest_period: null,
      source_url: "",
      notes: "no source found",
    }),
  });

  if (!result.data.source_url) return null;

  const citations: CorpusCitation[] = result.citations.map((c) => ({
    url: c.url,
    title: c.title,
  }));

  const row: KpiWriteInput = {
    country_code: input.countryCode,
    kpi_code: input.kpiCode,
    label: result.data.label || label,
    unit: result.data.unit || unit,
    direction: reg?.direction ?? "up",
    category: reg?.category ?? "macro",
    latest_value: result.data.latest_value,
    latest_period: result.data.latest_period,
    notes: result.data.notes ?? null,
    source_url: result.data.source_url,
    source_org: result.data.source_org ?? null,
    tier: result.tier,
  };

  return { data: { row }, citations, tier: result.tier, notes: result.notes };
}
