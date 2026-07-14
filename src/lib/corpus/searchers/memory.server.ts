// Memory-domain external searcher.
// Runs the standard onboarding fallback waterfall (Perplexity → Gemini repair
// → inference) scoped to a country/sector to find memory-worthy facts when the
// corpus is empty. Returns rows shaped for `upsertMemoryObject`.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { buildCountryContext } from "@/lib/country-onboarding/country-context.server";
import { runWithFallbacks, jsonParser } from "@/lib/country-onboarding/fallback.server";
import type { CorpusCitation } from "../types";
import type { MemoryObjectInput } from "../writers.server";

export type MemorySearchInput = {
  countryCode: string;
  sector?: string;
  /** The user question or topic that motivated the search. */
  question?: string;
};

type MemoryPayload = {
  items: Array<{
    title: string;
    kind?: string;
    weight?: number;
    summary?: string;
    facts?: unknown;
    source_url?: string;
  }>;
};

export async function searchMemory(input: MemorySearchInput): Promise<{
  data: { rows: MemoryObjectInput[] };
  citations: CorpusCitation[];
  tier: string;
  notes?: string[];
} | null> {
  const ctx = await buildCountryContext(supabaseAdmin, input.countryCode);
  const topic = input.question
    ? `evidence for: ${input.question}`
    : input.sector
    ? `${input.sector} sector evidence`
    : `key ${ctx.name} facts for policy briefing`;

  const result = await runWithFallbacks<MemoryPayload>({
    context: ctx,
    topic,
    perplexity: {
      model: "sonar-pro",
      system: `You are a research analyst compiling evidence about ${ctx.name}. Return ONLY a JSON object matching the schema; every item must cite a real source URL.`,
      user: `Find 3-6 concrete, recent, source-backed facts relevant to: ${topic}. ${input.sector ? `Focus on sector: ${input.sector}.` : ""} Prefer official (.gov.${ctx.tld ?? ""}, worldbank.org, imf.org, un.org) sources.`,
      recency: "year",
      responseSchema: {
        type: "object",
        properties: {
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                kind: { type: "string" },
                weight: { type: "number" },
                summary: { type: "string" },
                facts: {},
                source_url: { type: "string" },
              },
              required: ["title", "summary", "source_url"],
            },
          },
        },
        required: ["items"],
      },
    },
    gemini: {
      system: `Repair the JSON. Every item MUST have a real https URL in source_url.`,
      user: `Extract 3-6 well-sourced facts relevant to: ${topic}.`,
      schemaHint: `{"items":[{"title":"...","kind":"...","weight":1..5,"summary":"...","facts":{},"source_url":"https://..."}]}`,
    },
    parse: jsonParser<MemoryPayload>(),
    validate: (v) =>
      !!v?.items?.length &&
      v.items.every((i) => !!i.title && !!i.summary && /^https?:\/\//.test(i.source_url ?? "")),
    infer: () => ({ items: [] }),
  });

  if (!result.data.items.length) return null;

  const citations: CorpusCitation[] = result.citations.map((c) => ({
    url: c.url,
    title: c.title,
  }));

  const rows: MemoryObjectInput[] = result.data.items.map((item) => ({
    scope_key: input.countryCode,
    kind: item.kind ?? "evidence",
    title: item.title.slice(0, 240),
    weight: Math.max(1, Math.min(5, Math.round(item.weight ?? 2))),
    sector_code: input.sector ?? "cross",
    payload: {
      summary: item.summary,
      facts: item.facts ?? null,
      source_url: item.source_url,
      fetched_at: new Date().toISOString(),
      tier: result.tier,
    },
  }));

  return {
    data: { rows },
    citations,
    tier: result.tier,
    notes: result.notes,
  };
}
