// Sector-domain external searcher.
// Given a country, returns a share-pct breakdown of GDP by sector.
// Wraps the standard fallback waterfall; caller writes back via
// `replace_country_sectors` RPC or per-row upsert.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { buildCountryContext } from "@/lib/country-onboarding/country-context.server";
import { runWithFallbacks, jsonParser } from "@/lib/country-onboarding/fallback.server";
import type { CorpusCitation } from "../types";

export type SectorSearchInput = { countryCode: string };

type SectorPayload = {
  sectors: Array<{
    sector_code: string;
    share_pct: number;
    confidence_grade?: string;
    source_ref?: string;
  }>;
};

export async function searchSectors(input: SectorSearchInput): Promise<{
  data: SectorPayload;
  citations: CorpusCitation[];
  tier: string;
  notes?: string[];
} | null> {
  const ctx = await buildCountryContext(supabaseAdmin, input.countryCode);
  const result = await runWithFallbacks<SectorPayload>({
    context: ctx,
    topic: `${ctx.name} GDP composition by sector`,
    perplexity: {
      model: "sonar-reasoning-pro",
      system: `You are an economist. Return the ${ctx.name} GDP composition by sector as share percentages that sum to ~100. Use standard 3-letter sector codes: AGR, MIN, MAN, CON, ENE, RET, TRA, FIN, ICT, TOU, EDU, HEA, PUB, CRE, BLU. Prefer World Bank, IMF WEO, and national statistics office. Return ONLY JSON.`,
      user: `Provide the latest GDP composition (value-added share of GDP, %) by sector for ${ctx.name}. Cite one authoritative source URL.`,
      recency: "year",
      responseSchema: {
        type: "object",
        properties: {
          sectors: {
            type: "array",
            items: {
              type: "object",
              properties: {
                sector_code: { type: "string" },
                share_pct: { type: "number" },
                confidence_grade: { type: "string" },
                source_ref: { type: "string" },
              },
              required: ["sector_code", "share_pct"],
            },
          },
        },
        required: ["sectors"],
      },
    },
    gemini: {
      system: `Repair the JSON. Sector shares should sum to ~100 (±10). Every sector needs a 3-letter code and a positive share_pct.`,
      user: `Extract GDP composition by sector for ${ctx.name}.`,
      schemaHint: `{"sectors":[{"sector_code":"AGR","share_pct":12.3,"confidence_grade":"B","source_ref":"https://..."}]}`,
    },
    parse: jsonParser<SectorPayload>(),
    validate: (v) => !!v?.sectors?.length && v.sectors.every((s) => s.share_pct > 0),
    infer: () => ({ sectors: [] }),
  });

  if (!result.data.sectors.length) return null;

  const citations: CorpusCitation[] = result.citations.map((c) => ({ url: c.url, title: c.title }));
  return { data: result.data, citations, tier: result.tier, notes: result.notes };
}
