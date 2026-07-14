// Citation-domain external searcher.
// Given a country + topic, discovers authoritative source URLs and shapes
// them as CorpusCitation rows. Caller decides whether to attach them to a
// draft via `recordCitation` or persist as country_sources.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { buildCountryContext } from "@/lib/country-onboarding/country-context.server";
import { runWithFallbacks, jsonParser } from "@/lib/country-onboarding/fallback.server";
import type { CorpusCitation } from "../types";

export type CitationSearchInput = {
  countryCode: string;
  topic: string;
};

type CitationPayload = {
  citations: Array<{
    url: string;
    title?: string;
    org?: string;
    published_at?: string;
  }>;
};

export async function searchCitations(input: CitationSearchInput): Promise<{
  data: { rows: CorpusCitation[] };
  citations: CorpusCitation[];
  tier: string;
  notes?: string[];
} | null> {
  const ctx = await buildCountryContext(supabaseAdmin, input.countryCode);
  const result = await runWithFallbacks<CitationPayload>({
    context: ctx,
    topic: `authoritative sources for ${input.topic} in ${ctx.name}`,
    perplexity: {
      model: "sonar-pro",
      system: `You are a research librarian. Return ONLY JSON: 3–8 authoritative source URLs. Prefer official government (.${ctx.tld ?? "gov"}), World Bank, IMF, UN, and peer-reviewed publications.`,
      user: `Find authoritative sources about "${input.topic}" for ${ctx.name}. Each item needs a real https URL and a source org.`,
      recency: "year",
      responseSchema: {
        type: "object",
        properties: {
          citations: {
            type: "array",
            items: {
              type: "object",
              properties: {
                url: { type: "string" },
                title: { type: "string" },
                org: { type: "string" },
                published_at: { type: "string" },
              },
              required: ["url"],
            },
          },
        },
        required: ["citations"],
      },
    },
    gemini: {
      system: `Repair the JSON. Every citation needs a real https URL.`,
      user: `Find authoritative sources on ${input.topic} for ${ctx.name}.`,
      schemaHint: `{"citations":[{"url":"https://...","title":"...","org":"...","published_at":"YYYY"}]}`,
    },
    parse: jsonParser<CitationPayload>(),
    validate: (v) =>
      !!v?.citations?.length && v.citations.every((c) => /^https?:\/\//.test(c.url)),
    infer: () => ({ citations: [] }),
  });

  if (!result.data.citations.length) return null;

  const rows: CorpusCitation[] = result.data.citations.map((c) => ({
    url: c.url,
    title: c.title,
    org: c.org ?? null,
  }));

  return {
    data: { rows },
    citations: rows,
    tier: result.tier,
    notes: result.notes,
  };
}
