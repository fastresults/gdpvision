import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { text, userDb } from "./shared";

export default defineTool({
  name: "list_events",
  title: "List GDP Events",
  description:
    "Published GDP Events (summits, roundtables, briefings) with dates, venue, format, theme and linked Second Brain items. Registrations are never included.",
  inputSchema: {
    upcoming_only: z.boolean().optional(),
    country: z.string().regex(/^[A-Za-z]{2,4}$/).optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ upcoming_only, country }, ctx) => {
    let q = userDb(ctx)
      .from("events")
      .select("slug, title, tagline, format, theme, country_code, city, venue, starts_at, ends_at, is_placeholder, event_links(kind, ref, label)")
      .eq("status", "published")
      .order("starts_at");
    if (upcoming_only) q = q.gte("starts_at", new Date().toISOString());
    if (country) q = q.eq("country_code", country.toUpperCase());
    const { data, error } = await q;
    if (error) throw new ToolError(error.message);
    const events = ((data ?? []) as unknown as Record<string, unknown>[]).map((e) => ({ ...e, url: `https://gdpvision.com/events/${e.slug}` }));
    return {
      content: text(events.map((e: Record<string, unknown>) => `${String(e.starts_at).slice(0, 10)} ${String(e.title)} — ${String(e.url)}`).join("\n") || "No events."),
      structuredContent: { events },
    };
  },
});
