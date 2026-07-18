// Chamber 05 · hourly cross-country press harvest.
// Called by pg_cron every hour. Sweeps every active feed across all countries
// via runPressTick (no filterCountry). Same auth pattern as press-tick.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/narrative-harvest")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = request.headers.get("apikey") ?? request.headers.get("x-apikey");
        const expected = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY;
        if (!apiKey || !expected || apiKey !== expected) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        const { runPressTick } = await import("@/lib/press-tick.server");
        try {
          const result = await runPressTick({
            windowKey: "hourly",
            filterCountry: null,
            triggeredBy: "cron",
          });
          return Response.json(result);
        } catch (e) {
          return new Response((e as Error).message, { status: 500 });
        }
      },
    },
  },
});
