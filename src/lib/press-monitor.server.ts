// Server-only helpers for Chamber 05 press monitoring.
// Imported by /api/public/hooks/press-tick and press-monitor.functions.ts (inside handlers).
import { createHash } from "crypto";

export type Scope = "local" | "regional" | "international";
export type FeedKind = "rss" | "json" | "gdelt" | "google_news" | "html";

export interface RawItem {
  guid_hash: string;
  url: string | null;
  title: string;
  published_at: string | null;
  raw_excerpt: string | null;
}

// ─── URL / title canonicalization + dedup key ────────────────────────────────

export function canonicalUrl(u: string | null | undefined): string {
  if (!u) return "";
  try {
    const url = new URL(u);
    // Strip tracking params
    for (const k of Array.from(url.searchParams.keys())) {
      if (/^(utm_|fbclid|gclid|mc_|_hs|ref|source)/i.test(k)) url.searchParams.delete(k);
    }
    url.hash = "";
    return `${url.protocol}//${url.host.toLowerCase()}${url.pathname}${url.searchParams.toString() ? "?" + url.searchParams.toString() : ""}`;
  } catch {
    return u;
  }
}
export function normalizeTitle(t: string | null | undefined): string {
  return (t ?? "").replace(/\s+/g, " ").trim().toLowerCase();
}
export function guidHash(url: string | null | undefined, title: string | null | undefined): string {
  return createHash("sha256").update(`${canonicalUrl(url)}::${normalizeTitle(title)}`).digest("hex").slice(0, 32);
}

// ─── Fetcher with ETag + timeout ─────────────────────────────────────────────

async function fetchWithTimeout(url: string, init: RequestInit = {}, ms = 15_000): Promise<Response> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ac.signal, redirect: "follow" });
  } finally {
    clearTimeout(t);
  }
}

// ─── Parsers ─────────────────────────────────────────────────────────────────

function stripHtml(s: string | null | undefined): string {
  return (s ?? "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}
function pick(xml: string, tag: string): string | null {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  const m = xml.match(re);
  if (!m) return null;
  const v = m[1].replace(/^<!\[CDATA\[/, "").replace(/\]\]>$/, "");
  return v.trim() || null;
}

export function parseRSS(xml: string, limit = 40): RawItem[] {
  const items: RawItem[] = [];
  const re = /<(item|entry)[^>]*>([\s\S]*?)<\/\1>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) && items.length < limit) {
    const body = m[2];
    const title = pick(body, "title") ?? "";
    let url =
      pick(body, "link") ??
      (body.match(/<link[^>]*href="([^"]+)"/i)?.[1] ?? null);
    if (url && /^<!\[CDATA/.test(url)) url = url.replace(/<!\[CDATA\[|\]\]>/g, "").trim();
    const pub = pick(body, "pubDate") ?? pick(body, "updated") ?? pick(body, "published");
    const desc = stripHtml(pick(body, "description") ?? pick(body, "summary") ?? pick(body, "content"));
    if (!title) continue;
    let publishedAt: string | null = null;
    if (pub) {
      const d = new Date(pub);
      publishedAt = isNaN(d.getTime()) ? null : d.toISOString();
    }
    items.push({
      guid_hash: guidHash(url, title),
      url: url ?? null,
      title: stripHtml(title).slice(0, 500),
      published_at: publishedAt,
      raw_excerpt: desc ? desc.slice(0, 1200) : null,
    });
  }
  return items;
}

export function parseJsonFeed(text: string, limit = 40): RawItem[] {
  const j = JSON.parse(text);
  const list = Array.isArray(j?.items) ? j.items : Array.isArray(j) ? j : [];
  return list.slice(0, limit).map((it: Record<string, unknown>) => {
    const url = String(it.url ?? it.link ?? "") || null;
    const title = String(it.title ?? it.headline ?? "");
    const pub = it.date_published ?? it.pubDate ?? it.published ?? null;
    const excerpt = stripHtml(String(it.summary ?? it.content_text ?? it.description ?? ""));
    return {
      guid_hash: guidHash(url, title),
      url,
      title: title.slice(0, 500),
      published_at: pub ? new Date(String(pub)).toISOString() : null,
      raw_excerpt: excerpt ? excerpt.slice(0, 1200) : null,
    };
  }).filter((r: RawItem) => r.title);
}

export function parseGDELT(text: string, limit = 40): RawItem[] {
  const j = JSON.parse(text);
  const arts = Array.isArray(j?.articles) ? j.articles : [];
  return arts.slice(0, limit).map((a: Record<string, string>) => {
    const url = a.url ?? null;
    const title = a.title ?? "";
    let publishedAt: string | null = null;
    if (a.seendate) {
      // GDELT format: 20260118T143000Z
      const s = a.seendate;
      if (s.length >= 15) {
        publishedAt = `${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}T${s.slice(9,11)}:${s.slice(11,13)}:${s.slice(13,15)}Z`;
      }
    }
    return {
      guid_hash: guidHash(url, title),
      url,
      title: title.slice(0, 500),
      published_at: publishedAt,
      raw_excerpt: a.domain ? `Source: ${a.domain}` : null,
    };
  }).filter((r: RawItem) => r.title);
}

// ─── Feed fetch dispatch ─────────────────────────────────────────────────────

export interface FeedRow {
  id: string;
  country_code: string;
  scope: Scope;
  kind: FeedKind;
  endpoint: string;
  etag: string | null;
  active: boolean;
  consecutive_failures: number;
}

export interface FetchResult {
  status: "ok" | "not_modified" | "error";
  items: RawItem[];
  etag?: string | null;
  error?: string;
}

export async function fetchFeed(feed: FeedRow): Promise<FetchResult> {
  try {
    const headers: Record<string, string> = { "User-Agent": "GDPVision-PressMonitor/1.0 (+https://gdpvision.com)" };
    if (feed.etag) headers["If-None-Match"] = feed.etag;
    const res = await fetchWithTimeout(feed.endpoint, { headers });
    if (res.status === 304) return { status: "not_modified", items: [] };
    if (!res.ok) return { status: "error", items: [], error: `HTTP ${res.status}` };
    const etag = res.headers.get("etag");
    const text = await res.text();
    let items: RawItem[] = [];
    switch (feed.kind) {
      case "rss":
      case "google_news":
      case "html": // HTML kind: expects Firecrawl-scraped RSS-shaped or fallback to <a> extraction; treat as RSS if XML
        items = /<rss|<feed|<item/i.test(text) ? parseRSS(text) : [];
        break;
      case "json":
        items = parseJsonFeed(text);
        break;
      case "gdelt":
        items = parseGDELT(text);
        break;
    }
    return { status: "ok", items, etag };
  } catch (e) {
    return { status: "error", items: [], error: (e as Error).message };
  }
}

// ─── Classifier (Perplexity sonar-pro) — shared with narrative-chamber ──────

export interface Classification {
  scope: Scope;
  sector_code: string;
  severity: number;
  reach: number;
  sentiment: number;
  topic: string;
  summary: string;
  dossier_bullets: string[];
  recommendation: "lead" | "amplify" | "counter" | "monitor" | "ignore";
  rationale: string;
  citations?: string[];
}

export async function classifySignal(input: {
  countryCode: string;
  url?: string | null;
  raw?: string | null;
  sectorMenu: string[];
  hintSectorCode?: string | null;
}): Promise<Classification> {
  const key = process.env.PERPLEXITY_API_KEY;
  if (!key) throw new Error("PERPLEXITY_API_KEY not configured");
  const userPrompt = [
    `Country: ${input.countryCode}`,
    input.url ? `URL: ${input.url}` : "",
    input.raw ? `Raw signal:\n${input.raw}` : "",
    `Available sector codes: ${input.sectorMenu.join(", ") || "cross"}`,
    input.hintSectorCode ? `Hint sector_code: ${input.hintSectorCode}` : "",
    "",
    "Return strict JSON: scope (local|regional|international), sector_code, severity 1-5, reach 1-5,",
    "sentiment -2..+2, topic (≤90 chars), summary (2 sentences), dossier_bullets (4 crisp bullets),",
    "recommendation (lead|amplify|counter|monitor|ignore), rationale (1 sentence).",
  ].filter(Boolean).join("\n");
  const schema = {
    type: "object",
    properties: {
      scope: { type: "string" }, sector_code: { type: "string" },
      severity: { type: "number" }, reach: { type: "number" }, sentiment: { type: "number" },
      topic: { type: "string" }, summary: { type: "string" },
      dossier_bullets: { type: "array", items: { type: "string" } },
      recommendation: { type: "string" }, rationale: { type: "string" },
    },
    required: ["scope","sector_code","severity","reach","sentiment","topic","summary","dossier_bullets","recommendation","rationale"],
  };
  const res = await fetchWithTimeout("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "sonar-pro",
      messages: [
        { role: "system", content: "You are a McKinsey-grade GDP narrative analyst. Return strict JSON only." },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_schema", json_schema: { name: "sig", schema } },
      temperature: 0.2,
    }),
  }, 25_000);
  if (!res.ok) {
    const body = await res.text();
    if (res.status === 401 && body.includes("insufficient_quota")) {
      throw new Error("Perplexity API credits exhausted.");
    }
    throw new Error(`classify ${res.status}: ${body.slice(0, 200)}`);
  }
  const j = await res.json();
  const content: string = j?.choices?.[0]?.message?.content ?? "";
  const citations: string[] = Array.isArray(j?.citations) ? j.citations : [];
  let parsed: Classification;
  try { parsed = JSON.parse(content); }
  catch {
    const m = content.match(/\{[\s\S]*\}/);
    if (!m) throw new Error("classifier returned no JSON");
    parsed = JSON.parse(m[0]);
  }
  parsed.citations = citations;
  return parsed;
}

// ─── Concurrency helper ──────────────────────────────────────────────────────

export async function pMap<T, R>(
  arr: T[],
  fn: (item: T) => Promise<R>,
  concurrency = 6,
): Promise<R[]> {
  const results: R[] = [];
  let i = 0;
  async function worker() {
    while (i < arr.length) {
      const idx = i++;
      results[idx] = await fn(arr[idx]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, arr.length) }, worker));
  return results;
}

// ─── Firecrawl deep-scrape upgrade (Layer 3) ─────────────────────────────────
// Fetches full-text markdown for a small batch of high-value items; failures are
// non-fatal — items fall back to their snippet.
export async function firecrawlUpgrade(url: string, timeoutMs = 20_000): Promise<string | null> {
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key || !url) return null;
  try {
    const res = await fetchWithTimeout(
      "https://api.firecrawl.dev/v2/scrape",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ url, formats: ["markdown"], onlyMainContent: true }),
      },
      timeoutMs,
    );
    if (!res.ok) return null;
    const body = (await res.json()) as { markdown?: string; data?: { markdown?: string } };
    const md = body.markdown ?? body.data?.markdown ?? null;
    return md ? md.slice(0, 6_000) : null;
  } catch {
    return null;
  }
}
