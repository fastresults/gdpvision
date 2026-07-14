// Capital-flow external searcher.
// Given a country, returns per-node USD-million flow values for the latest
// year, shaped for `upsertCapitalFlow` rows.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { buildCountryContext } from "@/lib/country-onboarding/country-context.server";
import { runWithFallbacks, jsonParser } from "@/lib/country-onboarding/fallback.server";
import type { CorpusCitation } from "../types";

export type FlowSearchInput = { countryCode: string; period?: string };

type FlowPayload = {
  period: string;
  flows: Array<{
    node_key: string;
    value_usd_m: number;
    confidence_grade?: string;
    notes?: string;
    source_url?: string;
  }>;
};

export async function searchCapitalFlows(input: FlowSearchInput): Promise<{
  data: FlowPayload;
  citations: CorpusCitation[];
  tier: string;
  notes?: string[];
} | null> {
  const ctx = await buildCountryContext(supabaseAdmin, input.countryCode);

  // Read the canonical node registry so the model uses real node_keys.
  const { data: nodes } = await supabaseAdmin
    .from("capital_flow_nodes")
    .select("node_key, label, side")
    .order("sort_order");
  const nodeCatalog = (nodes ?? [])
    .map((n) => `- ${n.node_key} (${n.side}): ${n.label}`)
    .join("\n");

  const result = await runWithFallbacks<FlowPayload>({
    context: ctx,
    topic: `${ctx.name} capital flows (USD millions, latest year)`,
    perplexity: {
      model: "sonar-reasoning-pro",
      system: `You are a national accounts economist. For each node in the catalog, return the latest annual value in USD millions. Return ONLY JSON. If a node is genuinely unknown, omit it — never fabricate.`,
      user: `Country: ${ctx.name}. Return latest-year capital flow values (USD millions) for these nodes:\n${nodeCatalog}\n\nUse World Bank, IMF WEO, national central bank, or Ministry of Finance. Report the year (period) used.`,
      recency: "year",
      responseSchema: {
        type: "object",
        properties: {
          period: { type: "string" },
          flows: {
            type: "array",
            items: {
              type: "object",
              properties: {
                node_key: { type: "string" },
                value_usd_m: { type: "number" },
                confidence_grade: { type: "string" },
                notes: { type: "string" },
                source_url: { type: "string" },
              },
              required: ["node_key", "value_usd_m"],
            },
          },
        },
        required: ["period", "flows"],
      },
    },
    gemini: {
      system: `Repair the JSON. Every flow needs a node_key from the catalog and a numeric value_usd_m.`,
      user: `Extract capital flows for ${ctx.name}.`,
      schemaHint: `{"period":"2024","flows":[{"node_key":"fdi_in","value_usd_m":123.4,"confidence_grade":"B","source_url":"https://..."}]}`,
    },
    parse: jsonParser<FlowPayload>(),
    validate: (v) => !!v?.period && Array.isArray(v.flows) && v.flows.length > 0,
    infer: () => ({ period: "", flows: [] }),
  });

  if (!result.data.flows.length) return null;

  const citations: CorpusCitation[] = result.citations.map((c) => ({ url: c.url, title: c.title }));
  return { data: result.data, citations, tier: result.tier, notes: result.notes };
}
