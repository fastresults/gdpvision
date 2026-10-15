import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { text, userDb } from "./shared";

export default defineTool({
  name: "get_kpis",
  title: "Get country indicators",
  description: "Public economic indicators for one country, each with its period and source link.",
  inputSchema: {
    country: z.string().regex(/^[A-Za-z]{2,4}$/).describe("Country code, e.g. ATG."),
    category: z.string().max(60).optional().describe("Optional category filter, e.g. climate."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ country, category }, ctx) => {
    let q = userDb(ctx)
      .from("country_kpis")
      .select("kpi_code,label,unit,category,latest_value,latest_period,source_url")
      .eq("country_code", country.toUpperCase())
      .eq("visibility", "public")
      .not("latest_value", "is", null)
      .order("category")
      .limit(300);
    if (category) q = q.eq("category", category);
    const { data, error } = await q;
    if (error) throw new ToolError(error.message);
    const kpis = (data ?? []).map((k) => ({
      code: String(k.kpi_code),
      label: String(k.label),
      unit: k.unit ? String(k.unit) : null,
      category: k.category ? String(k.category) : null,
      value: Number(k.latest_value),
      period: k.latest_period ? String(k.latest_period) : null,
      source_url: k.source_url ? String(k.source_url) : null,
    }));
    return {
      content: text(kpis.map((k) => `${k.label}: ${k.value} ${k.unit ?? ""} (${k.period ?? "n/a"})`).join("\n") || "No public indicators."),
      structuredContent: { country: country.toUpperCase(), kpis },
    };
  },
});
