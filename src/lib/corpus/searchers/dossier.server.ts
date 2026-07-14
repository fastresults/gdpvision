// Sector-dossier external searcher.
// Given a country + sector, returns dossier facts (audience, position,
// statement, outlet, precedent) shaped for `upsertSectorDossier`.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { buildCountryContext } from "@/lib/country-onboarding/country-context.server";
import { runWithFallbacks, jsonParser } from "@/lib/country-onboarding/fallback.server";
import type { CorpusCitation } from "../types";

export type DossierSearchInput = {
  countryCode: string;
  sectorCode: string;
  kind?: string;
};

type DossierPayload = {
  headline: string;
  facts: Array<{ label: string; value: string; source_url?: string }>;
  positions: Array<{ audience: string; position: string; source_url?: string }>;
};

export async function searchDossier(input: DossierSearchInput): Promise<{
  data: { payload: DossierPayload; kind: string };
  citations: CorpusCitation[];
  tier: string;
  notes?: string[];
} | null> {
  const ctx = await buildCountryContext(supabaseAdmin, input.countryCode);
  const kind = input.kind ?? "brief";
  const result = await runWithFallbacks<DossierPayload>({
    context: ctx,
    topic: `${ctx.name} ${input.sectorCode} sector dossier`,
    perplexity: {
      model: "sonar-pro",
      system: `You are a policy researcher. Compile a briefing dossier for the ${input.sectorCode} sector in ${ctx.name}. Return ONLY JSON. Every fact and position needs a real https source_url.`,
      user: `Compile a ${kind} dossier for the ${input.sectorCode} sector in ${ctx.name}: headline situation, 4–6 concrete facts, 3–5 stakeholder positions.`,
      recency: "year",
      responseSchema: {
        type: "object",
        properties: {
          headline: { type: "string" },
          facts: {
            type: "array",
            items: {
              type: "object",
              properties: {
                label: { type: "string" },
                value: { type: "string" },
                source_url: { type: "string" },
              },
              required: ["label", "value"],
            },
          },
          positions: {
            type: "array",
            items: {
              type: "object",
              properties: {
                audience: { type: "string" },
                position: { type: "string" },
                source_url: { type: "string" },
              },
              required: ["audience", "position"],
            },
          },
        },
        required: ["headline", "facts"],
      },
    },
    gemini: {
      system: `Repair the JSON. Every fact needs a source_url that is a real https URL.`,
      user: `Compile ${input.sectorCode} dossier for ${ctx.name}.`,
      schemaHint: `{"headline":"...","facts":[{"label":"...","value":"...","source_url":"https://..."}],"positions":[{"audience":"...","position":"...","source_url":"https://..."}]}`,
    },
    parse: jsonParser<DossierPayload>(),
    validate: (v) => !!v?.headline && Array.isArray(v.facts) && v.facts.length > 0,
    infer: () => ({ headline: "", facts: [], positions: [] }),
  });

  if (!result.data.headline) return null;

  const citations: CorpusCitation[] = result.citations.map((c) => ({ url: c.url, title: c.title }));
  return {
    data: { payload: result.data, kind },
    citations,
    tier: result.tier,
    notes: result.notes,
  };
}
