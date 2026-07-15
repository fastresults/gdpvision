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
  const validKeys = new Set((nodes ?? []).map((n) => String(n.node_key)));
  const canonicalKeys = [...validKeys].join(" | ");
  const nodeCatalog = (nodes ?? [])
    .map((n) => `- ${n.node_key} (${n.side}): ${n.label}`)
    .join("\n");

  const result = await runWithFallbacks<FlowPayload>({
    context: ctx,
    topic: `${ctx.name} capital flows (USD millions, latest year)`,
    perplexity: {
      model: "sonar-reasoning-pro",
      system: `You are a national accounts economist. For each node in the catalog, return the latest annual value in USD millions. Return ONLY JSON. node_key MUST be one of: ${canonicalKeys}. If a node is genuinely unknown, omit it — never fabricate or invent alternate key names.`,
      user: `Country: ${ctx.name}. Return latest-year capital flow values (USD millions) for these exact node keys:\n${nodeCatalog}\n\nUse World Bank, IMF WEO, national central bank, or Ministry of Finance. Report the year (period) used.`,
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
                node_key: { type: "string", enum: [...validKeys] },
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
      system: `Repair the JSON. Every flow needs a canonical node_key from this exact set: ${canonicalKeys}; never invent lowercase aliases. Every value_usd_m must be numeric.`,
      user: `Extract capital flows for ${ctx.name}.`,
      schemaHint: `{"period":"2024","flows":[{"node_key":"FDI_NET","value_usd_m":123.4,"confidence_grade":"B","source_url":"https://..."}]}`,
    },
    parse: jsonParser<FlowPayload>(),
    validate: (v) => !!v?.period && Array.isArray(v.flows) && v.flows.some((f) => validKeys.has(String(f.node_key))),
    infer: () => ({ period: "", flows: [] }),
  });

  const canonicalFlows = result.data.flows
    .map((f) => ({ ...f, node_key: String(f.node_key ?? "").trim().toUpperCase() }))
    .filter((f) => validKeys.has(f.node_key) && Number.isFinite(Number(f.value_usd_m)) && Number(f.value_usd_m) > 0);
  if (!canonicalFlows.length) return null;

  const citations: CorpusCitation[] = result.citations.map((c) => ({ url: c.url, title: c.title }));
  return { data: { ...result.data, flows: canonicalFlows }, citations, tier: result.tier, notes: result.notes };
}
