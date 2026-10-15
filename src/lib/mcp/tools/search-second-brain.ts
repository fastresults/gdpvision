import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { clean, codes, text, userDb } from "./shared";

export default defineTool({
  name: "search_second_brain",
  title: "Search the Second Brain",
  description: "Search verified public facts, risks and positions in the Second Brain by keyword.",
  inputSchema: {
    query: z.string().min(2).max(120),
    countries: z.array(z.string()).max(30).optional().describe("Country codes; omit for all."),
    sector: z.string().max(40).optional(),
    limit: z.number().int().min(1).max(50).default(20),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ query, countries, sector, limit }, ctx) => {
    let q = userDb(ctx)
      .from("memory_objects")
      .select("kind,title,sector_code,scope_key,weight,updated_at")
      .eq("visibility", "public")
      .eq("verified", true)
      .in("kind", ["fact", "risk", "position", "mandate_compact"])
      .ilike("title", `%${clean(query)}%`)
      .order("weight", { ascending: false })
      .limit(limit);
    const list = codes(countries);
    if (list.length) q = q.in("scope_key", list);
    if (sector) q = q.eq("sector_code", sector);
    const { data, error } = await q;
    if (error) throw new ToolError(error.message);
    const results = (data ?? []).map((r) => ({
      country: String(r.scope_key),
      kind: String(r.kind),
      title: String(r.title),
      sector: r.sector_code ? String(r.sector_code) : null,
      updated_at: String(r.updated_at),
    }));
    return {
      content: text(results.map((r) => `[${r.country}] ${r.kind}: ${r.title}`).join("\n") || "No matches."),
      structuredContent: { results },
    };
  },
});
