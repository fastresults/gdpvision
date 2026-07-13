// Three-tier fallback orchestrator for onboarding agents.
//
// Tier 1: Perplexity Sonar (grounded, cited). Runs a discovery pass to widen
//         the domain allowlist, then 3 extraction attempts with real validators.
// Tier 2: Lovable AI Gateway — Gemini 2.5 Pro/Flash/gpt-5.5 as a REPAIR tier:
//         fed Perplexity's raw partial output + country context + fetched
//         citation text, so it extracts rather than guesses blind.
// Tier 3: Contextual inference from seed data — never throws.

import { callGeminiJson } from "./gemini.server";
import {
  callSonar,
  discoverOfficialUrls,
  fetchCitationText,
  parseSonarJson,
  type SonarCitation,
  type SonarModel,
} from "./perplexity.server";
import { renderContextBlock, contextDomains, type CountryContext } from "./country-context.server";

export type FallbackTier = "perplexity" | "gemini" | "inferred";

export type FallbackResult<T> = {
  data: T;
  tier: FallbackTier;
  content: string;
  citations: SonarCitation[];
  notes: string[];
  modelStack: Record<string, string>;
  attempts: number;
  /** True when Tier 1 succeeded on an attempt that had no domain filter. */
  openWebWin: boolean;
  /** Label of the attempt that won (or last tried). */
  winningAttempt: string | null;
};

export type FallbackOptions<T> = {
  /** Country context block, forwarded to every tier. */
  context: CountryContext;
  /** Short topic label used by the Perplexity discovery pass ("cabinet ministries"). */
  topic: string;
  /** Tier 1 config. */
  perplexity: {
    model: SonarModel;
    system: string;
    user: string;
    responseSchema?: Record<string, unknown>;
    recency?: "day" | "week" | "month" | "year";
  };
  /** Tier 2 config. */
  gemini: {
    system: string;
    user: string;
    schemaHint: string;
  };
  parse: (content: string) => T | null;
  validate: (value: T) => boolean;
  infer: () => T;
};

export async function runWithFallbacks<T>(opts: FallbackOptions<T>): Promise<FallbackResult<T>> {
  const notes: string[] = [];
  const modelStack: Record<string, string> = {};
  const partials: string[] = [];
  let citations: SonarCitation[] = [];
  let attempts = 0;

  const contextBlock = renderContextBlock(opts.context);
  const baseExtra = contextDomains(opts.context);

  // ---------- Discovery pass (widens the allowlist) ----------
  let discovered: string[] = [];
  try {
    discovered = await discoverOfficialUrls({
      countryName: opts.context.name,
      countryTld: opts.context.tld ?? undefined,
      topic: opts.topic,
    });
    if (discovered.length) {
      const domains = discovered
        .map((u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; } })
        .filter(Boolean);
      notes.push(`Discovery pass found ${domains.length} candidate domains: ${domains.slice(0, 5).join(", ")}`);
      baseExtra.push(...domains);
    } else {
      notes.push("Discovery pass returned no URLs.");
    }
  } catch (err) {
    notes.push(`Discovery pass threw: ${(err as Error).message.slice(0, 160)}`);
  }

  // Prepend context to the extraction system prompt
  const enrichedSystem = `${opts.perplexity.system}\n\n${contextBlock}`;

  // ---------- Tier 1: Perplexity extraction attempts ----------
  const attemptsSpec: Array<{ label: string; args: Parameters<typeof callSonar>[0] }> = [
    {
      label: "sonar-strict+tld+discovered",
      args: {
        ...opts.perplexity,
        system: enrichedSystem,
        countryTld: opts.context.tld ?? undefined,
        extraDomains: baseExtra,
      },
    },
    {
      label: "sonar-open",
      args: { ...opts.perplexity, system: enrichedSystem, noDomainFilter: true },
    },
    {
      label: "sonar-pro-open+year",
      args: {
        ...opts.perplexity,
        system: enrichedSystem,
        model: "sonar-pro",
        noDomainFilter: true,
        recency: "year",
      },
    },
  ];

  for (const attempt of attemptsSpec) {
    attempts += 1;
    try {
      const res = await callSonar(attempt.args);
      if (res.content) partials.push(res.content);
      if (res.citations.length) citations = res.citations;
      const parsed = opts.parse(res.content);
      if (parsed && opts.validate(parsed)) {
        modelStack.perplexity = attempt.args.model;
        modelStack.tier = "perplexity";
        notes.push(`Perplexity ${attempt.label} succeeded (${res.citations.length} citations).`);
        return {
          data: parsed,
          tier: "perplexity",
          content: res.content,
          citations: res.citations,
          notes,
          modelStack,
          attempts,
        };
      }
      notes.push(`Perplexity ${attempt.label} returned no usable payload.`);
    } catch (err) {
      notes.push(`Perplexity ${attempt.label} threw: ${(err as Error).message.slice(0, 200)}`);
    }
  }

  // ---------- Tier 2: Gemini as REPAIR ----------
  // Fetch text from the top 2 citations so Gemini has real source material.
  let citationText = "";
  const topCites = citations.slice(0, 2);
  if (topCites.length) {
    const texts = await Promise.all(topCites.map((c) => fetchCitationText(c.url)));
    citationText = texts
      .map((t, i) => (t ? `--- SOURCE ${i + 1}: ${topCites[i].url} ---\n${t}` : ""))
      .filter(Boolean)
      .join("\n\n");
    notes.push(`Fetched ${texts.filter(Boolean).length}/${topCites.length} citation bodies for Gemini grounding.`);
  }

  try {
    attempts += 1;
    const gem = await callGeminiJson<any>({
      system: opts.gemini.system,
      user: opts.gemini.user,
      schemaHint: opts.gemini.schemaHint,
      partial: partials.join("\n\n---\n\n"),
      contextBlock,
      citationText,
    });
    if (gem.parsed) {
      const parsed = opts.parse(JSON.stringify(gem.parsed)) ?? (gem.parsed as T);
      if (parsed && opts.validate(parsed as T)) {
        modelStack.gemini = gem.model;
        modelStack.tier = "gemini";
        notes.push(`Gemini repair tier (${gem.model}) succeeded.`);
        return {
          data: parsed as T,
          tier: "gemini",
          content: gem.content,
          citations,
          notes,
          modelStack,
          attempts,
        };
      }
      notes.push(`Gemini repair tier returned unusable payload (failed validator).`);
    } else {
      notes.push(`Gemini repair tier returned no parseable JSON: ${gem.content.slice(0, 200)}`);
    }
  } catch (err) {
    notes.push(`Gemini repair tier threw: ${(err as Error).message.slice(0, 200)}`);
  }

  // ---------- Tier 3: Contextual inference ----------
  const inferred = opts.infer();
  modelStack.tier = "inferred";
  notes.push("All model tiers exhausted — used contextual inference (provisional).");
  return {
    data: inferred,
    tier: "inferred",
    content: partials.join("\n\n---\n\n"),
    citations,
    notes,
    modelStack,
    attempts,
  };
}

export function jsonParser<T>(): (content: string) => T | null {
  return (c) => parseSonarJson<T>(c);
}
