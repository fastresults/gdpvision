// Chamber 05 · weekly source discovery hook (Layer 4).
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/press-discover")({
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
        const body = (await request.json().catch(() => ({}))) as { country?: string };
        const { discoverForCountry, discoverAllCountries } = await import("@/lib/press-discover.server");
        try {
          if (body.country) {
            const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
            const { data } = await supabaseAdmin
              .from("countries")
              .select("code,name")
              .eq("code", body.country)
              .maybeSingle();
            if (!data) return new Response("country not found", { status: 404 });
            const r = await discoverForCountry(data.code as string, (data.name as string) ?? body.country);
            return Response.json({ ok: true, ...r });
          }
          const results = await discoverAllCountries();
          return Response.json({ ok: true, results });
        } catch (e) {
          return new Response((e as Error).message, { status: 500 });
        }
      },
    },
  },
});
