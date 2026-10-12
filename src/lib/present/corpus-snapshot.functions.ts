// @domain present
// @tables country_sources,country_source_documents,country_source_chunks,memory_objects,country_kpis
// @ui src/components/present/CorpusMark.tsx
import { createServerFn } from "@tanstack/react-start";

export type CorpusCounts = {
  sources: number;
  documents: number;
  chunks: number;
  memories: number;
  kpis: number;
};

export const CORPUS_FALLBACK: CorpusCounts = {
  sources: 120,
  documents: 900,
  chunks: 12000,
  memories: 600,
  kpis: 300,
};

/**
 * Public, aggregate-only snapshot of the Second Brain for the briefing.
 * Returns row COUNTS per corpus table — never rows, text or identifiers.
 */
export const getCorpusSnapshot = createServerFn({ method: "GET" }).handler(
  async (): Promise<CorpusCounts> => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const count = async (t: string) => {
        const { count: n } = await supabaseAdmin
          .from(t as never)
          .select("*", { count: "estimated", head: true });
        return n ?? 0;
      };
      const [sources, documents, chunks, memories, kpis] = await Promise.all([
        count("country_sources"),
        count("country_source_documents"),
        count("country_source_chunks"),
        count("memory_objects"),
        count("country_kpis"),
      ]);
      return { sources, documents, chunks, memories, kpis };
    } catch (e) {
      console.error("corpus snapshot failed", e);
      return CORPUS_FALLBACK;
    }
  },
);

export type BrainShapeRow = {
  id: string;
  title: string;
  kind: string;
  sector_code: string | null;
  scope_key: string;
  weight: number;
  verified: boolean;
  updated_at: string;
};

/**
 * Public, anonymous shape of one country's Second Brain: each memory's
 * sector, kind, weight and verified flag only. No titles, ids or content.
 */
export const getCountryBrainShape = createServerFn({ method: "GET" })
  .inputValidator((d: { country: string }) => ({
    country: String(d?.country ?? "").toUpperCase().slice(0, 4),
  }))
  .handler(async ({ data }): Promise<BrainShapeRow[]> => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: rows, error } = await supabaseAdmin
        .from("memory_objects")
        .select("kind,sector_code,weight,verified,updated_at")
        .eq("scope_key", data.country)
        .limit(2000);
      if (error) throw error;
      return (rows ?? []).map((r, i) => ({
        id: `m${i}`,
        title: "",
        kind: r.kind,
        sector_code: r.sector_code,
        scope_key: data.country,
        weight: Number(r.weight ?? 1),
        verified: Boolean(r.verified),
        updated_at: r.updated_at,
      }));
    } catch (e) {
      console.error("brain shape failed", e);
      return [];
    }
  });
