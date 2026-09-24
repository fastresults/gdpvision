// Capital-flow partner geography searcher.
// Second pass over the capital-flow corpus: for each node, identify the top
// origin countries (inflows) or destination countries (outflows) with
// approximate shares and citations. Partner geography is only ever recorded
// with a source — never inferred.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { buildCountryContext } from "@/lib/country-onboarding/country-context.server";
import { runWithFallbacks, jsonParser } from "@/lib/country-onboarding/fallback.server";
import type { CorpusCitation } from "../types";

export type FlowPartnerSearchInput = { countryCode: string; period?: string };

export type FlowPartnerRow = {
  node_key: string;
  partner_name: string;
  partner_iso3?: string;
  share_pct?: number;
  value_usd_m?: number;
  confidence_grade?: string;
  source_url?: string;
};

type FlowPartnerPayload = {
  period: string;
  partners: FlowPartnerRow[];
};

export async function searchCapitalFlowPartners(input: FlowPartnerSearchInput): Promise<{
  data: FlowPartnerPayload;
  citations: CorpusCitation[];
  tier: string;
  notes?: string[];
} | null> {
  const ctx = await buildCountryContext(supabaseAdmin, input.countryCode);

  const { data: nodes } = await supabaseAdmin
    .from("capital_flow_nodes")
    .select("node_key, label, side")
    .order("sort_order");
  const validKeys = new Set((nodes ?? []).map((n) => String(n.node_key)));
  const canonicalKeys = [...validKeys].join(" | ");
  const nodeCatalog = (nodes ?? [])
    .map((n) => `- ${n.node_key} (${n.side}): ${n.label}`)
    .join("\n");

  const result = await runWithFallbacks<FlowPartnerPayload>({
    context: ctx,
    topic: `${ctx.name} capital flow partner countries (bilateral origins and destinations)`,
    perplexity: {
      model: "sonar-reasoning-pro",
      system: `You are a balance-of-payments economist. For each flow node in the catalog, identify the top 3-5 partner countries: origin countries for inflows, destination countries for outflows. Give each partner an ISO3 code, an approximate share of the flow (share_pct, 0-100), and where possible an estimated USD-million value. Use only cited bilateral sources (IMF CDIS/CPIS, UN Comtrade, central bank bulletins, OECD). If partners for a node are genuinely unknown, omit that node — never invent plausible-sounding partners. Return ONLY JSON. node_key MUST be one of: ${canonicalKeys}.`,
      user: `Country: ${ctx.name}. For these exact flow nodes, list top partner countries:\n${nodeCatalog}\n\nReport the year (period) used and cite a source for every partner row.`,
      recency: "year",
      responseSchema: {
        type: "object",
        properties: {
          period: { type: "string" },
          partners: {
            type: "array",
            items: {
              type: "object",
              properties: {
                node_key: { type: "string", enum: [...validKeys] },
                partner_name: { type: "string" },
                partner_iso3: { type: "string" },
                share_pct: { type: "number" },
                value_usd_m: { type: "number" },
                confidence_grade: { type: "string" },
                source_url: { type: "string" },
              },
              required: ["node_key", "partner_name"],
            },
          },
        },
        required: ["period", "partners"],
      },
    },
    gemini: {
      system: `Repair the JSON. Every partner row needs a canonical node_key from this exact set: ${canonicalKeys}. Every partner needs a partner_name; partner_iso3 must be a real 3-letter ISO country code. Drop rows with no source_url. Never invent partners.`,
      user: `Extract capital flow partner countries for ${ctx.name}.`,
      schemaHint: `{"period":"2024","partners":[{"node_key":"FDI_NET","partner_name":"United States","partner_iso3":"USA","share_pct":34.5,"value_usd_m":42.1,"confidence_grade":"B","source_url":"https://..."}]}`,
    },
    parse: jsonParser<FlowPartnerPayload>(),
    validate: (v) =>
      !!v?.period &&
      Array.isArray(v.partners) &&
      v.partners.some((p) => validKeys.has(String(p.node_key)) && typeof p.partner_name === "string" && p.partner_name.length > 1),
    infer: () => ({ period: "", partners: [] }),
  });

  const canonical = result.data.partners
    .map((p) => ({
      ...p,
      node_key: String(p.node_key ?? "").trim().toUpperCase(),
      partner_name: String(p.partner_name ?? "").trim(),
      partner_iso3: p.partner_iso3 ? String(p.partner_iso3).trim().toUpperCase().slice(0, 3) : undefined,
      share_pct: Number.isFinite(Number(p.share_pct)) ? Math.max(0, Math.min(100, Number(p.share_pct))) : undefined,
      value_usd_m: Number.isFinite(Number(p.value_usd_m)) && Number(p.value_usd_m) > 0 ? Number(p.value_usd_m) : undefined,
    }))
    .filter((p) => validKeys.has(p.node_key) && p.partner_name.length > 1 && !!p.source_url);
  if (!canonical.length) return null;

  const citations: CorpusCitation[] = result.citations.map((c) => ({ url: c.url, title: c.title }));
  return { data: { ...result.data, partners: canonical }, citations, tier: result.tier, notes: result.notes };
}
