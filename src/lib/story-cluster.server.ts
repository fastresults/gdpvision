// Chamber 05 · story clustering — collapse syndicated coverage into one primary signal.
// Deterministic trigram similarity (pg_trgm) against recent same-country items;
// no AI call in the hot path. Cheap and idempotent.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { createHash } from "crypto";

const STOPWORDS = new Set([
  "the","a","an","and","or","but","of","in","on","for","to","from","by","with",
  "at","as","is","are","was","were","be","been","being","this","that","these",
  "those","it","its","new","says","said","after","amid","over","into","up","out",
]);

// Strip common outlet suffixes ("- Reuters", "| BBC News", "— Loop News").
export function stripOutlet(title: string): string {
  return title
    .replace(/\s+[-–—|]\s+[^-–—|]{2,40}$/u, "")
    .trim();
}

export function normalizeTitle(title: string): string {
  const stripped = stripOutlet(title).toLowerCase();
  const tokens = stripped
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOPWORDS.has(t));
  // Keep stable order (bag preserved by frequency) but dedupe adjacent noise.
  return tokens.join(" ");
}

export function storyKeyFromTitle(title: string): string {
  const norm = normalizeTitle(title);
  return createHash("sha1").update(norm).digest("hex").slice(0, 12);
}

export interface ClusterMatch {
  story_key: string;
  primary_id: string;
  similarity: number;
}

/**
 * Look for an existing primary in the last 72h for this country whose
 * normalized topic is trigram-similar to the candidate. Threshold 0.55.
 * Returns null if no strong match — caller mints a fresh story_key.
 */
export async function findCluster(
  countryCode: string,
  title: string,
): Promise<ClusterMatch | null> {
  const norm = normalizeTitle(title);
  if (norm.length < 6) return null;
  const since = new Date(Date.now() - 72 * 3600_000).toISOString();

  // Use pg_trgm similarity(). We include story_primary=true so siblings don't
  // become the cluster head.
  const { data, error } = await supabaseAdmin.rpc("find_story_cluster", {
    _country: countryCode,
    _norm_title: norm,
    _since: since,
  });
  if (error || !data || (Array.isArray(data) && data.length === 0)) return null;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.story_key || !row?.primary_id) return null;
  const sim = Number(row.similarity ?? 0);
  if (sim < 0.55) return null;
  return { story_key: row.story_key, primary_id: row.primary_id, similarity: sim };
}

/**
 * After inserting a sibling, append its URL to the primary's
 * metadata.related_coverage[] and bump reach (cap 5).
 */
export async function attachSibling(
  primaryId: string,
  sibling: { url: string | null; title: string; outlet?: string | null },
): Promise<void> {
  const { data: p } = await supabaseAdmin
    .from("intake_items")
    .select("metadata,reach")
    .eq("id", primaryId)
    .single();
  if (!p) return;
  const md = (p.metadata as Record<string, unknown> | null) ?? {};
  const related = Array.isArray(md.related_coverage) ? [...md.related_coverage] : [];
  // Dedupe by url.
  if (sibling.url && !related.some((r) => (r as { url?: string })?.url === sibling.url)) {
    related.push({
      url: sibling.url,
      title: sibling.title.slice(0, 240),
      outlet: sibling.outlet ?? null,
      added_at: new Date().toISOString(),
    });
  }
  const nextReach = Math.min(5, (p.reach ?? 1) + 1);
  await supabaseAdmin
    .from("intake_items")
    .update({
      metadata: { ...md, related_coverage: related },
      reach: nextReach,
    })
    .eq("id", primaryId);
}
