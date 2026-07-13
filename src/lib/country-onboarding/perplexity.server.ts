// Server-only Perplexity Sonar client.
// Used by the AI-first country onboarding agents. Never imported from the client.

export type SonarModel =
  | "sonar"
  | "sonar-pro"
  | "sonar-reasoning"
  | "sonar-reasoning-pro"
  | "sonar-deep-research";

export type SonarCitation = { url: string; title?: string; domain?: string };

export type SonarResult = {
  content: string;
  citations: SonarCitation[];
  raw: unknown;
};

const OFFICIAL_DOMAINS = [
  "worldbank.org",
  "imf.org",
  "un.org",
  "undp.org",
  "iadb.org",
  "eccb-centralbank.org",
  "cdb.org",
  "who.int",
  "fao.org",
  "oecs.int",
  "oecs.org",
  "caricom.org",
  "statisticsdata.com",
  "wikipedia.org",
];

function domainOf(u: string): string {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export async function callSonar(opts: {
  model: SonarModel;
  system: string;
  user: string;
  countryTld?: string; // e.g. "gov.lc" — added to the official domain allowlist
  recency?: "day" | "week" | "month" | "year";
  responseSchema?: Record<string, unknown>; // JSON schema for structured output
  maxTokens?: number;
  noDomainFilter?: boolean; // when true, do not restrict to the official allowlist
}): Promise<SonarResult> {
  const key = process.env.PERPLEXITY_API_KEY;
  if (!key) throw new Error("PERPLEXITY_API_KEY not configured");

  const domainAllow = [...OFFICIAL_DOMAINS];
  if (opts.countryTld) domainAllow.push(opts.countryTld);

  const body: Record<string, unknown> = {
    model: opts.model,
    messages: [
      { role: "system", content: opts.system },
      { role: "user", content: opts.user },
    ],
  };
  if (!opts.noDomainFilter) body.search_domain_filter = domainAllow;
  if (opts.recency) body.search_recency_filter = opts.recency;
  if (opts.maxTokens) body.max_tokens = opts.maxTokens;
  if (opts.responseSchema) {
    body.response_format = {
      type: "json_schema",
      json_schema: { name: "structured", schema: opts.responseSchema },
    };
  }


  const doFetch = async (payload: Record<string, unknown>) => {
    const r = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    if (!r.ok) {
      const errText = await r.text();
      throw new Error(`Perplexity ${r.status}: ${errText.slice(0, 500)}`);
    }
    return (await r.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      citations?: string[];
      search_results?: Array<{ url: string; title?: string }>;
    };
  };

  let json = await doFetch(body);
  let content = json.choices?.[0]?.message?.content ?? "";

  // Durability: small-nation TLDs (e.g. .gov.ag) are not in OFFICIAL_DOMAINS,
  // so a strict allowlist search can return empty content. If that happens,
  // retry once without the filter before the caller's empty-guard throws.
  if (!content.trim() && !opts.noDomainFilter && body.search_domain_filter) {
    const retryBody = { ...body };
    delete retryBody.search_domain_filter;
    json = await doFetch(retryBody);
    content = json.choices?.[0]?.message?.content ?? "";
  }

  const rawCites: Array<{ url: string; title?: string }> = json.search_results
    ? json.search_results.map((r) => ({ url: r.url, title: r.title }))
    : (json.citations ?? []).map((u) => ({ url: u }));

  const citations: SonarCitation[] = rawCites.map((c) => ({
    url: c.url,
    title: c.title,
    domain: domainOf(c.url),
  }));

  return { content, citations, raw: json };
}

/** Best-effort JSON extraction from a Sonar response (handles code fences). */
export function parseSonarJson<T = unknown>(content: string): T | null {
  if (!content) return null;
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = (fenced?.[1] ?? content).trim();
  const firstBrace = raw.indexOf("{");
  const firstBracket = raw.indexOf("[");
  const start =
    firstBrace === -1 ? firstBracket : firstBracket === -1 ? firstBrace : Math.min(firstBrace, firstBracket);
  if (start === -1) return null;
  const candidate = raw.slice(start);
  try {
    return JSON.parse(candidate) as T;
  } catch {
    // Try trimming trailing junk
    for (let i = candidate.length; i > 0; i--) {
      try {
        return JSON.parse(candidate.slice(0, i)) as T;
      } catch {
        /* keep trimming */
      }
    }
    return null;
  }
}
