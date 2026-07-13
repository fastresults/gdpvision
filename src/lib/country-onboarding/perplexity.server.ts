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
  "wikipedia.org",
];

function domainOf(u: string): string {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function normalizeDomain(raw: string): string | null {
  const s = String(raw ?? "").trim().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
  if (!s || !s.includes(".")) return null;
  return s.toLowerCase();
}

export async function callSonar(opts: {
  model: SonarModel;
  system: string;
  user: string;
  countryTld?: string;                 // e.g. "gov.lc" — added to the allowlist
  extraDomains?: string[];             // context-derived domains (national stats office, portal, central bank)
  recency?: "day" | "week" | "month" | "year";
  responseSchema?: Record<string, unknown>;
  maxTokens?: number;
  noDomainFilter?: boolean;
}): Promise<SonarResult> {
  const key = process.env.PERPLEXITY_API_KEY;
  if (!key) throw new Error("PERPLEXITY_API_KEY not configured");

  const domainAllow: string[] = [];
  const pushDomain = (d: string | null | undefined) => {
    const normalized = d ? normalizeDomain(d) : null;
    if (normalized && !domainAllow.includes(normalized)) domainAllow.push(normalized);
  };
  for (const d of OFFICIAL_DOMAINS) pushDomain(d);
  if (opts.countryTld) pushDomain(opts.countryTld);
  if (opts.extraDomains?.length) {
    for (const d of opts.extraDomains) pushDomain(d);
  }
  const boundedDomainAllow = domainAllow.slice(0, 20);

  const body: Record<string, unknown> = {
    model: opts.model,
    messages: [
      { role: "system", content: opts.system },
      { role: "user", content: opts.user },
    ],
  };
  if (!opts.noDomainFilter) body.search_domain_filter = boundedDomainAllow;
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

  let json;
  try {
    json = await doFetch(body);
  } catch (err) {
    // Perplexity enforces a hard max on domain filters. If a learned-domain
    // allowlist still trips provider validation, retry once open-web instead
    // of failing the whole onboarding stage.
    if (!opts.noDomainFilter && /search domain filter|domain_filter|max length/i.test((err as Error).message)) {
      const retryBody = { ...body };
      delete retryBody.search_domain_filter;
      json = await doFetch(retryBody);
    } else {
      throw err;
    }
  }
  let content = json.choices?.[0]?.message?.content ?? "";

  // Small-nation TLDs sometimes miss; retry without filter if content is empty.
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

/**
 * Cheap "discovery" pass — no schema, plain text. Returns candidate URLs the
 * extraction pass can use to widen the domain allowlist. Never throws; returns
 * empty on failure.
 */
export async function discoverOfficialUrls(opts: {
  countryName: string;
  countryTld?: string;
  topic: string; // "cabinet ministries", "national accounts by sector", "GDP", etc.
}): Promise<string[]> {
  try {
    const res = await callSonar({
      model: "sonar",
      system:
        "You find official primary-source URLs. Return ONLY a JSON array of up to 5 URL strings, no prose, no code fences. Prefer government (.gov.xx), national statistics offices, central banks, and multilateral portals (World Bank, IMF, UN).",
      user: `Find the best primary-source URLs for: ${opts.topic} — ${opts.countryName}${opts.countryTld ? ` (national TLD .${opts.countryTld})` : ""}. Return a JSON array of URLs.`,
      countryTld: opts.countryTld,
      noDomainFilter: true, // discovery must be wide-open
      recency: "year",
    });
    const arr = parseSonarJson<string[]>(res.content);
    if (Array.isArray(arr)) return arr.filter((u) => typeof u === "string" && u.startsWith("http")).slice(0, 5);
  } catch {
    /* discovery is best-effort */
  }
  return [];
}

/**
 * Fetch the raw text of a citation URL. Uses a plain fetch with a short
 * timeout and strips HTML to feed Gemini as grounding. Best-effort — returns
 * empty on any failure. Capped at ~8kb per URL to keep prompts small.
 */
export async function fetchCitationText(url: string, maxChars = 8000): Promise<string> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 6000);
    const r = await fetch(url, { signal: ctrl.signal, headers: { "user-agent": "Mozilla/5.0 GDPVisionBot" } });
    clearTimeout(t);
    if (!r.ok) return "";
    const html = await r.text();
    // Very rough HTML strip — enough for LLM grounding.
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return text.slice(0, maxChars);
  } catch {
    return "";
  }
}
