import { defineTool, ToolError, type JsonValueInput } from "@lovable.dev/mcp-js";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { text, userDb } from "./shared";

/** Database rows are plain JSON; the cast tells the MCP types so. */
const asJson = (x: unknown) => x as JsonValueInput;

export default defineTool({
  name: "get_index_catalogue",
  title: "Caribbean Indices method",
  description:
    "The Caribbean Indices (Growth CGX, Human CHX, Governance CGV, Capital CCX): pillars, indicators, sources, licences, goalposts and published editions.",
  inputSchema: {
    index: z
      .enum(["CGX", "CHX", "CGV", "CCX"])
      .optional()
      .describe("One index; omit for all four."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ index }, ctx) => {
    // the index tables are newer than the generated types; read them untyped
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const c = userDb(ctx) as unknown as SupabaseClient<any>;
    let s = c
      .from("index_specs")
      .select("code,name,pillar_label,question,benchmark,method_version,method_status")
      .order("position");
    let i = c
      .from("index_indicators")
      .select(
        "index_code,code,pillar_code,name,unit,source_org,source_url,licence,licence_status,indicator_type,status",
      )
      .order("position");
    if (index) {
      s = s.eq("code", index);
      i = i.eq("index_code", index);
    }
    const [specs, inds, rels] = await Promise.all([
      s,
      i,
      c
        .from("index_releases")
        .select("id,label,published_at")
        .eq("status", "published")
        .eq("kind", "edition")
        .order("published_at", { ascending: false }),
    ]);
    const err = specs.error ?? inds.error;
    if (err) throw new ToolError(err.message);
    const indicators = (inds.data ?? []) as Array<Record<string, unknown>>;
    const summary = ((specs.data ?? []) as Array<Record<string, unknown>>)
      .map(
        (x) =>
          `${x.name} (${x.code}) — ${x.question} ${indicators.filter((k) => k.index_code === x.code).length} indicators.`,
      )
      .join("\n");
    return {
      content: text(summary || "No indexes found."),
      structuredContent: asJson({
        indexes: specs.data ?? [],
        indicators,
        editions: rels.data ?? [],
      }),
    };
  },
});
