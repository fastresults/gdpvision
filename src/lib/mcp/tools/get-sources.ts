import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { clean, text, userDb } from "./shared";

export default defineTool({
  name: "get_sources",
  title: "Get official sources",
  description: "Official public sources registered for a country, optionally filtered by keyword.",
  inputSchema: {
    country: z.string().regex(/^[A-Za-z]{2,4}$/),
    query: z.string().max(120).optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ country, query }, ctx) => {
    let q = userDb(ctx)
      .from("country_sources")
      .select("org,title,url,kind,summary,quality_score")
      .eq("country_code", country.toUpperCase())
      .eq("visibility", "public")
      .eq("active", true)
      .order("quality_score", { ascending: false })
      .limit(100);
    if (query && clean(query).length > 1) q = q.or(`title.ilike.%${clean(query)}%,org.ilike.%${clean(query)}%`);
    const { data, error } = await q;
    if (error) throw new ToolError(error.message);
    const sources = (data ?? []).map((s) => ({
      org: s.org ? String(s.org) : null,
      title: String(s.title),
      url: s.url ? String(s.url) : null,
      kind: s.kind ? String(s.kind) : null,
      summary: s.summary ? String(s.summary) : null,
    }));
    return {
      content: text(sources.map((s) => `${s.title} — ${s.url ?? ""}`).join("\n") || "No public sources."),
      structuredContent: { country: country.toUpperCase(), sources },
    };
  },
});
