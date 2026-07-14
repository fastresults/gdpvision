// Ministry-domain external searcher.
// Given a country + ministry_slug, returns the current minister profile,
// mandate summary, and programme list, shaped for `upsertMinistryProfile`.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { buildCountryContext } from "@/lib/country-onboarding/country-context.server";
import { runWithFallbacks, jsonParser } from "@/lib/country-onboarding/fallback.server";
import type { CorpusCitation } from "../types";

export type MinistrySearchInput = {
  countryCode: string;
  ministrySlug: string;
  ministryName?: string;
};

type MinistryPayload = {
  minister: string | null;
  minister_profile: {
    name?: string;
    party?: string;
    bio?: string;
    education?: string;
    career?: string;
    portrait_url?: string;
    socials?: Record<string, string>;
    contact?: Record<string, string>;
  };
  mandate: string;
  programmes: Array<{ name: string; summary: string; status?: string; source_url?: string }>;
};

export async function searchMinistry(input: MinistrySearchInput): Promise<{
  data: MinistryPayload;
  citations: CorpusCitation[];
  tier: string;
  notes?: string[];
} | null> {
  const ctx = await buildCountryContext(supabaseAdmin, input.countryCode);
  const name = input.ministryName ?? input.ministrySlug;
  const result = await runWithFallbacks<MinistryPayload>({
    context: ctx,
    topic: `${ctx.name} ${name} — current minister + mandate`,
    perplexity: {
      model: "sonar-pro",
      system: `You are a government-relations analyst. Return ONLY JSON. The minister field is the CURRENT sitting minister's full name; if there is a vacancy or acting minister, note that. Prefer official gov sites (.${ctx.tld ?? "gov"}) and reputable news.`,
      user: `Find the current Minister and mandate of the "${name}" in ${ctx.name}. Include 3–6 flagship programmes with a one-sentence summary and status.`,
      recency: "month",
      responseSchema: {
        type: "object",
        properties: {
          minister: { type: ["string", "null"] },
          minister_profile: { type: "object" },
          mandate: { type: "string" },
          programmes: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                summary: { type: "string" },
                status: { type: "string" },
                source_url: { type: "string" },
              },
              required: ["name", "summary"],
            },
          },
        },
        required: ["mandate", "programmes"],
      },
    },
    gemini: {
      system: `Repair the JSON. Minister names must be full names (not "The Honourable" alone). Programmes need real URLs where possible.`,
      user: `Extract current Minister and programme list for ${name}, ${ctx.name}.`,
      schemaHint: `{"minister":"...","minister_profile":{"name":"...","party":"...","bio":"..."},"mandate":"...","programmes":[{"name":"...","summary":"...","status":"...","source_url":"https://..."}]}`,
    },
    parse: jsonParser<MinistryPayload>(),
    validate: (v) => !!v && !!v.mandate && Array.isArray(v.programmes),
    infer: () => ({
      minister: null,
      minister_profile: {},
      mandate: "",
      programmes: [],
    }),
  });

  if (!result.data.mandate && !result.data.programmes.length) return null;

  const citations: CorpusCitation[] = result.citations.map((c) => ({ url: c.url, title: c.title }));
  return { data: result.data, citations, tier: result.tier, notes: result.notes };
}
