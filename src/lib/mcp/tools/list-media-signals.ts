import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { MEDIA_SELECT, MEDIA_TOPICS, MEDIA_WINDOW_DAYS, shapeMedia } from "@/lib/public-data/media";
import { text, userDb } from "./shared";

export default defineTool({
  name: "list_media_signals",
  title: "List media signals",
  description:
    "Recent news signals (last 30 days) from the media scan for a country, with topic tags, priority level P1–P5 and source strength tier.",
  inputSchema: {
    country: z.string().regex(/^[A-Za-z]{2,4}$/),
    topic: z.enum(MEDIA_TOPICS).optional(),
    min_priority: z.number().int().min(1).max(5).optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ country, topic, min_priority }, ctx) => {
    const floor = new Date(Date.now() - MEDIA_WINDOW_DAYS * 86400000).toISOString();
    const { data, error } = await userDb(ctx)
      .from("intake_items")
      .select(MEDIA_SELECT)
      .eq("scope_key", country.toUpperCase())
      .in("scope", ["local", "regional", "international"])
      .or("story_primary.is.true,story_primary.is.null")
      .gt("created_at", floor)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new ToolError(error.message);
    const signals = shapeMedia((data ?? []) as Record<string, unknown>[], { topic, minPriority: min_priority });
    return {
      content: text(signals.slice(0, 50).map((s) => `P${s.priority_level} ${s.headline} — ${s.url ?? ""}`).join("\n") || "No recent signals."),
      structuredContent: { country: country.toUpperCase(), signals },
    };
  },
});
