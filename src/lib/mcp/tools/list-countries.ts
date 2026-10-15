import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { text, userDb } from "./shared";

export default defineTool({
  name: "list_countries",
  title: "List countries",
  description: "List the countries in GDPVision with region groupings and headline GDP.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    const { data, error } = await userDb(ctx)
      .from("countries")
      .select("code,name,currency,is_caricom,is_oecs,is_cbi_state,gdp_current_usd,gdp_year")
      .order("name");
    if (error) throw new ToolError(error.message);
    const countries = (data ?? []).map((c) => ({
      code: String(c.code),
      name: String(c.name),
      currency: String(c.currency),
      caricom: Boolean(c.is_caricom),
      oecs: Boolean(c.is_oecs),
      cbi: Boolean(c.is_cbi_state),
      gdp_current_usd: c.gdp_current_usd === null ? null : Number(c.gdp_current_usd),
      gdp_year: c.gdp_year === null ? null : Number(c.gdp_year),
    }));
    return {
      content: text(countries.map((c) => `${c.code} · ${c.name}`).join("\n") || "No countries visible."),
      structuredContent: { countries },
    };
  },
});
