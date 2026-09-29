// Aggregate, public-only counts about the national record for /record.
// Server-only. Never returns a row body, a name or a private item — only
// counts over rows marked visibility = 'public', plus the label/period/grade
// of recently refreshed public KPIs. Cached for ten minutes per scope.

import type { FactGrade } from "@/lib/calculator/facts.server";

export interface CorpusStats {
  scope: string | null;
  sources: number;
  passages: number;
  figures: number;
  verified: number;
  pulse: Array<{ country: string; label: string; period: string | null; grade: FactGrade }>;
  generatedAt: string;
}

const TTL = 10 * 60 * 1000;
const cache = new Map<string, { at: number; v: CorpusStats }>();

const gradeOf = (p: string | null): FactGrade =>
  p === "verified" ? "A" : p === "inferred" ? "C" : "B";

export async function computeCorpusStats(code: string | null): Promise<CorpusStats> {
  const key = code ?? "*";
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.v;
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");

  const count = async (table: "country_sources" | "country_source_chunks" | "country_kpis", extra?: Record<string, string>) => {
    let q = db.from(table).select("id", { count: "exact", head: true }).eq("visibility", "public");
    if (code) q = q.eq("country_code", code);
    for (const [k, v] of Object.entries(extra ?? {})) q = q.eq(k, v);
    const { count: n } = await q;
    return n ?? 0;
  };

  let pq = db
    .from("country_kpis")
    .select("country_code,label,latest_period,provenance,updated_at")
    .eq("visibility", "public")
    .not("latest_value", "is", null)
    .order("updated_at", { ascending: false })
    .limit(16);
  if (code) pq = pq.eq("country_code", code);

  const [sources, passages, figures, verified, pulseRes] = await Promise.all([
    count("country_sources"),
    count("country_source_chunks"),
    count("country_kpis"),
    count("country_kpis", { provenance: "verified" }),
    pq,
  ]);

  const v: CorpusStats = {
    scope: code,
    sources,
    passages,
    figures,
    verified,
    pulse: (pulseRes.data ?? []).map((r) => ({
      country: r.country_code as string,
      label: r.label as string,
      period: (r.latest_period as string | null) ?? null,
      grade: gradeOf(r.provenance as string | null),
    })),
    generatedAt: new Date().toISOString(),
  };
  cache.set(key, { at: Date.now(), v });
  return v;
}
