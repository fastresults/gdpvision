// Chamber 08 · Manifesto link reader (server-only).
// Turns share links into direct downloads, reads pages/PDFs via Firecrawl,
// and — when a page is thin — surfaces candidate PDF/chapter links.

import { assertPublicHttpUrl } from "@/lib/net/safe-url";

export type LinkCandidate = { url: string; label: string; kind: "pdf" | "doc" | "page"; recommended: boolean };
export type LinkRead = { url: string; title: string; text: string; candidates: LinkCandidate[] };

/** Rewrites Drive / Dropbox / OneDrive share links to direct-download links. */
export function toDirectUrl(raw: string): string {
  const u = assertPublicHttpUrl(raw.trim());
  const host = u.hostname.toLowerCase();
  if (host === "drive.google.com") {
    const id = u.pathname.match(/\/file\/d\/([^/]+)/)?.[1] ?? u.searchParams.get("id");
    if (id) return `https://drive.google.com/uc?export=download&id=${id}`;
  }
  if (host === "docs.google.com") {
    const id = u.pathname.match(/\/document\/d\/([^/]+)/)?.[1];
    if (id) return `https://docs.google.com/document/d/${id}/export?format=txt`;
  }
  if (host.endsWith("dropbox.com")) {
    u.searchParams.delete("dl");
    u.searchParams.set("dl", "1");
    return u.toString();
  }
  if (host === "1drv.ms" || host.endsWith("onedrive.live.com") || host.endsWith("sharepoint.com")) {
    u.searchParams.set("download", "1");
    return u.toString();
  }
  return u.toString();
}

const CHAPTER_RE = /(manifesto|chapter|part|section|pillar|platform|agenda|policy|programme|program|plan|download|pdf)/i;

async function scrape(url: string): Promise<{ title: string; markdown: string; links: string[]; url: string }> {
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key) throw new Error("Link reading isn't configured on this server");
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 60_000);
  try {
    const res = await fetch("https://api.firecrawl.dev/v2/scrape", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ url, formats: ["markdown", "links"], onlyMainContent: true }),
      signal: ctl.signal,
    });
    const body = (await res.json().catch(() => ({}))) as any;
    if (!res.ok || body?.success === false) {
      const why = String(body?.error ?? res.statusText ?? "unknown").slice(0, 200);
      if (res.status === 401 || res.status === 403) throw new Error(`the site blocked reading (${why}) — upload the file instead`);
      throw new Error(why);
    }
    const root = body?.data ?? body ?? {};
    const meta = root.metadata ?? {};
    return {
      title: meta.title ?? url,
      markdown: String(root.markdown ?? ""),
      links: Array.isArray(root.links) ? root.links.filter((l: unknown) => typeof l === "string") : [],
      url: meta.sourceURL ?? meta.url ?? url,
    };
  } finally {
    clearTimeout(t);
  }
}

export async function readManifestoLink(raw: string): Promise<LinkRead> {
  const direct = toDirectUrl(raw);
  const doc = await scrape(direct);
  const text = doc.markdown.replace(/\r\n/g, "\n").trim();
  let candidates: LinkCandidate[] = [];
  if (text.length < 3000) {
    const base = new URL(doc.url);
    const seen = new Set<string>([base.toString()]);
    for (const l of doc.links) {
      let u: URL;
      try {
        u = new URL(l, base);
        assertPublicHttpUrl(u.toString());
      } catch {
        continue;
      }
      u.hash = "";
      const href = u.toString();
      if (seen.has(href)) continue;
      const path = u.pathname.toLowerCase();
      const kind: LinkCandidate["kind"] = path.endsWith(".pdf") ? "pdf" : /\.(docx?|txt)$/.test(path) ? "doc" : "page";
      const sameSite = u.hostname === base.hostname;
      if (kind === "page" && (!sameSite || !CHAPTER_RE.test(href))) continue;
      seen.add(href);
      const label = decodeURIComponent(path.split("/").filter(Boolean).pop() ?? href).replace(/[-_]+/g, " ").slice(0, 90);
      candidates.push({ url: href, label, kind, recommended: false });
      if (candidates.length >= 20) break;
    }
    candidates.sort((a, b) => (a.kind === b.kind ? 0 : a.kind === "pdf" ? -1 : b.kind === "pdf" ? 1 : 0));
    const firstPdf = candidates.find((c) => c.kind !== "page" && /manifesto/i.test(c.url)) ?? candidates.find((c) => c.kind !== "page");
    if (firstPdf) firstPdf.recommended = true;
    else candidates.filter((c) => /manifesto|chapter|part/i.test(c.url)).slice(0, 8).forEach((c) => (c.recommended = true));
  }
  return { url: doc.url, title: doc.title, text, candidates };
}

/** Reads several links in order and stitches their text together. */
export async function readManifestoLinks(urls: string[]): Promise<{ text: string; pages: number; failed: string[] }> {
  const parts: string[] = [];
  const failed: string[] = [];
  for (const u of urls.slice(0, 20)) {
    try {
      const r = await scrape(toDirectUrl(u));
      if (r.markdown.trim()) parts.push(`# ${r.title}\n\n${r.markdown.trim()}`);
    } catch (e) {
      failed.push(`${u}: ${(e as Error).message}`);
    }
  }
  return { text: parts.join("\n\n---\n\n"), pages: parts.length, failed };
}
