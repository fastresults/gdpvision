// Chamber 05 · source discovery (Layer 4).
// Ask Perplexity for outlets, probe RSS/atom endpoints, insert into narrative_feeds.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const CANDIDATE_PATHS = ["/feed", "/rss", "/rss.xml", "/atom.xml", "/feed/", "/index.xml", "/news/feed"];

type Suggestion = {
  scope: "local" | "regional" | "international";
  name: string;
  domain: string;
  rss?: string | null;
};

async function fetchWithTimeout(url: string, init: RequestInit = {}, ms = 12_000): Promise<Response> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), ms);
  try {
    return await fetch(url, {
      ...init,
      signal: ac.signal,
      redirect: "follow",
      headers: { "User-Agent": "GDPVision-PressDiscover/1.0", ...(init.headers ?? {}) },
    });
  } finally {
    clearTimeout(t);
  }
}

async function askPerplexity(countryName: string, countryCode: string): Promise<Suggestion[]> {
  const key = process.env.PERPLEXITY_API_KEY;
  if (!key) throw new Error("PERPLEXITY_API_KEY not configured");
  const prompt = `List up to 20 news outlets covering ${countryName} (${countryCode}) economy, politics, business, and government affairs.
Include the national newspaper of record, government press office, central bank, top private outlets,
and any regional wires that consistently cover this country.

Return STRICT JSON array only, each item:
{"scope":"local|regional|international","name":"Outlet name","domain":"example.com","rss":"https://... or null"}`;
  const res = await fetchWithTimeout(
    "https://api.perplexity.ai/chat/completions",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "sonar-pro",
        messages: [
          { role: "system", content: "You return strict JSON arrays only. No prose." },
          { role: "user", content: prompt },
        ],
        temperature: 0.1,
      }),
    },
    25_000,
  );
  if (!res.ok) throw new Error(`perplexity ${res.status}`);
  const j = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = j.choices?.[0]?.message?.content ?? "";
  const m = content.match(/\[[\s\S]*\]/);
  if (!m) return [];
  try {
    const arr = JSON.parse(m[0]) as unknown[];
    return arr.filter((x): x is Suggestion => {
      const s = x as Suggestion;
      return !!s && typeof s.domain === "string" && !!s.domain && ["local", "regional", "international"].includes(s.scope);
    });
  } catch {
    return [];
  }
}

async function firecrawlMap(domain: string): Promise<string[]> {
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key) return [];
  try {
    const res = await fetchWithTimeout(
      "https://api.firecrawl.dev/v2/map",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ url: `https://${domain}`, search: "rss feed", limit: 40 }),
      },
      20_000,
    );
    if (!res.ok) return [];
    const body = (await res.json()) as { links?: string[]; data?: { links?: string[] } };
    return body.links ?? body.data?.links ?? [];
  } catch {
    return [];
  }
}

async function probeRss(url: string): Promise<boolean> {
  try {
    const r = await fetchWithTimeout(url, {}, 8_000);
    if (!r.ok) return false;
    const text = (await r.text()).slice(0, 4_000);
    return /<rss|<feed|<item|<entry/i.test(text);
  } catch {
    return false;
  }
}

async function resolveFeedFor(suggestion: Suggestion): Promise<string | null> {
  if (suggestion.rss) {
    if (await probeRss(suggestion.rss)) return suggestion.rss;
  }
  // Try well-known paths on the domain
  for (const p of CANDIDATE_PATHS) {
    const url = `https://${suggestion.domain}${p}`;
    if (await probeRss(url)) return url;
  }
  // Fallback: firecrawl map for links containing feed/rss
  const links = await firecrawlMap(suggestion.domain);
  for (const l of links) {
    if (!/feed|rss|atom/i.test(l)) continue;
    if (await probeRss(l)) return l;
  }
  return null;
}

export async function discoverForCountry(countryCode: string, countryName: string) {
  const suggestions = await askPerplexity(countryName, countryCode);
  const results: Array<{ suggestion: Suggestion; rss: string | null; inserted: boolean }> = [];
  const { data: existing } = await supabaseAdmin
    .from("narrative_feeds")
    .select("endpoint")
    .eq("country_code", countryCode);
  const seen = new Set((existing ?? []).map((r) => r.endpoint));

  for (const s of suggestions) {
    const rss = await resolveFeedFor(s);
    if (!rss || seen.has(rss)) {
      results.push({ suggestion: s, rss, inserted: false });
      continue;
    }
    const { error } = await supabaseAdmin.from("narrative_feeds").insert({
      country_code: countryCode,
      scope: s.scope,
      kind: "rss",
      endpoint: rss,
      label: `${s.name} (auto-discovered)`,
      is_seed: false,
      is_query: false,
      tier_hint: s.scope,
      discovered_at: new Date().toISOString(),
      active: true,
    });
    seen.add(rss);
    results.push({ suggestion: s, rss, inserted: !error });
  }
  return {
    country_code: countryCode,
    suggested: suggestions.length,
    inserted: results.filter((r) => r.inserted).length,
    results,
  };
}

export async function discoverAllCountries() {
  const { data: countries } = await supabaseAdmin
    .from("countries")
    .select("code,name")
    .order("code");
  const out: Array<{ code: string; suggested: number; inserted: number }> = [];
  for (const c of countries ?? []) {
    try {
      const r = await discoverForCountry(c.code as string, (c.name as string) ?? c.code);
      out.push({ code: c.code as string, suggested: r.suggested, inserted: r.inserted });
    } catch (e) {
      out.push({ code: c.code as string, suggested: 0, inserted: 0 });
      console.error("[press-discover]", c.code, (e as Error).message);
    }
  }
  return out;
}
