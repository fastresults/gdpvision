// Server-only: whole-site reading for a data source.
// Each page becomes its own country_source_documents row, deduped on
// (country_source_id, page_key). Unchanged pages are skipped; changed pages
// replace their chunks. Re-runs are idempotent.

import { chunkText, embedBatch } from "@/lib/country-onboarding/ingest.server";

const FIRECRAWL_V2 = "https://api.firecrawl.dev/v2";
const TRACKING = /^(utm_|fbclid|gclid|mc_)/i;

export function normalizePageKey(raw: string): string {
  try {
    const u = new URL(raw);
    u.hash = "";
    u.hostname = u.hostname.toLowerCase().replace(/^www\./, "");
    for (const k of [...u.searchParams.keys()]) if (TRACKING.test(k)) u.searchParams.delete(k);
    let s = `${u.protocol}//${u.hostname}${u.port ? ":" + u.port : ""}${u.pathname}${u.search}`;
    s = s.replace(/\/+$/, "");
    return s.toLowerCase();
  } catch {
    return raw.trim().toLowerCase().replace(/#.*$/, "").replace(/\/+$/, "");
  }
}

export function sameSite(a: string, b: string): boolean {
  try {
    const h = (x: string) => new URL(x).hostname.toLowerCase().replace(/^www\./, "");
    return h(a) === h(b);
  } catch {
    return false;
  }
}

function key() {
  const k = process.env.FIRECRAWL_API_KEY;
  if (!k) throw new Error("The website-reading service is not connected (FIRECRAWL_API_KEY missing).");
  return k;
}

async function fc(path: string, init: RequestInit = {}) {
  const url = path.startsWith("http") ? path : `${FIRECRAWL_V2}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${key()}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Website reader ${res.status}: ${text.slice(0, 300)}`);
  return JSON.parse(text);
}

export async function startCrawl(url: string, limit: number): Promise<string> {
  const body = await fc("/crawl", {
    method: "POST",
    body: JSON.stringify({
      url,
      limit,
      allowSubdomains: false,
      allowExternalLinks: false,
      scrapeOptions: { formats: ["markdown"], onlyMainContent: true },
    }),
  });
  if (!body?.id) throw new Error(`Website reader did not start: ${JSON.stringify(body).slice(0, 200)}`);
  return body.id as string;
}

export type CrawlPage = { url: string; title: string; markdown: string };

/** Returns job status plus every page available so far (follows pagination). */
export async function getCrawl(id: string): Promise<{ status: string; total: number; completed: number; pages: CrawlPage[] }> {
  let body = await fc(`/crawl/${id}`);
  const status = String(body.status ?? "unknown");
  const total = Number(body.total ?? 0);
  const completed = Number(body.completed ?? 0);
  const pages: CrawlPage[] = [];
  for (let guard = 0; guard < 50; guard++) {
    for (const d of body.data ?? []) {
      const m = d.metadata ?? {};
      pages.push({ url: m.sourceURL ?? m.url ?? "", title: m.title ?? "", markdown: d.markdown ?? "" });
    }
    if (!body.next) break;
    body = await fc(body.next);
  }
  return { status, total, completed, pages };
}

async function sha256(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

type Src = { id: string; country_code: string; visibility: string; owner_country_code: string | null };

/** Upsert one page. Returns "added" | "updated" | "unchanged" | "skipped". */
export async function upsertPage(admin: any, src: Src, page: CrawlPage): Promise<{ result: string; chunks: number }> {
  const md = (page.markdown ?? "").trim();
  if (md.length < 200) return { result: "skipped", chunks: 0 };
  const pageKey = normalizePageKey(page.url);
  const hash = await sha256(md);

  const { data: existing } = await admin
    .from("country_source_documents")
    .select("id, content_hash")
    .eq("country_source_id", src.id)
    .eq("page_key", pageKey)
    .maybeSingle();
  if (existing?.content_hash === hash) return { result: "unchanged", chunks: 0 };

  // Same text already filed under another address of this source → skip (duplicate page).
  const { data: sameText } = await admin
    .from("country_source_documents")
    .select("id")
    .eq("country_source_id", src.id)
    .eq("content_hash", hash)
    .neq("page_key", pageKey)
    .maybeSingle();
  if (sameText) return { result: "skipped", chunks: 0 };

  const chunks = chunkText(md);
  const row = {
    country_source_id: src.id,
    raw_text: md,
    char_count: md.length,
    chunk_count: chunks.length,
    content_hash: hash,
    page_url: page.url,
    page_title: page.title || null,
    page_key: pageKey,
    fetched_at: new Date().toISOString(),
    visibility: src.visibility,
    owner_country_code: src.owner_country_code,
  };
  let docId: string;
  if (existing) {
    await admin.from("country_source_chunks").delete().eq("document_id", existing.id);
    const { error } = await admin.from("country_source_documents").update(row).eq("id", existing.id);
    if (error) throw error;
    docId = existing.id;
  } else {
    const { data, error } = await admin.from("country_source_documents").insert(row).select("id").single();
    if (error) throw error;
    docId = data.id;
  }
  for (let i = 0; i < chunks.length; i += 64) {
    const batch = chunks.slice(i, i + 64);
    const embs = await embedBatch(batch);
    const rows = batch.map((content, idx) => ({
      country_code: src.country_code,
      document_id: docId,
      chunk_index: i + idx,
      content,
      embedding: `[${embs[idx].join(",")}]`,
      visibility: src.visibility,
      owner_country_code: src.owner_country_code,
    }));
    const { error } = await admin.from("country_source_chunks").upsert(rows, { onConflict: "document_id,chunk_index" });
    if (error) {
      const { error: e2 } = await admin.from("country_source_chunks").insert(rows);
      if (e2) throw e2;
    }
  }
  return { result: existing ? "updated" : "added", chunks: chunks.length };
}
