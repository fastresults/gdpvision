import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { clean, codes, text, userDb } from "./shared";

export default defineTool({
  name: "compare_countries",
  title: "Compare countries",
  description: "Compare one public indicator (code or label text, e.g. 'gdp per capita') across countries.",
  inputSchema: {
    metric: z.string().min(2).max(80).describe("Indicator code or part of its label."),
    countries: z.array(z.string()).max(30).optional().describe("Country codes; omit for all."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ metric, countries }, ctx) => {
    const m = clean(metric);
    let q = userDb(ctx)
      .from("country_kpis")
      .select("country_code,kpi_code,label,unit,latest_value,latest_period,source_url")
      .eq("visibility", "public")
      .not("latest_value", "is", null)
      .or(`kpi_code.eq.${m.replace(/[^A-Za-z0-9_.-]/g, "")},label.ilike.%${m}%`)
      .order("latest_value", { ascending: false })
      .limit(300);
    const list = codes(countries);
    if (list.length) q = q.in("country_code", list);
    const { data, error } = await q;
    if (error) throw new ToolError(error.message);
    const rows = (data ?? []).map((r) => ({
      country: String(r.country_code),
      code: String(r.kpi_code),
      label: String(r.label),
      unit: r.unit ? String(r.unit) : null,
      value: Number(r.latest_value),
      period: r.latest_period ? String(r.latest_period) : null,
      source_url: r.source_url ? String(r.source_url) : null,
    }));
    return {
      content: text(rows.map((r) => `${r.country} · ${r.label}: ${r.value} (${r.period ?? "n/a"})`).join("\n") || "No matching indicators."),
      structuredContent: { metric: m, rows },
    };
  },
});
