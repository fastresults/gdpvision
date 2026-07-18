// Chamber 05 · press-monitoring tick.
// Called by pg_cron twice a day with an apikey header.
// Bypasses auth per /api/public/* convention — we validate the apikey ourselves.
import { createFileRoute } from "@tanstack/react-router";

type PressTickRequest = { window?: string; country?: string };

export const Route = createFileRoute("/api/public/hooks/press-tick")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = request.headers.get("apikey") ?? request.headers.get("x-apikey");
        const expected = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY;
        if (!apiKey || !expected || apiKey !== expected) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401, headers: { "Content-Type": "application/json" },
          });
        }

        const body = (await request.json().catch(() => ({}))) as PressTickRequest;
        const { runPressTick } = await import("@/lib/press-tick.server");
        try {
          const result = await runPressTick({
            windowKey: body.window ?? "adhoc",
            filterCountry: body.country ?? null,
            triggeredBy: body.country ? "manual" : "cron",
          });
          return Response.json(result);
        } catch (e) {
          return new Response((e as Error).message, { status: 500 });
        }
      },
    },
  },
});
