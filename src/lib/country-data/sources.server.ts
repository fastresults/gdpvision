// Server-only helpers for country_sources — dedupe rule, canonical KPI providers,
// AI-generated summaries. Every write path for country_sources should route
// through upsertCountrySource() so no duplicates ever land in the table.

export type SourceKind =
  | "gov"
  | "regional"
  | "multilateral"
  | "advisory"
  | "ngo"
  | "media"
  | "summit"
  | "kpi_source"
  | "document"
  | "api"
  | "mcp";

export type ConnectionKind = "link" | "document" | "api" | "mcp";

// Canonical KPI providers — one row per (country, org). Any KPI research URL
// that hits these hostnames collapses onto the canonical row.
const KPI_PROVIDERS: Array<{
  match: (host: string) => boolean;
  org: string;
  title: string;
  canonicalUrl: (code: string) => string;
  quality: number;
}> = [
  {
    match: (h) => h.includes("worldbank.org"),
    org: "World Bank",
    title: "World Bank — data portal",
    canonicalUrl: (c) => `https://data.worldbank.org/country/${c}`,
    quality: 5,
  },
  {
    match: (h) => h.includes("imf.org"),
    org: "IMF",
    title: "IMF — country data",
    canonicalUrl: (c) => `https://www.imf.org/en/countries/${c}`,
    quality: 5,
  },
  {
    match: (h) => h.includes("undp.org") || h.includes("hdr.undp.org"),
    org: "UNDP",
    title: "UNDP — Human Development",
    canonicalUrl: () => `https://hdr.undp.org/data-center/country-insights`,
    quality: 5,
  },
  {
    match: (h) => h.includes("who.int"),
    org: "WHO",
    title: "WHO — country data",
    canonicalUrl: () => `https://data.who.int/countries`,
    quality: 5,
  },
  {
    match: (h) => h.includes("ilo.org") || h.includes("ilostat"),
    org: "ILO",
    title: "ILO — ILOSTAT country profiles",
    canonicalUrl: () => `https://ilostat.ilo.org/data/country-profiles/`,
    quality: 5,
  },
  {
    match: (h) => h.includes("un.org") || h.includes("data.un.org"),
    org: "UN",
    title: "UN — country data",
    canonicalUrl: () => `https://data.un.org/`,
    quality: 4,
  },
];

export function normalizeUrl(raw: string): string {
  try {
    const u = new URL(raw.trim());
    const host = u.hostname.toLowerCase().replace(/^www\./, "");
    const path = u.pathname.replace(/\/+$/, "").toLowerCase();
    return `${host}${path}`;
  } catch {
    return raw.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/+$/, "");
  }
}

export function hostOf(raw: string): string | null {
  try {
    return new URL(raw).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/** Resolve a raw KPI research URL to its canonical (country, org) source row. */
export function resolveKpiProvider(countryCode: string, url: string):
  | { org: string; title: string; canonicalUrl: string; quality: number }
  | null {
  const host = hostOf(url);
  if (!host) return null;
  for (const p of KPI_PROVIDERS) {
    if (p.match(host)) {
      return {
        org: p.org,
        title: p.title,
        canonicalUrl: p.canonicalUrl(countryCode),
        quality: p.quality,
      };
    }
  }
  return null;
}

export type Visibility = "public" | "private";

export type UpsertSourceRow = {
  country_code: string;
  url: string;
  title: string;
  org: string;
  kind: SourceKind | string;
  quality_score?: number;
  active?: boolean;
  tags?: string[];
  connection_kind?: ConnectionKind;
  storage_path?: string | null;
  created_by?: string | null;
  visibility?: Visibility;
  owner_country_code?: string | null;
  uploaded_by?: string | null;
};

type DbErrorLike = { message?: string; code?: string; details?: string | null; hint?: string | null };

function dbErrorMessage(error: DbErrorLike): string {
  return [error.message, error.code ? `code=${error.code}` : null, error.details, error.hint]
    .filter(Boolean)
    .join(" · ");
}

function assertDbOk(result: { error?: DbErrorLike | null }, label: string): void {
  if (result.error) throw new Error(`${label} failed: ${dbErrorMessage(result.error)}`);
}

/**
 * Canonical, dedupe-safe upsert for country_sources.
 * - Public and private rows are deduped independently (an admin can upload a
 *   private copy of a URL that also exists as a public shared source).
 * - For kind='kpi_source', collapses onto the (country, org, visibility) canonical row.
 * - Otherwise uses (country_code, url, visibility) as the dedupe key.
 * Returns { id, existed, visibility }.
 */
export async function upsertCountrySource(
  admin: any,
  input: UpsertSourceRow,
): Promise<{ id: string; existed: boolean; visibility: Visibility } | null> {
  let url = input.url;
  let org = input.org;
  let title = input.title;
  let quality = input.quality_score ?? 3;
  const visibility: Visibility = input.visibility === "private" ? "private" : "public";
  const ownerCountry = visibility === "private" ? (input.owner_country_code ?? input.country_code) : null;

  if (input.kind === "kpi_source") {
    const canon = resolveKpiProvider(input.country_code, input.url);
    if (canon) {
      org = canon.org;
      title = canon.title;
      url = canon.canonicalUrl;
      quality = Math.max(quality, canon.quality);
    }
    const { data: existing } = await admin
      .from("country_sources")
      .select("id")
      .eq("country_code", input.country_code)
      .eq("kind", "kpi_source")
      .eq("visibility", visibility)
      .ilike("org", org)
      .maybeSingle();
    if (existing?.id) {
      const res = await admin
        .from("country_sources")
        .update({ url, title, quality_score: quality, active: input.active ?? true })
        .eq("id", existing.id);
      assertDbOk(res, "update KPI country source");
      return { id: existing.id as string, existed: true, visibility };
    }
  } else {
    const { data: existing } = await admin
      .from("country_sources")
      .select("id")
      .eq("country_code", input.country_code)
      .eq("url", url)
      .eq("visibility", visibility)
      .maybeSingle();
    if (existing?.id) {
      const res = await admin
        .from("country_sources")
        .update({
          title,
          org,
          quality_score: quality,
          active: input.active ?? true,
          ...(input.tags ? { tags: input.tags } : {}),
        })
        .eq("id", existing.id);
      assertDbOk(res, "update country source");
      return { id: existing.id as string, existed: true, visibility };
    }
  }

  const tld = (() => {
    try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return null; }
  })();

  const { data: created, error } = await admin
    .from("country_sources")
    .insert({
      country_code: input.country_code,
      url,
      title,
      org,
      kind: input.kind,
      tld,
      tags: input.tags ?? [],
      quality_score: quality,
      active: input.active ?? true,
      connection_kind: input.connection_kind ?? "link",
      storage_path: input.storage_path ?? null,
      created_by: input.created_by ?? null,
      visibility,
      owner_country_code: ownerCountry,
      uploaded_by: visibility === "private" ? (input.uploaded_by ?? input.created_by ?? null) : null,
    })
    .select("id")
    .single();
  if (error) throw new Error(`insert country source failed: ${dbErrorMessage(error)}`);
  if (!created) throw new Error("insert country source failed: no row returned after write");
  return { id: created.id as string, existed: false, visibility };
}

/** Generate an AI summary of a source using Lovable AI Gateway + Gemini. */
export async function summarizeSourceWithAi(params: {
  title: string;
  org: string;
  url: string;
  kind: string;
  countryName: string;
  chunks: string[]; // top representative chunks (0-6)
}): Promise<{ summary: string; data_types: string[] } | null> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) return null;

  const context = params.chunks.length
    ? `\n\nRepresentative excerpts from the ingested content:\n${params.chunks
        .slice(0, 6)
        .map((c, i) => `[${i + 1}] ${c.slice(0, 700)}`)
        .join("\n\n")}`
    : "";

  const prompt = `You are cataloging a data source used by an AI agent that acts on behalf of the government of ${params.countryName}.
Source title: ${params.title}
Publisher/organization: ${params.org}
Kind: ${params.kind}
URL: ${params.url}${context}

Write a concise 2-4 sentence plain-English summary describing what this source is and what type of data or content it contributes. Then list 3-8 short tags describing the data types it provides (e.g. "GDP time series", "policy briefs", "tourism arrivals", "budget statements"). Return strict JSON only:
{"summary": "...", "data_types": ["...", "..."]}`;

  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": key,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You return strict JSON only. No prose, no markdown fences." },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    const raw = json?.choices?.[0]?.message?.content ?? "";
    const parsed = JSON.parse(raw);
    if (typeof parsed?.summary === "string") {
      return {
        summary: parsed.summary,
        data_types: Array.isArray(parsed.data_types)
          ? parsed.data_types.filter((t: unknown): t is string => typeof t === "string").slice(0, 12)
          : [],
      };
    }
  } catch {
    // fall through
  }
  return null;
}
