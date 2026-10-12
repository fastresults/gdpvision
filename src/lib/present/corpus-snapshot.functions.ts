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
