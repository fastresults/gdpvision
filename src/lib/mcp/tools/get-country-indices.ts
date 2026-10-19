import { defineTool, ToolError, type JsonValueInput } from "@lovable.dev/mcp-js";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { text, userDb } from "./shared";

/** Database rows are plain JSON; the cast tells the MCP types so. */
const asJson = (x: unknown) => x as JsonValueInput;

export default defineTool({
  name: "get_country_indices",
  title: "Country Caribbean Index scores",
  description:
    "A country's scores on the Caribbean Indices from the latest published edition: score, rank, pillars, Sextant rating and the cited inputs behind each score.",
  inputSchema: {
    country: z
      .string()
      .regex(/^[A-Za-z]{2,4}$/)
      .describe("Country code, e.g. KNA."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ country }, ctx) => {
    // the index tables are newer than the generated types; read them untyped
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const c = userDb(ctx) as unknown as SupabaseClient<any>;
    const cc = country.toUpperCase();
    const { data: rels, error: rerr } = await c
      .from("index_releases")
      .select("id,run_id,label,published_at")
      .eq("status", "published")
      .eq("kind", "edition")
      .order("published_at", { ascending: false })
      .limit(1);
    if (rerr) throw new ToolError(rerr.message);
    const rel = rels?.[0] as { run_id: string; label: string } | undefined;
    if (!rel)
      return {
        content: text("No official edition of the Caribbean Indices has been published yet."),
        structuredContent: asJson({ country: cc, edition: null, scores: [] }),
      };
    const [s, i] = await Promise.all([
      c
        .from("index_scores")
        .select(
          "index_code,status,score,rank,pillar_scores,not_scored_reason,sextant,sextant_band,weakest_grade",
        )
        .eq("run_id", rel.run_id)
        .eq("country_code", cc),
      c
        .from("index_inputs")
        .select(
          "index_code,indicator_code,value_used,period,score,source_org,source_url,grade,excluded_reason",
        )
        .eq("run_id", rel.run_id)
        .eq("country_code", cc),
    ]);
    const err = s.error ?? i.error;
    if (err) throw new ToolError(err.message);
    const scores = (s.data ?? []) as Array<Record<string, unknown>>;
    return {
      content: text(
        scores
          .map(
            (r) =>
              `${r.index_code}: ${r.status === "scored" ? `${r.score} (rank ${r.rank})` : `not scored — ${r.not_scored_reason}`} · Sextant ${r.sextant} (${r.sextant_band})`,
          )
          .join("\n") || `No scores for ${cc} in ${rel.label}.`,
      ),
      structuredContent: asJson({ country: cc, edition: rel.label, scores, inputs: i.data ?? [] }),
    };
  },
});
