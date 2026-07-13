// Three-tier fallback orchestrator for onboarding agents.
//
// Tier 1: Perplexity Sonar (grounded, cited).
// Tier 2: Lovable AI Gateway — Gemini 2.5 Pro, then Gemini Flash, then gpt-5.5.
// Tier 3: Contextual inference from seed data — never throws.
//
// Every agent handler delegates to `runWithFallbacks` so a stage always resolves
// to a payload plus a `tier` label. UI never gets a hard failure.

import { callGeminiJson } from "./gemini.server";
import { callSonar, parseSonarJson, type SonarCitation, type SonarModel } from "./perplexity.server";

export type FallbackTier = "perplexity" | "gemini" | "inferred";

export type FallbackResult<T> = {
  data: T;
  tier: FallbackTier;
  content: string;
  citations: SonarCitation[];
  notes: string[];
  modelStack: Record<string, string>;
};

export type FallbackOptions<T> = {
  // Tier 1 config — the Sonar call. May be attempted twice: strict then no-filter.
  perplexity: {
    model: SonarModel;
    system: string;
    user: string;
    responseSchema?: Record<string, unknown>;
    recency?: "day" | "week" | "month" | "year";
  };
  // Tier 2 config — natural-language shape for Gemini.
  gemini: {
    system: string;
    user: string;
    schemaHint: string;
  };
  // Parses raw model content into T. Returns null if unusable.
  parse: (content: string) => T | null;
  // Validates a parsed T is non-empty enough to accept.
  validate: (value: T) => boolean;
  // Tier 3 — must not throw. Returns provisional but structurally-valid data.
  infer: () => T;
};

export async function runWithFallbacks<T>(opts: FallbackOptions<T>): Promise<FallbackResult<T>> {
  const notes: string[] = [];
  const modelStack: Record<string, string> = {};
  let lastContent = "";
  let citations: SonarCitation[] = [];

  // ---------- Tier 1: Perplexity ----------
  const attempts: Array<{ label: string; args: Parameters<typeof callSonar>[0] }> = [
    {
      label: "sonar-strict",
      args: { ...opts.perplexity },
    },
    {
      label: "sonar-open",
      args: { ...opts.perplexity, noDomainFilter: true },
    },
    {
      label: "sonar-pro-open",
      args: { ...opts.perplexity, model: "sonar-pro", noDomainFilter: true, recency: "year" },
    },
  ];

  for (const attempt of attempts) {
    try {
      const res = await callSonar(attempt.args);
      lastContent = res.content;
      if (res.citations.length) citations = res.citations;
      const parsed = opts.parse(res.content);
      if (parsed && opts.validate(parsed)) {
        modelStack.perplexity = attempt.args.model;
        modelStack.tier = "perplexity";
        notes.push(`Perplexity ${attempt.label} succeeded (${res.citations.length} citations).`);
        return { data: parsed, tier: "perplexity", content: res.content, citations: res.citations, notes, modelStack };
      }
      notes.push(`Perplexity ${attempt.label} returned no usable payload.`);
    } catch (err) {
      notes.push(`Perplexity ${attempt.label} threw: ${(err as Error).message.slice(0, 200)}`);
    }
  }

  // ---------- Tier 2: Gemini via Lovable AI Gateway ----------
  try {
    const gem = await callGeminiJson<any>({
      system: opts.gemini.system,
      user: opts.gemini.user,
      schemaHint: opts.gemini.schemaHint,
      partial: lastContent,
    });
    if (gem.parsed) {
      const parsed = opts.parse(JSON.stringify(gem.parsed)) ?? (gem.parsed as T);
      if (parsed && opts.validate(parsed as T)) {
        modelStack.gemini = gem.model;
        modelStack.tier = "gemini";
        notes.push(`Gemini fallback (${gem.model}) succeeded.`);
        return { data: parsed as T, tier: "gemini", content: gem.content, citations, notes, modelStack };
      }
      notes.push(`Gemini fallback returned unusable payload.`);
    } else {
      notes.push(`Gemini fallback returned no parseable JSON: ${gem.content.slice(0, 200)}`);
    }
  } catch (err) {
    notes.push(`Gemini fallback threw: ${(err as Error).message.slice(0, 200)}`);
  }

  // ---------- Tier 3: Contextual inference ----------
  const inferred = opts.infer();
  modelStack.tier = "inferred";
  notes.push("All model tiers exhausted — used contextual inference (provisional).");
  return { data: inferred, tier: "inferred", content: "", citations, notes, modelStack };
}

// Convenience: a parse function that pulls JSON from raw model text.
export function jsonParser<T>(): (content: string) => T | null {
  return (c) => parseSonarJson<T>(c);
}
