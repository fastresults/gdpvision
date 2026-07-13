// Server-only ingest helpers: Firecrawl scrape, chunk, embed via Lovable AI Gateway.
// Used by the corpus ingest agent during country onboarding.

export type ScrapedDoc = { title: string; markdown: string; url: string };

export async function fetchFirecrawl(url: string): Promise<ScrapedDoc> {
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key) throw new Error("FIRECRAWL_API_KEY not configured");
  const res = await fetch("https://api.firecrawl.dev/v2/scrape", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      url,
      formats: ["markdown"],
      onlyMainContent: true,
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Firecrawl ${res.status}: ${t.slice(0, 300)}`);
  }
  const body = (await res.json()) as any;
  if (body && body.success === false) {
    throw new Error(`Firecrawl error: ${String(body.error ?? "unknown").slice(0, 300)}`);
  }
  // v2 returns fields at top level; v1 nested them under `data`.
  const root = body?.data ?? body ?? {};
  const markdown: string = root.markdown ?? "";
  const meta = root.metadata ?? {};
  const title: string = meta.title ?? url;
  const src: string = meta.sourceURL ?? meta.url ?? url;
  return { title, markdown, url: src };
}

/** ~1000-char chunks with 100-char overlap, splitting on paragraph boundaries when possible. */
export function chunkText(text: string, size = 1000, overlap = 100): string[] {
  const clean = text.replace(/\r\n/g, "\n").trim();
  if (clean.length <= size) return clean ? [clean] : [];
  const chunks: string[] = [];
  let i = 0;
  while (i < clean.length) {
    const end = Math.min(i + size, clean.length);
    // Try to break at a paragraph or sentence within the last 150 chars of the window
    let cut = end;
    if (end < clean.length) {
      const window = clean.slice(Math.max(end - 150, i), end);
      const paraBreak = window.lastIndexOf("\n\n");
      const sentBreak = window.lastIndexOf(". ");
      const rel = paraBreak >= 0 ? paraBreak : sentBreak;
      if (rel > 0) cut = Math.max(end - 150, i) + rel + 1;
    }
    chunks.push(clean.slice(i, cut).trim());
    if (cut >= clean.length) break;
    i = Math.max(cut - overlap, i + 1);
  }
  return chunks.filter((c) => c.length > 40);
}

/** Embed a batch of chunks via Lovable AI Gateway (OpenAI-compatible /v1/embeddings). */
export async function embedBatch(chunks: string[]): Promise<number[][]> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY not configured");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
    method: "POST",
    headers: {
      "Lovable-API-Key": key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "openai/text-embedding-3-small",
      input: chunks,
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Embeddings ${res.status}: ${t.slice(0, 300)}`);
  }
  const json = (await res.json()) as { data?: Array<{ embedding: number[] }> };
  return (json.data ?? []).map((d) => d.embedding);
}
